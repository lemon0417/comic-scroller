import "fake-indexeddb/auto";

import {
  CHAPTERS_STORE,
  HISTORY_STORE,
  LIBRARY_META_KEY,
  META_STORE,
  SERIES_STORE,
  SUBSCRIPTIONS_STORE,
  UPDATES_STORE,
} from "./schema";

type ChromeStorageListener = (changes: Record<string, any>, areaName: string) => void;

let compat: typeof import("./compat");
let mutations: typeof import("./mutations");
let queries: typeof import("./queries");
let shared: typeof import("./shared");

if (typeof globalThis.structuredClone !== "function") {
  (globalThis as any).structuredClone = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value));
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

describe("library integration", () => {
  let chromeEnv: ReturnType<typeof createChromeMock>;

  beforeEach(async () => {
    chromeEnv = createChromeMock();
    (global as any).chrome = chromeEnv.chromeMock;
    jest.resetModules();
    await resetLibraryPersistence();
    compat = await import("./compat");
    mutations = await import("./mutations");
    queries = await import("./queries");
    shared = await import("./shared");
  });

  afterEach(async () => {
    await resetLibraryPersistence(true);
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
    expect(feed.update[0].updateChapterID).toBe("m2");
    expect(feed.continueReading?.continueChapterID).toBe("m1");

    await mutations.dismissSeriesUpdate("dm5", "m123", "m2");

    expect(await queries.getUpdateCount()).toBe(0);

    const exported = await compat.exportLibraryDump();
    expect(exported.data.series).toHaveLength(1);
    expect(exported.data.updates).toEqual([]);
    expect(exported.data.subscriptions).toEqual([
      { seriesKey: "dm5:m123", position: 0, checkedAt: 0 },
    ]);
  });

  it("keeps existing cover when refresh payload omits a replacement cover", async () => {
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
            cover: "persisted-cover.jpg",
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

    await mutations.applyBackgroundSeriesRefresh(
      "dm5",
      "m123",
      {
        title: "Demo",
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
        cover: "",
        url: "https://www.dm5.com/m123/",
      },
      ["m2"],
    );

    const readerState = await queries.getReaderSeriesState("dm5:m123");
    expect(readerState.series?.cover).toBe("persisted-cover.jpg");
    expect(readerState.series?.chapterList).toEqual(["m2", "m1"]);
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
    expect(feed.continueReading?.category).toBe("subscribe");
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

    await expect(queries.listSubscriptionKeys()).resolves.toEqual([
      "dm5:m-oldest",
      "dm5:m-newest",
    ]);
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
    expect(readerState.series?.title).toBe("Legacy Demo");
    expect(readerState.subscribed).toBe(true);
    expect(chromeEnv.getStorageState()).toEqual({});
  });

  it("upgrades the IndexedDB schema by removing dead indexes and scrubbing obsolete row fields", async () => {
    await seedLegacyLibraryDbV1();

    await expect(queries.getPopupFeedSnapshot()).resolves.toMatchObject({
      subscribe: [expect.objectContaining({ comicsID: "m123", title: "Legacy Demo" })],
    });

    const db = await shared.openLibraryDb();
    const transaction = db.transaction(
      [SERIES_STORE, CHAPTERS_STORE, SUBSCRIPTIONS_STORE, HISTORY_STORE, UPDATES_STORE],
      "readonly",
    );
    const seriesStore = transaction.objectStore(SERIES_STORE);
    const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
    const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
    const historyStore = transaction.objectStore(HISTORY_STORE);
    const updatesStore = transaction.objectStore(UPDATES_STORE);

    const [seriesRows, chapterRows, metaRow] = await Promise.all([
      shared.requestToPromise<any[]>(seriesStore.getAll()),
      shared.requestToPromise<any[]>(chaptersStore.getAll()),
      shared.requestToPromise<any>(db.transaction([META_STORE], "readonly").objectStore(META_STORE).get(LIBRARY_META_KEY)),
    ]);

    await shared.transactionDone(transaction);

    expect(seriesRows).toEqual([
      expect.not.objectContaining({ updatedAt: expect.anything() }),
    ]);
    expect(chapterRows).toEqual([
      expect.not.objectContaining({ chapter: expect.anything() }),
    ]);
    expect(subscriptionsStore.indexNames.contains("position")).toBe(false);
    expect(historyStore.indexNames.contains("position")).toBe(false);
    expect(updatesStore.indexNames.contains("position")).toBe(false);
    expect(updatesStore.indexNames.contains("createdAt")).toBe(false);
    expect(metaRow?.value?.dbSchemaVersion).toBe(2);
  });
});
