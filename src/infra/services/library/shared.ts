import { storageClear, storageGetAll, storageRemove, storageSet } from "../storage";
import type {
  ChapterRecord,
  ChapterRow,
  LibraryDumpV1,
  LibrarySignal,
  LibrarySnapshotV2,
  LibraryUpdateRecord,
  SeriesRecord,
  SeriesRow,
  SubscriptionRow,
  UpdateRow,
  HistoryRow,
} from "./schema";
import {
  CHAPTERS_STORE,
  HISTORY_LIMIT,
  HISTORY_STORE,
  LEGACY_STORAGE_KEYS,
  LIBRARY_DB_NAME,
  LIBRARY_DB_VERSION,
  LIBRARY_META_KEY,
  LIBRARY_SCHEMA_VERSION,
  LIBRARY_SIGNAL_KEY,
  META_STORE,
  SERIES_STORE,
  SITE_KEYS,
  SUBSCRIPTIONS_STORE,
  UPDATES_STORE,
  buildSeriesKey,
  createEmptyLibrarySnapshot,
  getExtensionVersion,
  normalizeChapterRecord,
  normalizeSeriesRecord,
  parseSeriesKey,
  uniqueStrings,
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

function clearStorageItems(): Promise<void> {
  return new Promise((resolve) => {
    storageClear(() => resolve());
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
        if (!db.objectStoreNames.contains(SUBSCRIPTIONS_STORE)) {
          const subscriptions = db.createObjectStore(SUBSCRIPTIONS_STORE, {
            keyPath: "seriesKey",
          });
          subscriptions.createIndex("position", "position", { unique: false });
        }
        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          const history = db.createObjectStore(HISTORY_STORE, {
            keyPath: "seriesKey",
          });
          history.createIndex("position", "position", { unique: false });
        }
        if (!db.objectStoreNames.contains(UPDATES_STORE)) {
          const updates = db.createObjectStore(UPDATES_STORE, {
            keyPath: ["seriesKey", "chapterID"],
          });
          updates.createIndex("position", "position", { unique: false });
          updates.createIndex("createdAt", "createdAt", { unique: false });
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

async function isLibraryInitialized() {
  const row = await readMeta(LIBRARY_META_KEY);
  return Boolean(row?.value?.initialized);
}

export function snapshotToRows(snapshot: LibrarySnapshotV2) {
  const series: SeriesRow[] = [];
  const chapters: ChapterRow[] = [];

  Object.entries(snapshot.seriesByKey || {}).forEach(([seriesKey, record]) => {
    const normalized = normalizeSeriesRecord(record.site, record.comicsID, record);
    series.push({
      seriesKey,
      site: normalized.site,
      comicsID: normalized.comicsID,
      title: normalized.title,
      cover: normalized.cover,
      url: normalized.url,
      lastRead: normalized.lastRead,
      read: uniqueStrings(normalized.read),
      updatedAt: Date.now(),
    });
    normalized.chapterList.forEach((chapterID, orderIndex) => {
      if (!chapterID) return;
      const chapter = normalized.chapters[chapterID];
      chapters.push({
        seriesKey,
        chapterID,
        title: chapter?.title || "",
        href: chapter?.href || "",
        ...(chapter?.chapter ? { chapter: chapter.chapter } : {}),
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

export function rowsToSnapshot(input: {
  series: SeriesRow[];
  chapters: ChapterRow[];
  subscriptions: SubscriptionRow[];
  history: HistoryRow[];
  updates: UpdateRow[];
}) {
  const snapshot = createEmptyLibrarySnapshot();

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
      read: uniqueStrings(row.read),
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

export async function writeRowsToDb(
  rows: ReturnType<typeof snapshotToRows>,
  version = getExtensionVersion(),
) {
  const db = await openLibraryDb();
  const transaction = db.transaction(
    [
      META_STORE,
      SERIES_STORE,
      CHAPTERS_STORE,
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
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const historyStore = transaction.objectStore(HISTORY_STORE);
  const updatesStore = transaction.objectStore(UPDATES_STORE);

  await Promise.all([
    requestToPromise(metaStore.clear()),
    requestToPromise(seriesStore.clear()),
    requestToPromise(chaptersStore.clear()),
    requestToPromise(subscriptionsStore.clear()),
    requestToPromise(historyStore.clear()),
    requestToPromise(updatesStore.clear()),
  ]);

  for (const row of rows.series) {
    await requestToPromise(seriesStore.put(row));
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
    [SERIES_STORE, CHAPTERS_STORE, SUBSCRIPTIONS_STORE, HISTORY_STORE, UPDATES_STORE],
    "readonly",
  );
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const historyStore = transaction.objectStore(HISTORY_STORE);
  const updatesStore = transaction.objectStore(UPDATES_STORE);

  const [series, chapters, subscriptions, history, updates] = await Promise.all([
    requestToPromise<SeriesRow[]>(seriesStore.getAll()),
    requestToPromise<ChapterRow[]>(chaptersStore.getAll()),
    requestToPromise<SubscriptionRow[]>(subscriptionsStore.getAll()),
    requestToPromise<HistoryRow[]>(historyStore.getAll()),
    requestToPromise<UpdateRow[]>(updatesStore.getAll()),
  ]);
  await done;

  return { series, chapters, subscriptions, history, updates };
}

function hasLegacyLibraryData(raw: Record<string, unknown>) {
  return LEGACY_STORAGE_KEYS.some((key) => key in (raw || {}));
}

export async function cleanupLegacyStorage() {
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
      const initialized = await isLibraryInitialized();
      if (initialized) return;

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

export async function resetLibraryPersistenceForTests() {
  libraryReadyPromise = null;
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // Ignore stale connection errors while resetting the test harness.
    }
  }
  dbPromise = null;

  if (typeof indexedDB !== "undefined") {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(LIBRARY_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Library IndexedDB delete was blocked during tests."));
    });
  }

  await clearStorageItems();
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

export function resolveSeriesKeyInput(siteOrSeriesKey: string, comicsID?: string) {
  if (typeof comicsID === "string") {
    return buildSeriesKey(siteOrSeriesKey, comicsID);
  }
  return String(siteOrSeriesKey || "");
}

export function composeSeriesRecord(row: SeriesRow, chapterRows: ChapterRow[]) {
  const sortedChapters = [...chapterRows].sort((a, b) => a.orderIndex - b.orderIndex);
  const chapters = sortedChapters.reduce<Record<string, ChapterRecord>>((acc, chapterRow) => {
    acc[chapterRow.chapterID] = normalizeChapterRecord(chapterRow);
    return acc;
  }, {});

  return normalizeSeriesRecord(row.site, row.comicsID, {
    ...row,
    chapterList: sortedChapters.map((chapterRow) => chapterRow.chapterID),
    chapters,
  });
}

export function createSeriesRow(
  seriesKey: string,
  record: SeriesRecord,
): SeriesRow {
  return {
    seriesKey,
    site: record.site,
    comicsID: record.comicsID,
    title: record.title,
    cover: record.cover,
    url: record.url,
    lastRead: record.lastRead,
    read: uniqueStrings(record.read),
    updatedAt: Date.now(),
  };
}

export function createChapterRows(seriesKey: string, record: SeriesRecord): ChapterRow[] {
  return record.chapterList
    .filter(Boolean)
    .map((chapterID, orderIndex) => {
      const chapter = record.chapters[chapterID];
      return {
        seriesKey,
        chapterID,
        title: chapter?.title || "",
        href: chapter?.href || "",
        ...(chapter?.chapter ? { chapter: chapter.chapter } : {}),
        orderIndex,
      };
    });
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

export async function loadOrderedSeriesKeysInTransaction(store: IDBObjectStore) {
  const rows = await requestToPromise<Array<{ seriesKey: string; position: number }>>(
    store.getAll(),
  );
  return sortRowsByPosition(rows).map((row) => row.seriesKey);
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
  const rows = await requestToPromise<UpdateRow[]>(store.getAll());
  return sortRowsByPosition(rows);
}

export async function writeUpdatesInTransaction(
  store: IDBObjectStore,
  updates: LibraryUpdateRecord[],
) {
  await requestToPromise(store.clear());
  for (let position = 0; position < updates.length; position += 1) {
    const item = updates[position];
    await requestToPromise(
      store.put({
        seriesKey: item.seriesKey,
        chapterID: item.chapterID,
        createdAt: item.createdAt,
        position,
      }),
    );
  }
}

export async function readSeriesSnapshotByKey(seriesKey: string) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([SERIES_STORE, CHAPTERS_STORE], "readonly");
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  const row = await requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey));
  if (!row) {
    await done;
    return null;
  }
  const chapterRows = await requestToPromise<ChapterRow[]>(
    chaptersStore.index("seriesKey").getAll(seriesKey),
  );
  await done;
  return composeSeriesRecord(row, chapterRows);
}
