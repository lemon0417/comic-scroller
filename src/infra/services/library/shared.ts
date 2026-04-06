import { storageGetAll, storageRemove, storageSet } from "../storage";
import type {
  ChapterRecord,
  ChapterRow,
  HistoryRow,
  LibraryDumpV1,
  LibrarySignal,
  LibrarySnapshotV2,
  LibraryUpdateRecord,
  ReadRow,
  SeriesRecord,
  SeriesRow,
  SubscriptionRow,
  UpdateRow,
} from "./schema";
import {
  buildSeriesKey,
  CHAPTERS_STORE,
  createEmptyLibrarySnapshot,
  getExtensionVersion,
  HISTORY_LIMIT,
  HISTORY_STORE,
  LEGACY_STORAGE_KEYS,
  LIBRARY_DB_NAME,
  LIBRARY_DB_VERSION,
  LIBRARY_META_KEY,
  LIBRARY_SCHEMA_VERSION,
  LIBRARY_SIGNAL_KEY,
  META_STORE,
  normalizeChapterRecord,
  normalizeSeriesRecord,
  parseSeriesKey,
  READS_STORE,
  SERIES_STORE,
  SITE_KEYS,
  SUBSCRIPTIONS_STORE,
  uniqueStrings,
  UPDATES_STORE,
} from "./schema";

type LegacyStore = {
  version?: string;
  history?: Array<{ site?: string; comicsID?: string }> | string[];
  subscribe?: Array<{ site?: string; comicsID?: string }>;
  update?: Array<{ site?: string; comicsID?: string; chapterID?: string }>;
  dm5?: Record<string, unknown>;
  sf?: Record<string, unknown>;
  comicbus?: Record<string, unknown>;
  schemaVersion?: number;
  seriesByKey?: Record<string, SeriesRecord>;
  subscriptions?: string[];
  updates?: LibraryUpdateRecord[];
};

type MetaRow = {
  key: string;
  value: {
    initialized?: boolean;
    version?: string;
    schemaVersion?: number;
    dbSchemaVersion?: number;
    updatedAt?: number;
  };
};

let dbPromise: Promise<IDBDatabase> | null = null;
let libraryReadyPromise: Promise<void> | null = null;

function getStorageSnapshot(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    storageGetAll((items) => resolve(items || {}));
  });
}

function setStorageItems(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    storageSet(items, () => resolve());
  });
}

function removeStorageItems(keys: string[]): Promise<void> {
  return new Promise((resolve) => {
    if (keys.length === 0) {
      resolve();
      return;
    }
    storageRemove(keys, () => resolve());
  });
}

export function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function ensureIndexedDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this context.");
  }
}

function ensureStoreIndex(
  store: IDBObjectStore | undefined,
  indexName: string,
  keyPath: string | string[],
) {
  if (!store || store.indexNames.contains(indexName)) {
    return;
  }
  store.createIndex(indexName, keyPath, { unique: false });
}

export function openLibraryDb() {
  if (!dbPromise) {
    ensureIndexedDb();
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(LIBRARY_DB_NAME, LIBRARY_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(SERIES_STORE)) {
          db.createObjectStore(SERIES_STORE, { keyPath: "seriesKey" });
        }
        if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
          const chapters = db.createObjectStore(CHAPTERS_STORE, {
            keyPath: ["seriesKey", "chapterID"],
          });
          chapters.createIndex("seriesKey", "seriesKey", { unique: false });
        }
        if (!db.objectStoreNames.contains(READS_STORE)) {
          const reads = db.createObjectStore(READS_STORE, {
            keyPath: ["seriesKey", "chapterID"],
          });
          reads.createIndex("seriesKey", "seriesKey", { unique: false });
        }
        if (!db.objectStoreNames.contains(SUBSCRIPTIONS_STORE)) {
          const subscriptions = db.createObjectStore(SUBSCRIPTIONS_STORE, {
            keyPath: "seriesKey",
          });
          subscriptions.createIndex("position", "position", { unique: false });
          subscriptions.createIndex("checkedAtPosition", ["checkedAt", "position"], {
            unique: false,
          });
        } else {
          const subscriptions =
            request.transaction?.objectStore(SUBSCRIPTIONS_STORE);
          ensureStoreIndex(subscriptions, "position", "position");
          ensureStoreIndex(subscriptions, "checkedAtPosition", ["checkedAt", "position"]);
        }
        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          const history = db.createObjectStore(HISTORY_STORE, {
            keyPath: "seriesKey",
          });
          history.createIndex("position", "position", { unique: false });
        } else {
          const history = request.transaction?.objectStore(HISTORY_STORE);
          ensureStoreIndex(history, "position", "position");
        }
        if (!db.objectStoreNames.contains(UPDATES_STORE)) {
          const updates = db.createObjectStore(UPDATES_STORE, {
            keyPath: ["seriesKey", "chapterID"],
          });
          updates.createIndex("position", "position", { unique: false });
        } else {
          const updates = request.transaction?.objectStore(UPDATES_STORE);
          ensureStoreIndex(updates, "position", "position");
          if (updates?.indexNames.contains("createdAt")) {
            updates.deleteIndex("createdAt");
          }
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Library IndexedDB upgrade was blocked."));
    });
  }
  return dbPromise;
}

async function readMeta(key: string) {
  const db = await openLibraryDb();
  const transaction = db.transaction([META_STORE], "readonly");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(META_STORE);
  const row = await requestToPromise<MetaRow | undefined>(store.get(key));
  await done;
  return row;
}

export function snapshotToRows(snapshot: LibrarySnapshotV2) {
  const series: SeriesRow[] = [];
  const chapters: ChapterRow[] = [];

  Object.entries(snapshot.seriesByKey || {}).forEach(([seriesKey, record]) => {
    const normalized = normalizeSeriesRecord(record.site, record.comicsID, record);
    series.push({
      ...createSeriesRow(seriesKey, normalized),
      read: uniqueStrings(normalized.read),
    });
    normalized.chapterList.forEach((chapterID, orderIndex) => {
      if (!chapterID) return;
      const chapter = normalized.chapters[chapterID];
      chapters.push({
        seriesKey,
        chapterID,
        title: chapter?.title || "",
        href: chapter?.href || "",
        orderIndex,
      });
    });
  });

  return {
    series,
    chapters,
    subscriptions: uniqueStrings(snapshot.subscriptions).map((seriesKey, position) => ({
      seriesKey,
      position,
      checkedAt: 0,
    })),
    history: uniqueStrings(snapshot.history, HISTORY_LIMIT).map((seriesKey, position) => ({
      seriesKey,
      position,
    })),
    updates: (Array.isArray(snapshot.updates) ? snapshot.updates : []).map((item, position) => ({
      seriesKey: String(item?.seriesKey || ""),
      chapterID: String(item?.chapterID || ""),
      createdAt:
        typeof item?.createdAt === "number" ? item.createdAt : Date.now(),
      position,
    })),
  };
}

function groupReadRowsBySeriesKey(reads: ReadRow[]) {
  return reads.reduce<Record<string, string[]>>((acc, row) => {
    if (!row.seriesKey || !row.chapterID) {
      return acc;
    }
    acc[row.seriesKey] = uniqueStrings([...(acc[row.seriesKey] || []), row.chapterID]);
    return acc;
  }, {});
}

export function rowsToSnapshot(input: {
  series: SeriesRow[];
  chapters: ChapterRow[];
  reads?: ReadRow[];
  subscriptions: SubscriptionRow[];
  history: HistoryRow[];
  updates: UpdateRow[];
}) {
  const snapshot = createEmptyLibrarySnapshot();
  const readsBySeriesKey = groupReadRowsBySeriesKey(input.reads || []);

  for (const row of input.series) {
    const key = buildSeriesKey(row.site, row.comicsID);
    snapshot.seriesByKey[key] = {
      site: row.site,
      comicsID: row.comicsID,
      title: row.title || "",
      cover: row.cover || "",
      url: row.url || "",
      chapterList: [],
      chapters: {},
      lastRead: row.lastRead || "",
      read: uniqueStrings(readsBySeriesKey[key] || row.read),
    };
  }

  const chapterRows = [...input.chapters].sort((a, b) => a.orderIndex - b.orderIndex);
  for (const row of chapterRows) {
    const record = snapshot.seriesByKey[row.seriesKey];
    if (!record) continue;
    record.chapterList.push(row.chapterID);
    record.chapters[row.chapterID] = normalizeChapterRecord(row);
  }

  snapshot.subscriptions = [...input.subscriptions]
    .sort((a, b) => a.position - b.position)
    .map((item) => item.seriesKey)
    .filter((seriesKey) => !!snapshot.seriesByKey[seriesKey]);

  snapshot.history = [...input.history]
    .sort((a, b) => a.position - b.position)
    .map((item) => item.seriesKey)
    .filter((seriesKey) => !!snapshot.seriesByKey[seriesKey])
    .slice(0, HISTORY_LIMIT);

  snapshot.updates = [...input.updates]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      seriesKey: item.seriesKey,
      chapterID: item.chapterID,
      createdAt: item.createdAt,
    }))
    .filter(
      (item) =>
        !!item.seriesKey &&
        !!item.chapterID &&
        !!snapshot.seriesByKey[item.seriesKey],
    );

  return snapshot;
}

async function writeRowsToDb(
  rows: ReturnType<typeof snapshotToRows>,
  version = getExtensionVersion(),
) {
  const db = await openLibraryDb();
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
  const done = transactionDone(transaction);

  const metaStore = transaction.objectStore(META_STORE);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  const readsStore = transaction.objectStore(READS_STORE);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const historyStore = transaction.objectStore(HISTORY_STORE);
  const updatesStore = transaction.objectStore(UPDATES_STORE);

  await Promise.all([
    requestToPromise(metaStore.clear()),
    requestToPromise(seriesStore.clear()),
    requestToPromise(chaptersStore.clear()),
    requestToPromise(readsStore.clear()),
    requestToPromise(subscriptionsStore.clear()),
    requestToPromise(historyStore.clear()),
    requestToPromise(updatesStore.clear()),
  ]);

  for (const row of rows.series) {
    const { read = [], ...seriesRow } = row;
    await requestToPromise(seriesStore.put(seriesRow));
    for (const chapterID of uniqueStrings(read)) {
      await requestToPromise(
        readsStore.put({
          seriesKey: row.seriesKey,
          chapterID,
        }),
      );
    }
  }
  for (const row of rows.chapters) {
    await requestToPromise(chaptersStore.put(row));
  }
  for (const row of rows.subscriptions) {
    await requestToPromise(subscriptionsStore.put(row));
  }
  for (const row of rows.history) {
    await requestToPromise(historyStore.put(row));
  }
  for (const row of rows.updates) {
    await requestToPromise(updatesStore.put(row));
  }
  await requestToPromise(
    metaStore.put({
      key: LIBRARY_META_KEY,
      value: {
        initialized: true,
        version,
        schemaVersion: LIBRARY_SCHEMA_VERSION,
        dbSchemaVersion: LIBRARY_DB_VERSION,
        updatedAt: Date.now(),
      },
    }),
  );

  await done;
}

export async function readRowsFromDb() {
  const db = await openLibraryDb();
  const transaction = db.transaction(
    [SERIES_STORE, CHAPTERS_STORE, READS_STORE, SUBSCRIPTIONS_STORE, HISTORY_STORE, UPDATES_STORE],
    "readonly",
  );
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  const readsStore = transaction.objectStore(READS_STORE);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const historyStore = transaction.objectStore(HISTORY_STORE);
  const updatesStore = transaction.objectStore(UPDATES_STORE);

  const [seriesRows, chapters, reads, subscriptions, history, updates] = await Promise.all([
    requestToPromise<Array<SeriesRow & { read?: string[] }>>(seriesStore.getAll()),
    requestToPromise<ChapterRow[]>(chaptersStore.getAll()),
    requestToPromise<ReadRow[]>(readsStore.getAll()),
    requestToPromise<SubscriptionRow[]>(subscriptionsStore.getAll()),
    requestToPromise<HistoryRow[]>(historyStore.getAll()),
    requestToPromise<UpdateRow[]>(updatesStore.getAll()),
  ]);
  await done;

  const readsBySeriesKey = groupReadRowsBySeriesKey(reads);
  const series = seriesRows.map((row) => ({
    ...row,
    read: uniqueStrings(readsBySeriesKey[row.seriesKey] || row.read),
  }));

  return { series, chapters, reads, subscriptions, history, updates };
}

function hasLegacyLibraryData(raw: Record<string, unknown>) {
  return LEGACY_STORAGE_KEYS.some((key) => key in (raw || {}));
}

async function cleanupLegacyStorage() {
  await removeStorageItems(LEGACY_STORAGE_KEYS);
}

export async function emitLibrarySignal(
  source = "library",
  scopes: LibrarySignal["scopes"] = ["series", "subscriptions", "history", "updates"],
  seriesKeys?: string[],
) {
  const signal: LibrarySignal = {
    revision: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    changedAt: Date.now(),
    source,
    dbSchemaVersion: LIBRARY_DB_VERSION,
    scopes,
    ...(seriesKeys?.length ? { seriesKeys: uniqueStrings(seriesKeys) } : {}),
  };
  await setStorageItems({ [LIBRARY_SIGNAL_KEY]: signal });
}

export async function persistSnapshot(
  snapshot: LibrarySnapshotV2,
  options: {
    cleanupLegacy?: boolean;
    emitSignal?: boolean;
    signalSource?: string;
    scopes?: LibrarySignal["scopes"];
    seriesKeys?: string[];
  } = {},
) {
  const normalized = migrateV2(snapshot as LegacyStore);
  await writeRowsToDb(snapshotToRows(normalized), normalized.version);
  if (options.cleanupLegacy) {
    await cleanupLegacyStorage();
  }
  if (options.emitSignal !== false) {
    await emitLibrarySignal(
      options.signalSource || "library",
      options.scopes,
      options.seriesKeys,
    );
  }
  return normalized;
}

export async function ensureLibraryReady() {
  if (!libraryReadyPromise) {
    libraryReadyPromise = (async () => {
      const meta = await readMeta(LIBRARY_META_KEY);
      const initialized = Boolean(meta?.value?.initialized);
      if (initialized) {
        if (Number(meta?.value?.dbSchemaVersion || 0) < LIBRARY_DB_VERSION) {
          const rows = await readRowsFromDb();
          await writeRowsToDb(
            snapshotToRows(rowsToSnapshot(rows)),
            meta?.value?.version || getExtensionVersion(),
          );
        }
        return;
      }

      const raw = await getStorageSnapshot();
      const hasLegacy = hasLegacyLibraryData(raw);
      const snapshot = hasLegacy
        ? migrateLibrary(raw)
        : createEmptyLibrarySnapshot(getExtensionVersion());

      await persistSnapshot(snapshot, {
        cleanupLegacy: hasLegacy,
        emitSignal: false,
      });
    })().catch((error) => {
      libraryReadyPromise = null;
      throw error;
    });
  }
  return libraryReadyPromise;
}

function migrateV2(raw: LegacyStore): LibrarySnapshotV2 {
  const next = createEmptyLibrarySnapshot(raw.version || getExtensionVersion());
  next.seriesByKey = Object.entries(raw.seriesByKey || {}).reduce<
    Record<string, SeriesRecord>
  >((acc, [seriesKey, record]) => {
    const { site, comicsID } = parseSeriesKey(seriesKey);
    if (!SITE_KEYS.includes(site)) return acc;
    const normalized = normalizeSeriesRecord(site, comicsID, record);
    acc[buildSeriesKey(site, normalized.comicsID)] = normalized;
    return acc;
  }, {});
  next.subscriptions = uniqueStrings(raw.subscriptions).filter(
    (seriesKey) => !!next.seriesByKey[seriesKey],
  );
  next.history = uniqueStrings(raw.history, HISTORY_LIMIT).filter(
    (seriesKey) => !!next.seriesByKey[seriesKey],
  );
  next.updates = (Array.isArray(raw.updates) ? raw.updates : [])
    .map((item) => ({
      seriesKey: String(item?.seriesKey || ""),
      chapterID: String(item?.chapterID || ""),
      createdAt:
        typeof item?.createdAt === "number" ? item.createdAt : Date.now(),
    }))
    .filter(
      (item) =>
        !!item.seriesKey &&
        !!item.chapterID &&
        !!next.seriesByKey[item.seriesKey],
    );
  return next;
}

function migrateLegacy(raw: LegacyStore): LibrarySnapshotV2 {
  const next = createEmptyLibrarySnapshot(raw.version || getExtensionVersion());
  const seriesByKey: Record<string, SeriesRecord> = {};

  for (const site of SITE_KEYS) {
    const bucket = raw[site] || {};
    for (const [comicsID, record] of Object.entries(bucket)) {
      const normalized = normalizeSeriesRecord(site, comicsID, record);
      const key = buildSeriesKey(site, normalized.comicsID);
      seriesByKey[key] = normalized;
    }
  }

  const history = uniqueStrings(
    (raw.history || []).map((item) =>
      typeof item === "string"
        ? item
        : buildSeriesKey(String(item?.site || ""), String(item?.comicsID || "")),
    ),
    HISTORY_LIMIT,
  ).filter((seriesKey) => !!seriesByKey[seriesKey]);

  const subscriptions = uniqueStrings(
    (raw.subscribe || []).map((item) =>
      buildSeriesKey(String(item?.site || ""), String(item?.comicsID || "")),
    ),
  ).filter((seriesKey) => !!seriesByKey[seriesKey]);

  const updates = (Array.isArray(raw.update) ? raw.update : [])
    .map((item, index) => ({
      seriesKey: buildSeriesKey(
        String(item?.site || ""),
        String(item?.comicsID || ""),
      ),
      chapterID: String(item?.chapterID || ""),
      createdAt: Date.now() - index,
    }))
    .filter(
      (item) =>
        !!item.seriesKey &&
        !!item.chapterID &&
        !!seriesByKey[item.seriesKey],
    );

  return {
    ...next,
    seriesByKey,
    history,
    subscriptions,
    updates,
  };
}

export function migrateLibrary(raw: unknown) {
  const candidate =
    raw && typeof raw === "object" ? (raw as LegacyStore) : undefined;

  if (
    candidate?.schemaVersion === LIBRARY_SCHEMA_VERSION &&
    candidate.seriesByKey
  ) {
    return migrateV2(candidate);
  }
  return migrateLegacy(candidate || {});
}

export function isLibraryDumpV1(raw: unknown): raw is LibraryDumpV1 {
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const candidate = raw as Partial<LibraryDumpV1>;
  return (
    candidate.format === "comic-scroller-db-dump" &&
    candidate.formatVersion === 1 &&
    Boolean(candidate.data)
  );
}

export function migrateDump(data: LibraryDumpV1) {
  return rowsToSnapshot({
    series: Array.isArray(data.data?.series) ? data.data.series : [],
    chapters: Array.isArray(data.data?.chapters) ? data.data.chapters : [],
    subscriptions: Array.isArray(data.data?.subscriptions)
      ? data.data.subscriptions
      : [],
    history: Array.isArray(data.data?.history) ? data.data.history : [],
    updates: Array.isArray(data.data?.updates) ? data.data.updates : [],
  });
}

export function sortRowsByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position);
}

export function sortSubscriptionRowsByCheckedAt(rows: SubscriptionRow[]) {
  return [...rows].sort(
    (a, b) =>
      Number(a.checkedAt || 0) - Number(b.checkedAt || 0) ||
      a.position - b.position ||
      a.seriesKey.localeCompare(b.seriesKey),
  );
}

function hasIndex(store: IDBObjectStore, indexName: string) {
  if (typeof store.index !== "function") {
    return false;
  }
  if (!("indexNames" in store) || !store.indexNames) {
    return true;
  }
  return store.indexNames.contains(indexName);
}

async function readRowsFromCursor<T>(
  source: IDBObjectStore | IDBIndex,
  options: {
    limit?: number;
    direction?: IDBCursorDirection;
  } = {},
) {
  const { limit = Number.POSITIVE_INFINITY, direction = "next" } = options;
  return new Promise<T[]>((resolve, reject) => {
    const rows: T[] = [];
    const request = source.openCursor(undefined, direction);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(rows);
        return;
      }
      rows.push(cursor.value as T);
      if (rows.length >= limit) {
        resolve(rows);
        return;
      }
      cursor.continue();
    };
  });
}

export async function loadRowsByPositionInTransaction<T extends { position: number }>(
  store: IDBObjectStore,
) {
  if (hasIndex(store, "position")) {
    return readRowsFromCursor<T>(store.index("position"));
  }
  const rows = await requestToPromise<T[]>(store.getAll());
  return sortRowsByPosition(rows);
}

export async function loadSubscriptionKeysByCheckedAtInTransaction(
  store: IDBObjectStore,
  limit = Number.POSITIVE_INFINITY,
) {
  if (hasIndex(store, "checkedAtPosition")) {
    const rows = await readRowsFromCursor<SubscriptionRow>(store.index("checkedAtPosition"), {
      limit: Number.isFinite(limit) ? Math.max(0, limit) : Number.POSITIVE_INFINITY,
    });
    return rows.map((row) => row.seriesKey).filter(Boolean);
  }

  const rows = await requestToPromise<SubscriptionRow[]>(store.getAll());
  return sortSubscriptionRowsByCheckedAt(rows)
    .slice(0, Number.isFinite(limit) ? Math.max(0, limit) : rows.length)
    .map((row) => row.seriesKey)
    .filter(Boolean);
}

export function resolveSeriesKeyInput(siteOrSeriesKey: string, comicsID?: string) {
  if (typeof comicsID === "string") {
    return buildSeriesKey(siteOrSeriesKey, comicsID);
  }
  return String(siteOrSeriesKey || "");
}

export function composeSeriesRecord(
  row: SeriesRow,
  chapterRows: ChapterRow[],
  readChapterIDs: string[] = [],
) {
  const sortedChapters = [...chapterRows].sort((a, b) => a.orderIndex - b.orderIndex);
  const chapters = sortedChapters.reduce<Record<string, ChapterRecord>>((acc, chapterRow) => {
    acc[chapterRow.chapterID] = normalizeChapterRecord(chapterRow);
    return acc;
  }, {});

  return normalizeSeriesRecord(row.site, row.comicsID, {
    ...row,
    chapterList: sortedChapters.map((chapterRow) => chapterRow.chapterID),
    chapters,
    read: readChapterIDs.length > 0 ? readChapterIDs : row.read,
  });
}

function resolveSeriesRowSummary(
  record: SeriesRecord,
  input: {
    previousRow?: SeriesRow | null;
    readChapterRow?: ChapterRow | null;
  } = {},
) {
  const latestChapterID = record.chapterList[0] || input.previousRow?.latestChapterID || "";
  const latestChapter =
    (latestChapterID ? record.chapters[latestChapterID] : null) || null;
  const latestChapterTitle =
    latestChapter?.title ||
    (latestChapterID === input.previousRow?.latestChapterID
      ? input.previousRow.latestChapterTitle
      : "");
  const latestChapterHref =
    latestChapter?.href ||
    (latestChapterID === input.previousRow?.latestChapterID
      ? input.previousRow.latestChapterHref
      : "");

  const lastReadChapterID = record.lastRead || "";
  const readChapter =
    (input.readChapterRow ? normalizeChapterRecord(input.readChapterRow) : null) ||
    (lastReadChapterID ? record.chapters[lastReadChapterID] : null) ||
    (lastReadChapterID && lastReadChapterID === latestChapterID
      ? { title: latestChapterTitle, href: latestChapterHref }
      : null);
  const canReusePreviousLastRead = lastReadChapterID === input.previousRow?.lastRead;
  const lastReadTitle = lastReadChapterID
    ? readChapter?.title ||
      (canReusePreviousLastRead ? input.previousRow?.lastReadTitle || "" : "")
    : "";
  const lastReadHref = lastReadChapterID
    ? readChapter?.href ||
      (canReusePreviousLastRead ? input.previousRow?.lastReadHref || "" : "")
    : "";

  return {
    lastReadTitle,
    lastReadHref,
    latestChapterID,
    latestChapterTitle,
    latestChapterHref,
  };
}

export function createSeriesRow(
  seriesKey: string,
  record: SeriesRecord,
  input: {
    previousRow?: SeriesRow | null;
    readChapterRow?: ChapterRow | null;
  } = {},
): SeriesRow {
  return {
    seriesKey,
    site: record.site,
    comicsID: record.comicsID,
    title: record.title,
    cover: record.cover,
    url: record.url,
    lastRead: record.lastRead,
    ...resolveSeriesRowSummary(record, input),
  };
}

function createChapterRows(seriesKey: string, record: SeriesRecord): ChapterRow[] {
  return record.chapterList
    .filter(Boolean)
    .map((chapterID, orderIndex) => {
      const chapter = record.chapters[chapterID];
      return {
        seriesKey,
        chapterID,
        title: chapter?.title || "",
        href: chapter?.href || "",
        orderIndex,
      };
    });
}

function createReadRows(seriesKey: string, record: SeriesRecord): ReadRow[] {
  return uniqueStrings(record.read)
    .filter(Boolean)
    .map((chapterID) => ({
      seriesKey,
      chapterID,
    }));
}

export async function replaceSeriesChaptersInTransaction(
  chaptersStore: IDBObjectStore,
  seriesKey: string,
  record: SeriesRecord,
) {
  const chapterIndex = chaptersStore.index("seriesKey");
  const existingKeys = await requestToPromise<IDBValidKey[]>(
    chapterIndex.getAllKeys(seriesKey),
  );
  for (const key of existingKeys) {
    await requestToPromise(chaptersStore.delete(key));
  }
  for (const row of createChapterRows(seriesKey, record)) {
    await requestToPromise(chaptersStore.put(row));
  }
}

export async function loadReadChapterIDsInTransaction(
  readsStore: IDBObjectStore,
  seriesKey: string,
) {
  const readKeys = await requestToPromise<IDBValidKey[]>(
    readsStore.index("seriesKey").getAllKeys(seriesKey),
  );
  return uniqueStrings(
    readKeys.map((key) => {
      if (Array.isArray(key) && typeof key[1] === "string") {
        return key[1];
      }
      return "";
    }),
  ).filter(Boolean);
}

export async function replaceSeriesReadsInTransaction(
  readsStore: IDBObjectStore,
  seriesKey: string,
  record: SeriesRecord,
) {
  const existingKeys = await requestToPromise<IDBValidKey[]>(
    readsStore.index("seriesKey").getAllKeys(seriesKey),
  );
  for (const key of existingKeys) {
    await requestToPromise(readsStore.delete(key));
  }
  for (const row of createReadRows(seriesKey, record)) {
    await requestToPromise(readsStore.put(row));
  }
}

export async function addReadChapterInTransaction(
  readsStore: IDBObjectStore,
  seriesKey: string,
  chapterID: string,
) {
  if (!seriesKey || !chapterID) {
    return;
  }
  await requestToPromise(
    readsStore.put({
      seriesKey,
      chapterID,
    }),
  );
}

export async function loadOrderedSeriesKeysInTransaction(store: IDBObjectStore) {
  const rows = await loadRowsByPositionInTransaction<{ seriesKey: string; position: number }>(store);
  return rows.map((row) => row.seriesKey);
}

export async function loadOrderedSubscriptionRowsInTransaction(
  store: IDBObjectStore,
) {
  return loadRowsByPositionInTransaction<SubscriptionRow>(store);
}

export async function writeOrderedSeriesKeysInTransaction(
  store: IDBObjectStore,
  seriesKeys: string[],
  resolveRowData?: (seriesKey: string, position: number) => Record<string, unknown>,
) {
  await requestToPromise(store.clear());
  const nextSeriesKeys = uniqueStrings(seriesKeys);
  for (let position = 0; position < nextSeriesKeys.length; position += 1) {
    const seriesKey = nextSeriesKeys[position];
    await requestToPromise(
      store.put({
        seriesKey,
        position,
        ...(resolveRowData ? resolveRowData(seriesKey, position) : {}),
      }),
    );
  }
}

export async function loadUpdatesInTransaction(store: IDBObjectStore) {
  return loadRowsByPositionInTransaction<UpdateRow>(store);
}

export async function readSeriesSnapshotByKey(seriesKey: string) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([SERIES_STORE, CHAPTERS_STORE, READS_STORE], "readonly");
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  const readsStore = transaction.objectStore(READS_STORE);
  const row = await requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey));
  if (!row) {
    await done;
    return null;
  }
  const chapterRows = await requestToPromise<ChapterRow[]>(
    chaptersStore.index("seriesKey").getAll(seriesKey),
  );
  const readChapterIDs = await loadReadChapterIDsInTransaction(readsStore, seriesKey);
  await done;
  return composeSeriesRecord(row, chapterRows, readChapterIDs);
}
