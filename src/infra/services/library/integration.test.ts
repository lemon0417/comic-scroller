import "fake-indexeddb/auto";

import { of } from "rxjs";

import {
  CHAPTERS_STORE,
  HISTORY_STORE,
  LIBRARY_DB_VERSION,
  LIBRARY_META_KEY,
  type LibraryDbRows,
  META_STORE,
  READS_STORE,
  SERIES_STORE,
  SUBSCRIPTIONS_STORE,
  UPDATES_STORE,
} from "./schema";

type ChromeStorageListener = (changes: Record<string, any>, areaName: string) => void;

let compat: typeof import("./compat");
let mutations: typeof import("./mutations");
let queries: typeof import("./queries");
let shared: typeof import("./shared");
let syncModel: typeof import("./syncModel");
let syncPersistence: typeof import("./syncPersistence");

if (typeof globalThis.structuredClone !== "function") {
  (globalThis as any).structuredClone = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value));
}

if (typeof globalThis.CompressionStream !== "function") {
  const { CompressionStream, DecompressionStream, ReadableStream } = require("stream/web");
  (globalThis as any).CompressionStream = CompressionStream;
  (globalThis as any).DecompressionStream = DecompressionStream;
  (globalThis as any).ReadableStream = ReadableStream;
}

if (
  typeof globalThis.Blob !== "function" ||
  typeof globalThis.Blob.prototype.arrayBuffer !== "function"
) {
  (globalThis as any).Blob = require("buffer").Blob;
}

function createChromeMock() {
  const listeners = new Set<ChromeStorageListener>();
  let storageState: Record<string, any> = {};

  const clone = <T>(value: T): T =>
    value === undefined ? value : JSON.parse(JSON.stringify(value));

  const getSelection = (keys?: any) => {
    if (keys == null) {
      return clone(storageState);
    }
    if (typeof keys === "string") {
      return { [keys]: clone(storageState[keys]) };
    }
    if (Array.isArray(keys)) {
      return keys.reduce<Record<string, any>>((acc, key) => {
        acc[key] = clone(storageState[key]);
        return acc;
      }, {});
    }
    if (typeof keys === "object") {
      return Object.keys(keys).reduce<Record<string, any>>((acc, key) => {
        acc[key] = key in storageState ? clone(storageState[key]) : keys[key];
        return acc;
      }, {});
    }
    return clone(storageState);
  };

  const emitChanges = (changes: Record<string, any>) => {
    if (Object.keys(changes).length === 0) return;
    listeners.forEach((listener) => listener(changes, "local"));
  };

  const chromeMock = {
    runtime: {
      getManifest: () => ({ version: "4.0.52" }),
    },
    storage: {
      onChanged: {
        addListener: (listener: ChromeStorageListener) => listeners.add(listener),
        removeListener: (listener: ChromeStorageListener) => listeners.delete(listener),
      },
      local: {
        get: (keys: any, cb?: (items: Record<string, any>) => void) =>
          cb?.(getSelection(keys)),
        set: (items: Record<string, any>, cb?: () => void) => {
          const changes = Object.entries(items).reduce<Record<string, any>>(
            (acc, [key, value]) => {
              const oldValue = storageState[key];
              storageState[key] = clone(value);
              acc[key] = {
                oldValue: clone(oldValue),
                newValue: clone(value),
              };
              return acc;
            },
            {},
          );
          emitChanges(changes);
          cb?.();
        },
        clear: (cb?: () => void) => {
          const changes = Object.keys(storageState).reduce<Record<string, any>>(
            (acc, key) => {
              acc[key] = {
                oldValue: clone(storageState[key]),
                newValue: undefined,
              };
              return acc;
            },
            {},
          );
          storageState = {};
          emitChanges(changes);
          cb?.();
        },
        remove: (keys: string | string[], cb?: () => void) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          const changes = keyList.reduce<Record<string, any>>((acc, key) => {
            if (!(key in storageState)) return acc;
            acc[key] = {
              oldValue: clone(storageState[key]),
              newValue: undefined,
            };
            delete storageState[key];
            return acc;
          }, {});
          emitChanges(changes);
          cb?.();
        },
      },
    },
  };

  return {
    chromeMock,
    getStorageState: () => storageState,
    setStorageState: (nextState: Record<string, any>) => {
      storageState = clone(nextState);
    },
  };
}

async function resetLibraryPersistence(closeOpenDb = false) {
  if (closeOpenDb && shared) {
    try {
      const db = await shared.openLibraryDb();
      db.close();
    } catch {
      // Ignore teardown races when a test never touched IndexedDB.
    }
  }

  if (typeof indexedDB !== "undefined") {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("comic-scroller-library");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Library IndexedDB delete was blocked during tests."));
    });
  }

  await new Promise<void>((resolve) => {
    const storage = (global as any).chrome?.storage?.local;
    if (!storage?.clear) {
      resolve();
      return;
    }
    storage.clear(() => resolve());
  });
}

async function seedLegacyLibraryDbV1() {
  await new Promise<void>((resolve, reject) => {
    const openRequest = indexedDB.open("comic-scroller-library", 1);
    openRequest.onupgradeneeded = () => {
      const db = openRequest.result;
      db.createObjectStore("meta", { keyPath: "key" });
      db.createObjectStore("series", { keyPath: "seriesKey" });
      const chapters = db.createObjectStore("chapters", {
        keyPath: ["seriesKey", "chapterID"],
      });
      chapters.createIndex("seriesKey", "seriesKey", { unique: false });
      const subscriptions = db.createObjectStore("subscriptions", {
        keyPath: "seriesKey",
      });
      subscriptions.createIndex("position", "position", { unique: false });
      const history = db.createObjectStore("history", {
        keyPath: "seriesKey",
      });
      history.createIndex("position", "position", { unique: false });
      const updates = db.createObjectStore("updates", {
        keyPath: ["seriesKey", "chapterID"],
      });
      updates.createIndex("position", "position", { unique: false });
      updates.createIndex("createdAt", "createdAt", { unique: false });
    };
    openRequest.onerror = () => reject(openRequest.error);
    openRequest.onsuccess = () => {
      const db = openRequest.result;
      const transaction = db.transaction(
        ["meta", "series", "chapters", "subscriptions", "history", "updates"],
        "readwrite",
      );
      transaction.objectStore("meta").put({
        key: "library-state",
        value: {
          initialized: true,
          version: "4.0.52",
          schemaVersion: 2,
          dbSchemaVersion: 1,
          updatedAt: 1,
        },
      });
      transaction.objectStore("series").put({
        seriesKey: "dm5:m123",
        site: "dm5",
        comicsID: "m123",
        title: "Legacy Demo",
        cover: "legacy.jpg",
        url: "https://www.dm5.com/m123/",
        lastRead: "m1",
        read: ["m1"],
        updatedAt: 1,
      });
      transaction.objectStore("chapters").put({
        seriesKey: "dm5:m123",
        chapterID: "m1",
        title: "Ch 1",
        href: "https://www.dm5.com/m123/1.html",
        chapter: "m1",
        orderIndex: 0,
      });
      transaction.objectStore("subscriptions").put({
        seriesKey: "dm5:m123",
        position: 0,
        checkedAt: 100,
      });
      transaction.objectStore("history").put({
        seriesKey: "dm5:m123",
        position: 0,
      });
      transaction.objectStore("updates").put({
        seriesKey: "dm5:m123",
        chapterID: "m1",
        createdAt: 2,
        position: 0,
      });
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    };
  });
}

async function seedLibraryDbV6WithMissingInvariants() {
  await new Promise<void>((resolve, reject) => {
    const openRequest = indexedDB.open("comic-scroller-library", 6);
    openRequest.onupgradeneeded = () => {
      const db = openRequest.result;
      db.createObjectStore(META_STORE, { keyPath: "key" });
      db.createObjectStore(SERIES_STORE, { keyPath: "seriesKey" });
      const chapters = db.createObjectStore(CHAPTERS_STORE, {
        keyPath: ["seriesKey", "chapterID"],
      });
      chapters.createIndex("seriesKey", "seriesKey", { unique: false });
      const reads = db.createObjectStore(READS_STORE, {
        keyPath: ["seriesKey", "chapterID"],
      });
      reads.createIndex("seriesKey", "seriesKey", { unique: false });
      const subscriptions = db.createObjectStore(SUBSCRIPTIONS_STORE, {
        keyPath: "seriesKey",
      });
      subscriptions.createIndex("position", "position", { unique: false });
      subscriptions.createIndex(
        "checkedAtPosition",
        ["checkedAt", "position"],
        { unique: false },
      );
      const history = db.createObjectStore(HISTORY_STORE, {
        keyPath: "seriesKey",
      });
      history.createIndex("position", "position", { unique: false });
      const updates = db.createObjectStore(UPDATES_STORE, {
        keyPath: ["seriesKey", "chapterID"],
      });
      updates.createIndex("position", "position", { unique: false });
    };
    openRequest.onerror = () => reject(openRequest.error);
    openRequest.onsuccess = () => {
      const db = openRequest.result;
      const transaction = db.transaction(
        [
          META_STORE,
          SERIES_STORE,
          CHAPTERS_STORE,
          READS_STORE,
          SUBSCRIPTIONS_STORE,
          HISTORY_STORE,
          UPDATES_STORE,
        ],
        "readwrite",
      );
      transaction.objectStore(META_STORE).put({
        key: LIBRARY_META_KEY,
        value: {
          initialized: true,
          version: "4.0.52",
          schemaVersion: 2,
          dbSchemaVersion: 6,
          updatedAt: 1,
        },
      });
      transaction.objectStore(SERIES_STORE).put({
        seriesKey: "dm5:m123",
        site: "dm5",
        comicsID: "m123",
        title: "V6 Demo",
        cover: "cover.jpg",
        url: "https://www.dm5.com/m123/",
        lastRead: "m1",
        lastReadTitle: "Ch 1",
        lastReadHref: "https://www.dm5.com/m1/",
        latestChapterID: "m2",
        latestChapterTitle: "Ch 2",
        latestChapterHref: "https://www.dm5.com/m2/",
      });
      transaction.objectStore(CHAPTERS_STORE).put({
        seriesKey: "dm5:m123",
        chapterID: "m2",
        title: "Ch 2",
        href: "https://www.dm5.com/m2/",
        orderIndex: 0,
      });
      transaction.objectStore(CHAPTERS_STORE).put({
        seriesKey: "dm5:m123",
        chapterID: "m1",
        title: "Ch 1",
        href: "https://www.dm5.com/m1/",
        orderIndex: 1,
      });
      transaction.objectStore(SUBSCRIPTIONS_STORE).put({
        seriesKey: "dm5:m123",
        position: 4,
      });
      transaction.objectStore(HISTORY_STORE).put({
        seriesKey: "dm5:m123",
        position: 7,
      });
      transaction.objectStore(UPDATES_STORE).put({
        seriesKey: "dm5:m123",
        chapterID: "m2",
        position: 9,
      });
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    };
  });
}

describe("library integration", () => {
  let chromeEnv: ReturnType<typeof createChromeMock>;

  const cleanupStores: Array<keyof LibraryDbRows> = [
    SERIES_STORE,
    CHAPTERS_STORE,
    READS_STORE,
    SUBSCRIPTIONS_STORE,
    HISTORY_STORE,
    UPDATES_STORE,
  ];

  async function seedCleanupSeries(
    site: "dm5" | "8comic",
    comicsID: string,
    subscribed = false,
  ) {
    const { seriesKey } = await mutations.applyReaderSeriesState(
      site,
      comicsID,
      {
        title: `${site} ${comicsID}`,
        url: `https://example.com/${comicsID}`,
        chapterList: ["c2", "c1"],
        chapters: {
          c1: { title: "Ch 1", href: "" },
          c2: { title: "Ch 2", href: "" },
        },
      },
      "c1",
    );
    if (subscribed) await mutations.setSeriesSubscriptionByKey(seriesKey, true);
    const db = await shared.openLibraryDb();
    const tx = db.transaction([UPDATES_STORE], "readwrite");
    const done = shared.transactionDone(tx);
    await shared.requestToPromise(
      tx
        .objectStore(UPDATES_STORE)
        .put({ seriesKey, chapterID: "c2", position: 1 }),
    );
    await done;
    return seriesKey;
  }

  async function readCleanupRows() {
    const db = await shared.openLibraryDb();
    const tx = db.transaction(cleanupStores, "readonly");
    const done = shared.transactionDone(tx);
    const rows = await Promise.all(
      cleanupStores.map((name) =>
        shared.requestToPromise<any[]>(tx.objectStore(name).getAll()),
      ),
    );
    await done;
    return Object.fromEntries(
      cleanupStores.map((name, index) => [name, rows[index]]),
    );
  }

  beforeEach(async () => {
    chromeEnv = createChromeMock();
    (global as any).chrome = chromeEnv.chromeMock;
    jest.resetModules();
    await resetLibraryPersistence();
    compat = await import("./compat");
    mutations = await import("./mutations");
    queries = await import("./queries");
    shared = await import("./shared");
    syncModel = await import("./syncModel");
    syncPersistence = await import("./syncPersistence");
  });

  afterEach(async () => {
    await resetLibraryPersistence(true);
  });

  it.each(["sf", "comicbus"])(
    "cleans retired %s rows on startup without rewriting supported rows",
    async (retiredSite) => {
      const snapshot = shared.migrateLibrary({
        dm5: {
          "123": {
            title: "Kept",
            lastRead: "c1",
            chapterList: ["c1"],
            chapters: { c1: { title: "Chapter", href: "dm5-url" } },
          },
        },
        manhuagui: {
          "123": {
            title: "Grouped",
            chapterList: ["c1"],
            chapters: { c1: { title: "Chapter", href: "gui-url" } },
          },
        },
        subscribe: [
          { site: "dm5", comicsID: "123" },
          { site: "manhuagui", comicsID: "123" },
        ],
        history: [{ site: "dm5", comicsID: "123" }],
        update: [{ site: "dm5", comicsID: "123", chapterID: "c1" }],
      });
      const rows = shared.snapshotToDbRows(snapshot, { "dm5:m123": 987 });
      rows.series[1].latestChapterIDsByGroup = { single: "c1" };
      const retiredRows = Object.fromEntries(
        cleanupStores.map((store) => [
          store,
          rows[store].map((row) => ({
            ...row,
            seriesKey: `${retiredSite}:123`,
            ...(store === SERIES_STORE
              ? { site: retiredSite, comicsID: "123" }
              : {}),
          })),
        ]),
      );
      const db = await shared.openLibraryDb();
      const tx = db.transaction([META_STORE, ...cleanupStores], "readwrite");
      const done = shared.transactionDone(tx);
      for (const store of cleanupStores) {
        for (const row of [...rows[store], ...retiredRows[store].slice(0, 1)]) {
          await shared.requestToPromise(tx.objectStore(store).put(row));
        }
      }
      await shared.requestToPromise(
        tx.objectStore(META_STORE).put({
          key: LIBRARY_META_KEY,
          value: {
            initialized: true,
            version: "4.4.0",
            dbSchemaVersion: LIBRARY_DB_VERSION,
            supportedSiteKeys: ["dm5", "comicbus", "manhuagui"],
          },
        }),
      );
      await shared.requestToPromise(
        tx
          .objectStore(READS_STORE)
          .put({ seriesKey: `${retiredSite}:dangling`, chapterID: "c1" }),
      );
      await done;

      await shared.ensureLibraryReady();
      expect(await shared.readRowsFromDb()).toEqual(rows);
      const metaTx = db.transaction([META_STORE], "readonly");
      const metaDone = shared.transactionDone(metaTx);
      const nextMeta = await shared.requestToPromise<any>(
        metaTx.objectStore(META_STORE).get(LIBRARY_META_KEY),
      );
      await metaDone;
      expect(nextMeta.value.supportedSiteKeys).toEqual([
        "dm5",
        "8comic",
        "manhuagui",
      ]);
      await shared.ensureLibraryReady();
      expect(await shared.readRowsFromDb()).toEqual(rows);
    },
  );

  it.each(
    ["sf", "comicbus"].flatMap((site) =>
      ["legacy", "snapshot", "dump-v1", "dump-v2"].map((format) => [
        site,
        format,
      ]),
    ),
  )(
    "ignores %s records and references when importing %s",
    async (retiredSite, format) => {
      const retiredHistory = Array.from(
        { length: 50 },
        (_, index) => `${retiredSite}:${index}`,
      );
      const record = {
        title: "Kept",
        lastRead: "c1",
        read: ["c1"],
        chapterList: ["c1"],
        chapters: { c1: { title: "Chapter", href: "chapter-url" } },
      };
      const legacy = {
        dm5: { "123": record },
        [retiredSite]: { "123": { ...record, title: "Retired" } },
        subscribe: [
          { site: retiredSite, comicsID: "123" },
          { site: "dm5", comicsID: "123" },
        ],
        history: [
          ...retiredHistory.map((key) => ({
            site: retiredSite,
            comicsID: key.split(":")[1],
          })),
          { site: "dm5", comicsID: "123" },
        ],
        update: [
          { site: retiredSite, comicsID: "123", chapterID: "c1" },
          { site: "dm5", comicsID: "123", chapterID: "c1" },
        ],
      };
      const snapshot = shared.migrateLibrary(legacy);
      const oldSnapshot = {
        ...snapshot,
        seriesByKey: {
          ...snapshot.seriesByKey,
          [`${retiredSite}:123`]: {
            ...record,
            site: retiredSite,
            comicsID: "123",
          },
        },
        subscriptions: [`${retiredSite}:123`, ...snapshot.subscriptions],
        history: [...retiredHistory, ...snapshot.history],
        updates: [
          { seriesKey: `${retiredSite}:123`, chapterID: "c1" },
          ...snapshot.updates,
        ],
      };
      const dumpRows = shared.snapshotToRows(snapshot);
      const oldDumpRows = {
        ...dumpRows,
        series: [
          ...dumpRows.series,
          {
            ...dumpRows.series[0],
            site: retiredSite,
            seriesKey: `${retiredSite}:123`,
            comicsID: "123",
          },
        ],
        chapters: [
          ...dumpRows.chapters,
          { ...dumpRows.chapters[0], seriesKey: `${retiredSite}:123` },
        ],
        subscriptions: [
          ...dumpRows.subscriptions,
          { seriesKey: `${retiredSite}:123`, position: 1 },
        ],
        history: [
          ...retiredHistory.map((seriesKey, position) => ({
            seriesKey,
            position,
          })),
          ...dumpRows.history.map((row) => ({ ...row, position: 50 })),
        ],
        updates: [
          ...dumpRows.updates,
          { seriesKey: `${retiredSite}:123`, chapterID: "c1", position: 1 },
        ],
      };
      const compactRows = shared.snapshotToCompactDumpRows(snapshot);
      const oldCompactRows = {
        ...compactRows,
        series: [
          ...compactRows.series,
          { ...compactRows.series[0], site: retiredSite, comicsID: "123" },
        ],
        subscriptions: [
          { seriesKey: `${retiredSite}:123` },
          ...compactRows.subscriptions,
        ],
        history: [...retiredHistory, ...compactRows.history],
        updates: [
          { seriesKey: `${retiredSite}:123`, chapterID: "c1" },
          ...compactRows.updates,
        ],
      };
      const payload =
        format === "legacy"
          ? legacy
          : format === "snapshot"
            ? oldSnapshot
            : {
                format: "comic-scroller-db-dump",
                formatVersion: format === "dump-v1" ? 1 : 2,
                data: format === "dump-v1" ? oldDumpRows : oldCompactRows,
              };
      await compat.importLibraryDump(payload);
      const feed = await queries.getPopupFeedSnapshot();
      for (const category of [feed.subscribe, feed.history, feed.update]) {
        expect(category).toEqual([
          expect.objectContaining({ site: "dm5", comicsID: "m123" }),
        ]);
      }
      const dump = await compat.exportLibraryDump();
      expect(dump.data.series.map((series) => series.site)).toEqual(["dm5"]);
      expect(dump.data.series[0].read).toEqual(["c1"]);
      expect(JSON.stringify(await shared.readRowsFromDb())).not.toContain(
        `${retiredSite}:`,
      );
    },
  );

  it("fully unsubscribes a series without deleting the same ID at another site", async () => {
    const target = await seedCleanupSeries("dm5", "123", true);
    const other = await seedCleanupSeries("8comic", "123", true);
    const before = await readCleanupRows();
    await expect(
      mutations.unsubscribeSeriesByKey(target, { clearSeriesData: true }),
    ).resolves.toBe(1);
    const after = await readCleanupRows();
    for (const name of cleanupStores) {
      expect(after[name]).toEqual(
        before[name].filter((row) => row.seriesKey === other),
      );
    }
    await expect(queries.getReaderSeriesSyncState(target)).resolves.toEqual({
      exists: false,
      subscribed: false,
    });
  });

  it.each(["manhuagui", "8comic"] as const)(
    "persists %s group checkpoints, detects all groups without replaying updates, and round-trips backup/sync",
    async (site) => {
      const comicsID = site === "8comic" ? "105" : "49169";
      const siteLabel = site === "8comic" ? "8comic" : "漫畫櫃";
      const groupIDs =
        site === "8comic" ? ["single", "volume"] : ["单话", "单行本", "番外篇"];
      const seriesURL =
        site === "8comic"
          ? "https://www.8comic.com/html/105.html"
          : "https://www.manhuagui.com/comic/49169/";
      const readerURL =
        site === "8comic"
          ? "https://articles.onemoreplace.tw"
          : "https://www.manhuagui.com";
      const { runBackgroundUpdateSummary } = await import("../background");
      const { buildSeriesKey, getChapterGroupCheckpoints } = await import(
        "@domain/library"
      );
      const seriesKey = buildSeriesKey(site, comicsID);
      const makeSnapshot = (newChapters: boolean) => {
        const chapterGroups = groupIDs.map((id, index) => ({
          id,
          chapterList: (newChapters ? [2, 1] : [1]).map((number) =>
            site === "8comic"
              ? `online/new-105.html?ch=${index + 1}${number}`
              : `comic/49169/${index + 1}${number}.html`,
          ),
        }));
        const chapterList = chapterGroups.flatMap((group) => group.chapterList);
        return {
          chapterGroups,
          chapterList,
          chapters: Object.fromEntries(
            chapterList.map((id) => [
              id,
              { title: id, href: `${readerURL}/${id}` },
            ]),
          ),
        };
      };
      const initial = makeSnapshot(false);
      await mutations.applyReaderSeriesState(
        site,
        comicsID,
        {
          ...initial,
          title: `${siteLabel} Demo`,
          cover:
            site === "8comic"
              ? "https://www.8comic.com/pics/0/105m.jpg"
              : "https://cf.mhgui.com/cpic/h/49169.jpg",
          url: seriesURL,
        },
        initial.chapterList[0],
        { chapterGroups: initial.chapterGroups },
      );
      await mutations.setSeriesSubscriptionByKey(seriesKey, true);
      const next = makeSnapshot(true);
      const noop = jest.fn();
      const deps = {
        applyBackgroundSeriesRefresh: mutations.applyBackgroundSeriesRefresh,
        clearNotification: noop,
        createNotification: noop,
        getFetchChapters: () => () => of(next),
        getManifestVersion: () => "4.4.0",
        getRuntimeUrl: (path: string) => path,
        getUpdateCount: queries.getUpdateCount,
        listBackgroundRefreshCandidates:
          queries.listBackgroundRefreshCandidates,
        markSubscriptionCheckedByKey: mutations.markSubscriptionCheckedByKey,
        openTab: noop,
        reconcileExtensionReleaseState: noop,
        refreshExtensionReleaseState: noop,
        resetLibrary: compat.resetLibrary,
        setBadge: noop,
        setLibraryVersion: compat.setLibraryVersion,
        withBatchedLibrarySignals: shared.withBatchedLibrarySignals,
      };
      expect((await runBackgroundUpdateSummary(deps)).updated).toBe(
        groupIDs.length,
      );
      expect((await runBackgroundUpdateSummary(deps)).updated).toBe(0);
      const expectedCheckpoints = getChapterGroupCheckpoints(
        next.chapterGroups,
      );
      expect(
        (await queries.listBackgroundRefreshCandidates())[0]
          .latestChapterIDsByGroup,
      ).toEqual(expectedCheckpoints);
      await mutations.applyReadProgress(site, comicsID, next.chapterList[0]);
      expect(
        (await queries.listBackgroundRefreshCandidates())[0]
          .latestChapterIDsByGroup,
      ).toEqual(expectedCheckpoints);
      const feed = await queries.getPopupFeedSnapshot();
      expect(feed.subscribe[0].siteLabel).toBe(siteLabel);
      expect(feed.continueReading?.continueChapterID).toBe(next.chapterList[0]);
      expect(feed.update.map((entry) => entry.updateChapterID)).toEqual(
        next.chapterGroups.slice(1).map((group) => group.chapterList[0]),
      );

      const localSync = await syncPersistence.readLibrarySyncState();
      const wire = syncModel.syncStateToIndexedRows(localSync.state);
      expect(wire[0][0][0]).toBe(site === "8comic" ? 4 : 3);
      await syncPersistence.applyLibrarySyncState(
        syncModel.syncIndexedRowsToState(wire),
        localSync.subscriptionCheckedAtByKey,
      );
      expect(
        (await queries.listBackgroundRefreshCandidates())[0]
          .latestChapterIDsByGroup,
      ).toEqual(expectedCheckpoints);

      // A new service-worker module instance must recover checkpoints from IndexedDB.
      (await shared.openLibraryDb()).close();
      jest.resetModules();
      queries = await import("./queries");
      shared = await import("./shared");
      expect(
        (await queries.listBackgroundRefreshCandidates())[0]
          .latestChapterIDsByGroup,
      ).toEqual(expectedCheckpoints);
      compat = await import("./compat");
      const dump = await compat.exportLibraryDump();
      await compat.importLibraryDump(dump);
      expect((await queries.getSeriesSnapshot(seriesKey))?.chapterList).toEqual(
        next.chapterList,
      );
      expect(
        (await queries.listBackgroundRefreshCandidates())[0]
          .latestChapterIDsByGroup,
      ).toBeUndefined();
      expect(
        (await queries.getPopupFeedSnapshot()).subscribe[0].siteLabel,
      ).toBe(siteLabel);
    },
  );

  it("atomically clears subscription and reminders while preserving history and reads", async () => {
    const target = await seedCleanupSeries("dm5", "123", true);
    const before = await readCleanupRows();
    await expect(
      mutations.unsubscribeSeriesByKey(target, { clearSeriesData: false }),
    ).resolves.toBe(0);
    const after = await readCleanupRows();
    for (const name of [
      SERIES_STORE,
      CHAPTERS_STORE,
      READS_STORE,
      HISTORY_STORE,
    ]) {
      expect(after[name]).toEqual(before[name]);
    }
    expect(after[SUBSCRIPTIONS_STORE]).toEqual([]);
    expect(after[UPDATES_STORE]).toEqual([]);
  });

  it("reclaims cache when unsubscribe and reminder dismissal remove the last references", async () => {
    const target = await seedCleanupSeries("dm5", "123", true);
    const db = await shared.openLibraryDb();
    const tx = db.transaction([HISTORY_STORE], "readwrite");
    const done = shared.transactionDone(tx);
    await shared.requestToPromise(tx.objectStore(HISTORY_STORE).delete(target));
    await done;
    await mutations.unsubscribeSeriesByKey(target, { clearSeriesData: false });
    const rows = await readCleanupRows();
    for (const name of cleanupStores) expect(rows[name]).toEqual([]);
  });

  it("cleans untracked history, never-tracked series, orphan cache and dangling child rows", async () => {
    const tracked = await seedCleanupSeries("dm5", "123", true);
    const formerlyTracked = await seedCleanupSeries("8comic", "123", true);
    await mutations.setSeriesSubscriptionByKey(formerlyTracked, false);
    await seedCleanupSeries("8comic", "never-tracked");
    const orphan = await seedCleanupSeries("dm5", "orphan");
    const db = await shared.openLibraryDb();
    const tx = db.transaction(
      [HISTORY_STORE, UPDATES_STORE, READS_STORE],
      "readwrite",
    );
    const done = shared.transactionDone(tx);
    await shared.requestToPromise(tx.objectStore(HISTORY_STORE).delete(orphan));
    await shared.requestToPromise(
      tx.objectStore(UPDATES_STORE).delete([orphan, "c2"]),
    );
    await shared.requestToPromise(
      tx
        .objectStore(READS_STORE)
        .put({ seriesKey: "8comic:dangling", chapterID: "c1" }),
    );
    await done;
    const before = await readCleanupRows();

    await expect(mutations.cleanupUnsubscribedSeries()).resolves.toEqual({
      removedSeriesCount: 4,
      updatesCount: 1,
    });
    const after = await readCleanupRows();
    for (const name of cleanupStores) {
      expect(after[name]).toEqual(
        before[name].filter((row) => row.seriesKey === tracked),
      );
    }
    const signalBefore = chromeEnv.getStorageState().librarySignal;
    await expect(mutations.cleanupUnsubscribedSeries()).resolves.toEqual({
      removedSeriesCount: 0,
      updatesCount: 1,
    });
    expect(chromeEnv.getStorageState().librarySignal).toEqual(signalBefore);
  });

  it("preserves a subscription committed before batch cleanup starts", async () => {
    const target = await seedCleanupSeries("8comic", "123");
    const subscribe = mutations.setSeriesSubscriptionByKey(target, true);
    const cleanup = mutations.cleanupUnsubscribedSeries();
    await subscribe;
    await expect(cleanup).resolves.toEqual({
      removedSeriesCount: 0,
      updatesCount: 1,
    });
    await expect(queries.getReaderSeriesSyncState(target)).resolves.toEqual({
      exists: true,
      subscribed: true,
    });
  });

  it("rolls back the whole batch when deletion fails after some rows were removed", async () => {
    await seedCleanupSeries("dm5", "123");
    await seedCleanupSeries("8comic", "123");
    const before = await readCleanupRows();
    const originalDelete = IDBObjectStore.prototype.delete;
    const deleteSpy = jest
      .spyOn(IDBObjectStore.prototype, "delete")
      .mockImplementation(function (this: IDBObjectStore, key) {
        if (this.name === HISTORY_STORE) throw new Error("simulated failure");
        return originalDelete.call(this, key);
      });
    try {
      await expect(mutations.cleanupUnsubscribedSeries()).rejects.toThrow(
        "simulated failure",
      );
    } finally {
      deleteSpy.mockRestore();
    }
    expect(await readCleanupRows()).toEqual(before);
  });

  it("does not recreate deleted data from late progress, metadata or background refresh", async () => {
    const target = await seedCleanupSeries("dm5", "123", true);
    await mutations.unsubscribeSeriesByKey(target, { clearSeriesData: true });
    await mutations.applyReadProgress("dm5", "123", "c2");
    await mutations.applyReaderSeriesState(
      "dm5",
      "123",
      {
        title: "stale",
        chapterList: ["c2"],
        chapters: { c2: { title: "Ch 2", href: "" } },
      },
      "c2",
      { requireExistingSeries: true },
    );
    await mutations.applyBackgroundSeriesRefresh(
      "dm5",
      "123",
      { chapterList: ["c2"], chapters: { c2: { title: "Ch 2", href: "" } } },
      ["c2"],
    );
    const rows = await readCleanupRows();
    for (const name of cleanupStores) expect(rows[name]).toEqual([]);
  });

  it("ignores an in-flight background refresh after unsubscribe while keeping history", async () => {
    const target = await seedCleanupSeries("dm5", "123", true);
    await mutations.unsubscribeSeriesByKey(target, { clearSeriesData: false });
    const before = await readCleanupRows();
    await mutations.applyBackgroundSeriesRefresh(
      "dm5",
      "123",
      { chapterList: ["new"], chapters: { new: { title: "New", href: "" } } },
      ["new"],
    );
    expect(await readCleanupRows()).toEqual(before);
  });

  it("round-trips import, query, mutation, and export against a real IndexedDB", async () => {
    await compat.importLibraryDump({
      format: "comic-scroller-db-dump",
      formatVersion: 1,
      exportedAt: 1,
      dbSchemaVersion: 1,
      data: {
        series: [
          {
            seriesKey: "dm5:m123",
            site: "dm5",
            comicsID: "m123",
            title: "Demo",
            cover: "cover.jpg",
            url: "https://www.dm5.com/m123/",
            lastRead: "m1",
            read: ["m1"],
            updatedAt: 1,
          },
        ],
        chapters: [
          {
            seriesKey: "dm5:m123",
            chapterID: "m2",
            title: "Ch 2",
            href: "https://www.dm5.com/m123/2.html",
            orderIndex: 0,
          },
          {
            seriesKey: "dm5:m123",
            chapterID: "m1",
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
            orderIndex: 1,
          },
        ],
        subscriptions: [{ seriesKey: "dm5:m123", position: 0 }],
        history: [{ seriesKey: "dm5:m123", position: 0 }],
        updates: [
          {
            seriesKey: "dm5:m123",
            chapterID: "m2",
            createdAt: 2,
            position: 0,
          },
        ],
      },
    });

    const db = await shared.openLibraryDb();
    const rawTransaction = db.transaction(
      [SERIES_STORE, READS_STORE, UPDATES_STORE],
      "readonly",
    );
    const rawSeriesRow = await shared.requestToPromise(
      rawTransaction.objectStore(SERIES_STORE).get("dm5:m123"),
    );
    const rawReadRows = await shared.requestToPromise(
      rawTransaction.objectStore(READS_STORE).index("seriesKey").getAll("dm5:m123"),
    );
    const rawUpdateRows = await shared.requestToPromise(
      rawTransaction.objectStore(UPDATES_STORE).getAll(),
    );
    await shared.transactionDone(rawTransaction);

    expect(rawSeriesRow).toEqual(
      expect.not.objectContaining({
        read: expect.anything(),
      }),
    );
    expect(rawReadRows).toEqual([
      {
        seriesKey: "dm5:m123",
        chapterID: "m1",
      },
    ]);
    expect(rawUpdateRows).toEqual([
      {
        seriesKey: "dm5:m123",
        chapterID: "m2",
        position: 0,
      },
    ]);

    const readerState = await queries.getReaderSeriesState("dm5:m123");
    const feed = await queries.getPopupFeedSnapshot();

    expect(readerState).toEqual({
      series: {
        site: "dm5",
        comicsID: "m123",
        title: "Demo",
        cover: "cover.jpg",
        url: "https://www.dm5.com/m123/",
        chapterList: ["m2", "m1"],
        chapters: {
          m1: {
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
          },
          m2: {
            title: "Ch 2",
            href: "https://www.dm5.com/m123/2.html",
          },
        },
        lastRead: "m1",
        read: ["m1"],
      },
      subscribed: true,
    });
    expect(feed.update).toHaveLength(1);
    expect(feed.updateCount).toBe(1);
    expect(feed.update[0].updateChapterID).toBe("m2");
    expect(feed.continueReading?.continueChapterID).toBe("m1");

    await mutations.dismissSeriesUpdate("dm5", "m123", "m2");

    expect(await queries.getUpdateCount()).toBe(0);

    const exported = await compat.exportLibraryDump();
    expect(exported.formatVersion).toBe(2);
    expect(exported.data.series).toHaveLength(1);
    expect(exported.data.updates).toEqual([]);
    expect(exported.data.subscriptions).toEqual([
      { seriesKey: "dm5:m123" },
    ]);
    expect(exported.data.history).toEqual(["dm5:m123"]);
    expect(exported.data.series[0]).toEqual(
      expect.objectContaining({
        site: "dm5",
        comicsID: "m123",
        lastRead: "m1",
        read: ["m1"],
        chapters: [
          {
            chapterID: "m2",
            title: "Ch 2",
            href: "https://www.dm5.com/m123/2.html",
          },
          {
            chapterID: "m1",
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
          },
        ],
      }),
    );
  });

  it("keeps series metadata unchanged during a background chapter refresh", async () => {
    await compat.importLibraryDump({
      format: "comic-scroller-db-dump",
      formatVersion: 1,
      exportedAt: 1,
      dbSchemaVersion: 1,
      data: {
        series: [
          {
            seriesKey: "dm5:m123",
            site: "dm5",
            comicsID: "m123",
            title: "Persisted title",
            cover: "persisted-cover.jpg",
            url: "https://www.dm5.com/manhua-persisted/",
            lastRead: "m1",
            read: ["m1"],
            updatedAt: 1,
          },
        ],
        chapters: [
          {
            seriesKey: "dm5:m123",
            chapterID: "m1",
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
            orderIndex: 0,
          },
        ],
        subscriptions: [{ seriesKey: "dm5:m123", position: 0 }],
        history: [{ seriesKey: "dm5:m123", position: 0 }],
        updates: [],
      },
    });

    await mutations.applyBackgroundSeriesRefresh(
      "dm5",
      "m123",
      {
        chapterList: ["m2", "m1"],
        chapters: {
          m1: {
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
          },
          m2: {
            title: "Ch 2",
            href: "https://www.dm5.com/m123/2.html",
          },
        },
      },
      ["m2"],
    );

    const readerState = await queries.getReaderSeriesState("dm5:m123");
    expect(readerState.series).toMatchObject({
      title: "Persisted title",
      cover: "persisted-cover.jpg",
      url: "https://www.dm5.com/manhua-persisted/",
      lastRead: "m1",
      read: ["m1"],
      chapterList: ["m2", "m1"],
    });
  });

  it("imports plain JSON bytes from the manage file picker flow", async () => {
    const payload = {
      format: "comic-scroller-db-dump" as const,
      formatVersion: 1 as const,
      exportedAt: 1,
      dbSchemaVersion: 1,
      data: {
        series: [
          {
            seriesKey: "dm5:m123",
            site: "dm5" as const,
            comicsID: "m123",
            title: "Demo",
            cover: "cover.jpg",
            url: "https://www.dm5.com/m123/",
            lastRead: "m1",
            read: ["m1"],
            updatedAt: 1,
          },
        ],
        chapters: [
          {
            seriesKey: "dm5:m123",
            chapterID: "m1",
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
            orderIndex: 0,
          },
        ],
        subscriptions: [{ seriesKey: "dm5:m123", position: 0 }],
        history: [{ seriesKey: "dm5:m123", position: 0 }],
        updates: [],
      },
    };

    await compat.importLibraryDump(
      Uint8Array.from(Buffer.from(JSON.stringify(payload), "utf8")).buffer,
    );

    const feed = await queries.getPopupFeedSnapshot();
    expect(feed.subscribe).toHaveLength(1);
    expect(feed.history).toHaveLength(1);
    expect(feed.subscribe[0].title).toBe("Demo");
  });

  it("exports gzip archives that can be imported again", async () => {
    await compat.importLibraryDump({
      format: "comic-scroller-db-dump",
      formatVersion: 1,
      exportedAt: 1,
      dbSchemaVersion: 1,
      data: {
        series: [
          {
            seriesKey: "dm5:m123",
            site: "dm5",
            comicsID: "m123",
            title: "Demo",
            cover: "cover.jpg",
            url: "https://www.dm5.com/m123/",
            lastRead: "m1",
            read: ["m1"],
            updatedAt: 1,
          },
        ],
        chapters: [
          {
            seriesKey: "dm5:m123",
            chapterID: "m1",
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
            orderIndex: 0,
          },
        ],
        subscriptions: [{ seriesKey: "dm5:m123", position: 0 }],
        history: [{ seriesKey: "dm5:m123", position: 0 }],
        updates: [],
      },
    });

    const archive = await compat.exportLibraryArchive();
    expect(archive.filename).toBe("comic-scroller-library.json.gz");
    expect(archive.blob.type).toBe("application/gzip");
    const archiveBytes = await archive.blob.arrayBuffer();
    expect(new Uint8Array(archiveBytes).slice(0, 2)).toEqual(
      new Uint8Array([0x1f, 0x8b]),
    );

    await compat.resetLibrary();
    await compat.importLibraryDump(archiveBytes);

    const feed = await queries.getPopupFeedSnapshot();
    expect(feed.subscribe).toHaveLength(1);
    expect(feed.history).toHaveLength(1);
    expect(feed.subscribe[0].lastReadTitle).toBe("Ch 1");
  });

  it("removes only history entries while preserving subscriptions and series data", async () => {
    await compat.importLibraryDump({
      format: "comic-scroller-db-dump",
      formatVersion: 1,
      exportedAt: 1,
      dbSchemaVersion: 1,
      data: {
        series: [
          {
            seriesKey: "dm5:m123",
            site: "dm5",
            comicsID: "m123",
            title: "Demo",
            cover: "cover.jpg",
            url: "https://www.dm5.com/m123/",
            lastRead: "m1",
            read: ["m1"],
            updatedAt: 1,
          },
        ],
        chapters: [
          {
            seriesKey: "dm5:m123",
            chapterID: "m2",
            title: "Ch 2",
            href: "https://www.dm5.com/m123/2.html",
            orderIndex: 0,
          },
          {
            seriesKey: "dm5:m123",
            chapterID: "m1",
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
            orderIndex: 1,
          },
        ],
        subscriptions: [{ seriesKey: "dm5:m123", position: 0 }],
        history: [{ seriesKey: "dm5:m123", position: 0 }],
        updates: [
          {
            seriesKey: "dm5:m123",
            chapterID: "m2",
            createdAt: 2,
            position: 0,
          },
        ],
      },
    });

    await mutations.removeSeriesFromHistory("dm5", "m123");

    const readerState = await queries.getReaderSeriesState("dm5:m123");
    const feed = await queries.getPopupFeedSnapshot();

    expect(readerState.series?.title).toBe("Demo");
    expect(readerState.subscribed).toBe(true);
    expect(feed.history).toEqual([]);
    expect(feed.subscribe).toHaveLength(1);
    expect(feed.update).toHaveLength(1);
    expect(feed.updateCount).toBe(1);
    expect(feed.continueReading?.category).toBe("subscribe");
  });

  it("prunes orphaned series cache after removing the last history reference", async () => {
    await compat.importLibraryDump({
      format: "comic-scroller-db-dump",
      formatVersion: 1,
      exportedAt: 1,
      dbSchemaVersion: 1,
      data: {
        series: [
          {
            seriesKey: "dm5:m123",
            site: "dm5",
            comicsID: "m123",
            title: "Demo",
            cover: "cover.jpg",
            url: "https://www.dm5.com/m123/",
            lastRead: "m1",
            read: ["m1"],
          },
        ],
        chapters: [
          {
            seriesKey: "dm5:m123",
            chapterID: "m1",
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
            orderIndex: 0,
          },
        ],
        subscriptions: [],
        history: [{ seriesKey: "dm5:m123", position: 0 }],
        updates: [],
      },
    });

    await mutations.removeSeriesFromHistory("dm5", "m123");

    await expect(queries.getSeriesSnapshot("dm5:m123")).resolves.toBeNull();
    await expect(queries.getPopupFeedSnapshot()).resolves.toEqual({
      update: [],
      updateCount: 0,
      subscribe: [],
      history: [],
      continueReading: null,
    });
  });

  it("prunes orphaned series cache after dismissing the last update", async () => {
    await compat.importLibraryDump({
      format: "comic-scroller-db-dump",
      formatVersion: 1,
      exportedAt: 1,
      dbSchemaVersion: 1,
      data: {
        series: [
          {
            seriesKey: "dm5:m123",
            site: "dm5",
            comicsID: "m123",
            title: "Demo",
            cover: "cover.jpg",
            url: "https://www.dm5.com/m123/",
            lastRead: "",
            read: [],
          },
        ],
        chapters: [
          {
            seriesKey: "dm5:m123",
            chapterID: "m2",
            title: "Ch 2",
            href: "https://www.dm5.com/m123/2.html",
            orderIndex: 0,
          },
        ],
        subscriptions: [],
        history: [],
        updates: [
          {
            seriesKey: "dm5:m123",
            chapterID: "m2",
            createdAt: 2,
            position: 0,
          },
        ],
      },
    });

    await mutations.dismissSeriesUpdate("dm5", "m123", "m2");

    await expect(queries.getUpdateCount()).resolves.toBe(0);
    await expect(queries.getSeriesSnapshot("dm5:m123")).resolves.toBeNull();
  });

  it("prunes orphaned series cache after unsubscribing the last tracked reference", async () => {
    await compat.importLibraryDump({
      format: "comic-scroller-db-dump",
      formatVersion: 1,
      exportedAt: 1,
      dbSchemaVersion: 1,
      data: {
        series: [
          {
            seriesKey: "dm5:m123",
            site: "dm5",
            comicsID: "m123",
            title: "Demo",
            cover: "cover.jpg",
            url: "https://www.dm5.com/m123/",
            lastRead: "",
            read: [],
          },
        ],
        chapters: [
          {
            seriesKey: "dm5:m123",
            chapterID: "m1",
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
            orderIndex: 0,
          },
        ],
        subscriptions: [{ seriesKey: "dm5:m123", position: 0 }],
        history: [],
        updates: [],
      },
    });

    await mutations.setSeriesSubscriptionByKey("dm5:m123", false);

    await expect(queries.getSeriesSnapshot("dm5:m123")).resolves.toBeNull();
    await expect(queries.getPopupFeedSnapshot()).resolves.toEqual({
      update: [],
      updateCount: 0,
      subscribe: [],
      history: [],
      continueReading: null,
    });
  });

  it("orders background polling subscriptions by the oldest checkedAt first", async () => {
    await compat.importLibraryDump({
      format: "comic-scroller-db-dump",
      formatVersion: 1,
      exportedAt: 1,
      dbSchemaVersion: 1,
      data: {
        series: [
          {
            seriesKey: "dm5:m-oldest",
            site: "dm5",
            comicsID: "m-oldest",
            title: "Oldest",
            cover: "",
            url: "https://www.dm5.com/m-oldest/",
            lastRead: "",
            read: [],
            updatedAt: 1,
          },
          {
            seriesKey: "dm5:m-newest",
            site: "dm5",
            comicsID: "m-newest",
            title: "Newest",
            cover: "",
            url: "https://www.dm5.com/m-newest/",
            lastRead: "",
            read: [],
            updatedAt: 1,
          },
        ],
        chapters: [],
        subscriptions: [
          { seriesKey: "dm5:m-newest", position: 0 },
          { seriesKey: "dm5:m-oldest", position: 1 },
        ],
        history: [],
        updates: [],
      },
    });

    await mutations.markSubscriptionCheckedByKey("dm5:m-newest", 200);
    await mutations.markSubscriptionCheckedByKey("dm5:m-oldest", 100);

    await expect(queries.listBackgroundRefreshCandidates()).resolves.toEqual([
      expect.objectContaining({ seriesKey: "dm5:m-oldest" }),
      expect.objectContaining({ seriesKey: "dm5:m-newest" }),
    ]);
  });

  it("round-trips subscription polling metadata through dump v2", async () => {
    await compat.importLibraryDump({
      format: "comic-scroller-db-dump",
      formatVersion: 2,
      exportedAt: 1,
      dbSchemaVersion: LIBRARY_DB_VERSION,
      data: {
        series: [
          {
            site: "dm5",
            comicsID: "m-newest",
            title: "Newest",
            cover: "",
            url: "https://www.dm5.com/m-newest/",
            lastRead: "",
            chapters: [],
          },
          {
            site: "dm5",
            comicsID: "m-oldest",
            title: "Oldest",
            cover: "",
            url: "https://www.dm5.com/m-oldest/",
            lastRead: "",
            chapters: [],
          },
        ],
        subscriptions: [
          { seriesKey: "dm5:m-newest", checkedAt: 200 },
          { seriesKey: "dm5:m-oldest", checkedAt: 100 },
        ],
        history: [],
        updates: [],
      },
    });

    await expect(queries.listBackgroundRefreshCandidates()).resolves.toEqual([
      expect.objectContaining({ seriesKey: "dm5:m-oldest" }),
      expect.objectContaining({ seriesKey: "dm5:m-newest" }),
    ]);
    await expect(compat.exportLibraryDump()).resolves.toMatchObject({
      data: {
        subscriptions: [
          { seriesKey: "dm5:m-newest", checkedAt: 200 },
          { seriesKey: "dm5:m-oldest", checkedAt: 100 },
        ],
      },
    });
  });

  it("persists lastRead as a read even when imported data omits read", async () => {
    await compat.importLibraryDump({
      format: "comic-scroller-db-dump",
      formatVersion: 2,
      exportedAt: 1,
      dbSchemaVersion: LIBRARY_DB_VERSION,
      data: {
        series: [
          {
            site: "dm5",
            comicsID: "m123",
            title: "Demo",
            cover: "",
            url: "https://www.dm5.com/m123/",
            lastRead: "m1",
            chapters: [
              {
                chapterID: "m1",
                title: "Ch 1",
                href: "https://www.dm5.com/m1/",
              },
            ],
          },
        ],
        subscriptions: [],
        history: ["dm5:m123"],
        updates: [],
      },
    });

    await expect(queries.getReaderSeriesState("dm5:m123")).resolves.toMatchObject({
      series: {
        lastRead: "m1",
        read: ["m1"],
      },
    });
    const rows = await shared.readRowsFromDb();
    expect(rows.reads).toEqual([
      { seriesKey: "dm5:m123", chapterID: "m1" },
    ]);
  });

  it("rejects missing-series subscriptions and removes dangling references", async () => {
    await expect(
      mutations.setSeriesSubscriptionByKey("dm5:missing", true),
    ).resolves.toBe(false);

    const db = await shared.openLibraryDb();
    let transaction = db.transaction([SUBSCRIPTIONS_STORE], "readwrite");
    await shared.requestToPromise(
      transaction.objectStore(SUBSCRIPTIONS_STORE).put({
        seriesKey: "dm5:missing",
        position: 0,
        checkedAt: 0,
      }),
    );
    await shared.transactionDone(transaction);

    await expect(
      mutations.setSeriesSubscriptionByKey("dm5:missing", false),
    ).resolves.toBe(false);

    transaction = db.transaction([SUBSCRIPTIONS_STORE], "readonly");
    const subscriptions = await shared.requestToPromise(
      transaction.objectStore(SUBSCRIPTIONS_STORE).getAll(),
    );
    await shared.transactionDone(transaction);
    expect(subscriptions).toEqual([]);
  });

  it("reads and applies lightweight sync projections without replacing chapter caches", async () => {
    await compat.importLibraryDump({
      format: "comic-scroller-db-dump",
      formatVersion: 2,
      exportedAt: 1,
      dbSchemaVersion: LIBRARY_DB_VERSION,
      data: {
        series: [
          {
            site: "dm5",
            comicsID: "m123",
            title: "Local Demo",
            cover: "local.jpg",
            url: "https://www.dm5.com/m123/",
            lastRead: "m1",
            read: ["m1", "m0"],
            chapters: [
              {
                chapterID: "m3",
                title: "Ch 3",
                href: "https://www.dm5.com/m3/",
              },
              {
                chapterID: "m2",
                title: "Ch 2",
                href: "https://www.dm5.com/m2/",
              },
              {
                chapterID: "m1",
                title: "Ch 1",
                href: "https://www.dm5.com/m1/",
              },
              {
                chapterID: "m0",
                title: "Ch 0",
                href: "https://www.dm5.com/m0/",
              },
            ],
          },
          {
            site: "dm5",
            comicsID: "orphan",
            title: "Cache only",
            cover: "",
            url: "",
            lastRead: "",
            chapters: [{ chapterID: "cache", title: "Cache", href: "" }],
          },
        ],
        subscriptions: [{ seriesKey: "dm5:m123", checkedAt: 111 }],
        history: ["dm5:m123"],
        updates: [{ seriesKey: "dm5:m123", chapterID: "m2" }],
      },
    });

    const local = await syncPersistence.readLibrarySyncState();
    expect(Object.keys(local.state.seriesByKey)).toEqual(["dm5:m123"]);
    expect(local.state.seriesByKey["dm5:m123"].readChapterIDs).toEqual(["m1"]);
    expect(local.subscriptionCheckedAtByKey).toEqual({
      "dm5:m123": 111,
    });
    expect(
      Object.keys(local.state.seriesByKey["dm5:m123"].chapterSummaries),
    ).toEqual(["m3", "m1", "m2"]);
    expect(
      local.state.seriesByKey["dm5:m123"].chapterSummaries,
    ).not.toHaveProperty("m0");

    const mergedState = syncModel.compactLibrarySyncState(
      syncModel.syncWireRowsToState({
        series: [
          {
            site: "dm5",
            comicsID: "m123",
            title: "Remote Demo",
            cover: "remote.jpg",
            url: "https://www.dm5.com/m123/",
            lastRead: "m1",
            read: ["m1"],
            chapters: [
              {
                chapterID: "m4",
                title: "Ch 4",
                href: "https://www.dm5.com/m4/",
              },
              {
                chapterID: "m3",
                title: "Ch 3",
                href: "https://www.dm5.com/m3/",
              },
              {
                chapterID: "m1",
                title: "Ch 1",
                href: "https://www.dm5.com/m1/",
              },
            ],
          },
          {
            site: "8comic",
            comicsID: "77",
            title: "Remote Only",
            cover: "",
            url: "https://www.8comic.com/html/77.html",
            lastRead: "",
            chapters: [
              {
                chapterID: "online/new-77.html?ch=7",
                title: "Ch 7",
                href: "https://articles.onemoreplace.tw/online/new-77.html?ch=7",
              },
            ],
          },
        ],
        subscriptions: [{ seriesKey: "dm5:m123" }, { seriesKey: "8comic:77" }],
        history: ["dm5:m123"],
        updates: [{ seriesKey: "dm5:m123", chapterID: "m4" }],
      }),
    );

    await syncPersistence.applyLibrarySyncState(
      mergedState,
      local.subscriptionCheckedAtByKey,
    );

    const localState = await queries.getReaderSeriesState("dm5:m123");
    expect(localState.series?.chapterList).toEqual([
      "m4",
      "m3",
      "m2",
      "m1",
      "m0",
    ]);
    expect(localState.series?.title).toBe("Remote Demo");
    expect(localState.series?.read).toEqual(
      expect.arrayContaining(["m1", "m0"]),
    );
    await expect(
      queries.getSeriesSnapshot("dm5:orphan"),
    ).resolves.toMatchObject({ title: "Cache only" });
    await expect(queries.getReaderSeriesState("8comic:77")).resolves.toMatchObject({
      series: {
        title: "Remote Only",
        chapterList: ["online/new-77.html?ch=7"],
      },
      subscribed: true,
    });

    const db = await shared.openLibraryDb();
    const transaction = db.transaction([SUBSCRIPTIONS_STORE], "readonly");
    const subscriptionRows = await shared.requestToPromise<any[]>(
      transaction.objectStore(SUBSCRIPTIONS_STORE).getAll(),
    );
    await shared.transactionDone(transaction);
    expect(subscriptionRows).toEqual(
      expect.arrayContaining([
        { seriesKey: "dm5:m123", position: 0, checkedAt: 111 },
        { seriesKey: "8comic:77", position: 1, checkedAt: 0 },
      ]),
    );

    const syncService = await import("./sync");
    chrome.storage.local.set({
      librarySyncState: { enabled: true, deviceId: "integration-device" },
    });
    const remoteItems: Record<string, unknown> = {};
    let failWrite = true;
    const runtime = chrome.runtime as unknown as {
      lastError?: { message: string };
    };
    Object.assign(chrome.storage, {
      sync: {
        get: (
          _keys: unknown,
          callback: (items: Record<string, unknown>) => void,
        ) => callback(remoteItems),
        set: (items: Record<string, unknown>, callback: () => void) => {
          if (failWrite)
            runtime.lastError = { message: "Chrome sync quota exceeded" };
          else Object.assign(remoteItems, items);
          try {
            callback();
          } finally {
            delete runtime.lastError;
          }
        },
        remove: (_keys: string[], callback: () => void) => callback(),
      },
    });
    const rowsBeforeSync = await shared.readRowsFromDb();
    await expect(syncService.syncLibraryNow()).resolves.toMatchObject({
      lastError: "Chrome sync quota exceeded",
    });
    expect(await shared.readRowsFromDb()).toEqual(rowsBeforeSync);
    failWrite = false;
    await expect(syncService.syncLibraryNow()).resolves.toMatchObject({
      lastError: "",
    });
    expect(await shared.readRowsFromDb()).toEqual(rowsBeforeSync);
  });

  it("migrates legacy chrome.storage data into IndexedDB on first repository query", async () => {
    chromeEnv.setStorageState({
      version: "4.0.52",
      history: [{ site: "dm5", comicsID: "123" }],
      subscribe: [{ site: "dm5", comicsID: "123" }],
      update: [{ site: "dm5", comicsID: "123", chapterID: "m2" }],
      dm5: {
        "123": {
          title: "Legacy Demo",
          cover: "legacy.jpg",
          url: "https://www.dm5.com/m123/",
          lastRead: "m1",
          chapterList: ["m2", "m1"],
          chapters: {
            m1: {
              title: "Ch 1",
              href: "https://www.dm5.com/m123/1.html",
            },
            m2: {
              title: "Ch 2",
              href: "https://www.dm5.com/m123/2.html",
            },
          },
          read: ["m1"],
        },
      },
    });

    const feed = await queries.getPopupFeedSnapshot();
    const readerState = await queries.getReaderSeriesState("dm5:m123");

    expect(feed.subscribe).toHaveLength(1);
    expect(feed.history).toHaveLength(1);
    expect(feed.update).toHaveLength(1);
    expect(feed.updateCount).toBe(1);
    expect(readerState.series?.title).toBe("Legacy Demo");
    expect(readerState.subscribed).toBe(true);
    expect(chromeEnv.getStorageState()).toEqual({});
  });

  it("repairs read and polling invariants when upgrading database v6 to v7", async () => {
    await seedLibraryDbV6WithMissingInvariants();

    await expect(queries.getReaderSeriesState("dm5:m123")).resolves.toMatchObject({
      series: {
        chapterList: ["m2", "m1"],
        lastRead: "m1",
        read: ["m1"],
      },
      subscribed: true,
    });

    const rows = await shared.readRowsFromDb();
    expect(rows.reads).toEqual([
      { seriesKey: "dm5:m123", chapterID: "m1" },
    ]);
    expect(rows.subscriptions).toEqual([
      { seriesKey: "dm5:m123", position: 0, checkedAt: 0 },
    ]);
    expect(rows.history).toEqual([
      { seriesKey: "dm5:m123", position: 0 },
    ]);
    expect(rows.updates).toEqual([
      { seriesKey: "dm5:m123", chapterID: "m2", position: 0 },
    ]);
  });

  it("upgrades the IndexedDB schema by restoring active ordering indexes and scrubbing obsolete row fields", async () => {
    await seedLegacyLibraryDbV1();

    await expect(queries.getPopupFeedSnapshot()).resolves.toMatchObject({
      subscribe: [expect.objectContaining({ comicsID: "m123", title: "Legacy Demo" })],
    });

    const db = await shared.openLibraryDb();
    const transaction = db.transaction(
      [SERIES_STORE, CHAPTERS_STORE, READS_STORE, SUBSCRIPTIONS_STORE, HISTORY_STORE, UPDATES_STORE],
      "readonly",
    );
    const seriesStore = transaction.objectStore(SERIES_STORE);
    const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
    const readsStore = transaction.objectStore(READS_STORE);
    const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
    const historyStore = transaction.objectStore(HISTORY_STORE);
    const updatesStore = transaction.objectStore(UPDATES_STORE);

    const [seriesRows, chapterRows, updateRows, metaRow] = await Promise.all([
      shared.requestToPromise<any[]>(seriesStore.getAll()),
      shared.requestToPromise<any[]>(chaptersStore.getAll()),
      shared.requestToPromise<any[]>(updatesStore.getAll()),
      shared.requestToPromise<any>(db.transaction([META_STORE], "readonly").objectStore(META_STORE).get(LIBRARY_META_KEY)),
    ]);

    await shared.transactionDone(transaction);

    expect(seriesRows).toEqual([
      expect.objectContaining({
        lastReadTitle: "Ch 1",
        lastReadHref: "https://www.dm5.com/m123/1.html",
        latestChapterID: "m1",
        latestChapterTitle: "Ch 1",
        latestChapterHref: "https://www.dm5.com/m123/1.html",
      }),
    ]);
    expect(seriesRows[0]).not.toHaveProperty("updatedAt");
    expect(chapterRows).toEqual([
      expect.not.objectContaining({ chapter: expect.anything() }),
    ]);
    expect(updateRows).toEqual([
      expect.not.objectContaining({ createdAt: expect.anything() }),
    ]);
    expect(readsStore.indexNames.contains("seriesKey")).toBe(true);
    expect(subscriptionsStore.indexNames.contains("position")).toBe(true);
    expect(subscriptionsStore.indexNames.contains("checkedAtPosition")).toBe(true);
    expect(historyStore.indexNames.contains("position")).toBe(true);
    expect(updatesStore.indexNames.contains("position")).toBe(true);
    expect(updatesStore.indexNames.contains("createdAt")).toBe(false);
    expect(metaRow?.value?.dbSchemaVersion).toBe(LIBRARY_DB_VERSION);
  });
});
