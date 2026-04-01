import { storageGetAll, storageRemove, storageSet } from "./storage";

declare var chrome: any;

export const LIBRARY_SCHEMA_VERSION = 2;
export const LIBRARY_DB_VERSION = 1;
export const HISTORY_LIMIT = 50;
export const SITE_KEYS = ["dm5", "sf", "comicbus"] as const;
export const LIBRARY_SIGNAL_KEY = "librarySignal";

const LIBRARY_DB_NAME = "comic-scroller-library";
const META_STORE = "meta";
const SERIES_STORE = "series";
const CHAPTERS_STORE = "chapters";
const SUBSCRIPTIONS_STORE = "subscriptions";
const HISTORY_STORE = "history";
const UPDATES_STORE = "updates";
const LIBRARY_META_KEY = "library-state";
const LEGACY_STORAGE_KEYS = [
  "version",
  "history",
  "subscribe",
  "update",
  "dm5",
  "sf",
  "comicbus",
  "schemaVersion",
  "seriesByKey",
  "subscriptions",
  "updates",
];

export type SiteKey = (typeof SITE_KEYS)[number];
export type SeriesKey = string;

export type ChapterRecord = {
  title: string;
  href: string;
  chapter?: string;
};

export type SeriesRecord = {
  site: SiteKey;
  comicsID: string;
  title: string;
  cover: string;
  url: string;
  chapterList: string[];
  chapters: Record<string, ChapterRecord>;
  lastRead: string;
  read: string[];
};

export type LibraryUpdateRecord = {
  seriesKey: SeriesKey;
  chapterID: string;
  createdAt: number;
};

export type LibrarySnapshotV2 = {
  schemaVersion: 2;
  version: string;
  seriesByKey: Record<SeriesKey, SeriesRecord>;
  subscriptions: SeriesKey[];
  history: SeriesKey[];
  updates: LibraryUpdateRecord[];
};

export type SeriesRow = {
  seriesKey: SeriesKey;
  site: SiteKey;
  comicsID: string;
  title: string;
  cover: string;
  url: string;
  lastRead: string;
  read: string[];
  updatedAt: number;
};

export type ChapterRow = {
  seriesKey: SeriesKey;
  chapterID: string;
  title: string;
  href: string;
  chapter?: string;
  orderIndex: number;
};

export type SubscriptionRow = {
  seriesKey: SeriesKey;
  position: number;
};

export type HistoryRow = {
  seriesKey: SeriesKey;
  position: number;
};

export type UpdateRow = LibraryUpdateRecord & {
  position: number;
};

export type LibrarySignal = {
  revision: string;
  changedAt: number;
  source: string;
  dbSchemaVersion: number;
  scopes: Array<"series" | "subscriptions" | "history" | "updates">;
  seriesKeys?: string[];
};

export type LibraryDumpV1 = {
  format: "comic-scroller-db-dump";
  formatVersion: 1;
  exportedAt: number;
  dbSchemaVersion: number;
  data: {
    series: SeriesRow[];
    chapters: ChapterRow[];
    subscriptions: SubscriptionRow[];
    history: HistoryRow[];
    updates: UpdateRow[];
  };
};

type LegacyStore = {
  version?: string;
  history?: Array<{ site?: string; comicsID?: string }> | string[];
  subscribe?: Array<{ site?: string; comicsID?: string }>;
  update?: Array<{ site?: string; comicsID?: string; chapterID?: string }>;
  dm5?: Record<string, any>;
  sf?: Record<string, any>;
  comicbus?: Record<string, any>;
  schemaVersion?: number;
  seriesByKey?: Record<string, SeriesRecord>;
  subscriptions?: string[];
  updates?: LibraryUpdateRecord[];
};

type MetaRow = {
  key: string;
  value: any;
};

let dbPromise: Promise<IDBDatabase> | null = null;
let libraryReadyPromise: Promise<void> | null = null;

function getExtensionVersion() {
  try {
    return chrome?.runtime?.getManifest?.().version || "";
  } catch {
    return "";
  }
}

function getStorageSnapshot(): Promise<any> {
  return new Promise((resolve) => {
    storageGetAll((items) => resolve(items || {}));
  });
}

function setStorageItems(items: any): Promise<void> {
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

function uniqueStrings(input: any, limit = Number.POSITIVE_INFINITY) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of Array.isArray(input) ? input : []) {
    const value = String(item || "");
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeChapterRecord(chapter: any): ChapterRecord {
  return {
    title: typeof chapter?.title === "string" ? chapter.title : "",
    href: typeof chapter?.href === "string" ? chapter.href : "",
    ...(typeof chapter?.chapter === "string" ? { chapter: chapter.chapter } : {}),
  };
}

function normalizeSeriesRecord(site: SiteKey, comicsID: string, record: any): SeriesRecord {
  const normalizedComicsID = canonicalizeComicsID(site, comicsID);
  const normalizedChapterList = Array.isArray(record?.chapterList)
    ? record.chapterList.map((item: any) => String(item || "")).filter(Boolean)
    : [];
  const normalizedChapters = Object.entries(record?.chapters || {}).reduce<
    Record<string, ChapterRecord>
  >((acc, [chapterID, chapter]) => {
    const normalizedChapterID = String(chapterID || "");
    if (!normalizedChapterID) return acc;
    acc[normalizedChapterID] = normalizeChapterRecord(chapter);
    return acc;
  }, {});

  return {
    site,
    comicsID: normalizedComicsID,
    title: typeof record?.title === "string" ? record.title : "",
    cover: typeof record?.cover === "string" ? record.cover : "",
    url: typeof record?.url === "string" ? record.url : "",
    chapterList: normalizedChapterList,
    chapters: normalizedChapters,
    lastRead: typeof record?.lastRead === "string" ? record.lastRead : "",
    read: uniqueStrings(record?.read),
  };
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
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

function openLibraryDb() {
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

function snapshotToRows(snapshot: LibrarySnapshotV2) {
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

function rowsToSnapshot(input: {
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
      comicsID: canonicalizeComicsID(row.site, row.comicsID),
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

async function readRowsFromDb() {
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

function hasLegacyLibraryData(raw: any) {
  return LEGACY_STORAGE_KEYS.some((key) => key in (raw || {}));
}

async function cleanupLegacyStorage() {
  await removeStorageItems(LEGACY_STORAGE_KEYS);
}

async function emitLibrarySignal(
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

async function persistSnapshot(
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

async function ensureLibraryReady() {
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

export function canonicalizeComicsID(site: string, comicsID: string) {
  const raw = String(comicsID || "");
  if (!raw) return "";
  if (site === "dm5") {
    return raw.startsWith("m") ? raw : `m${raw}`;
  }
  return raw;
}

export function buildSeriesKey(site: string, comicsID: string) {
  return `${site}:${canonicalizeComicsID(site, comicsID)}`;
}

export function parseSeriesKey(seriesKey: string) {
  const [site, ...rest] = String(seriesKey || "").split(":");
  return {
    site: site as SiteKey,
    comicsID: rest.join(":"),
  };
}

export function createEmptyLibrarySnapshot(
  version = getExtensionVersion(),
): LibrarySnapshotV2 {
  return {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    version,
    seriesByKey: {},
    subscriptions: [],
    history: [],
    updates: [],
  };
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
    (raw.history || []).map((item: any) =>
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

export function migrateLibrary(raw: LegacyStore | undefined | null) {
  if (raw?.schemaVersion === LIBRARY_SCHEMA_VERSION && raw.seriesByKey) {
    return migrateV2(raw);
  }
  return migrateLegacy(raw || {});
}

function isLibraryDumpV1(raw: any): raw is LibraryDumpV1 {
  return (
    raw?.format === "comic-scroller-db-dump" &&
    raw?.formatVersion === 1 &&
    raw?.data
  );
}

function migrateDump(data: LibraryDumpV1) {
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

function sortRowsByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position);
}

function resolveSeriesKeyInput(siteOrSeriesKey: string, comicsID?: string) {
  if (typeof comicsID === "string") {
    return buildSeriesKey(siteOrSeriesKey, comicsID);
  }
  return String(siteOrSeriesKey || "");
}

function composeSeriesRecord(row: SeriesRow, chapterRows: ChapterRow[]) {
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

function createSeriesRow(
  seriesKey: string,
  record: SeriesRecord,
  previous?: SeriesRow | null,
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
    ...(previous?.updatedAt ? { updatedAt: Date.now() } : {}),
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
        ...(chapter?.chapter ? { chapter: chapter.chapter } : {}),
        orderIndex,
      };
    });
}

async function replaceSeriesChaptersInTransaction(
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

async function loadOrderedSeriesKeysInTransaction(store: IDBObjectStore) {
  const rows = await requestToPromise<Array<{ seriesKey: string; position: number }>>(
    store.getAll(),
  );
  return sortRowsByPosition(rows).map((row) => row.seriesKey);
}

async function writeOrderedSeriesKeysInTransaction(
  store: IDBObjectStore,
  seriesKeys: string[],
) {
  await requestToPromise(store.clear());
  const nextSeriesKeys = uniqueStrings(seriesKeys);
  for (let position = 0; position < nextSeriesKeys.length; position += 1) {
    const seriesKey = nextSeriesKeys[position];
    await requestToPromise(store.put({ seriesKey, position }));
  }
}

async function loadUpdatesInTransaction(store: IDBObjectStore) {
  const rows = await requestToPromise<UpdateRow[]>(store.getAll());
  return sortRowsByPosition(rows);
}

async function writeUpdatesInTransaction(store: IDBObjectStore, updates: LibraryUpdateRecord[]) {
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

async function readSeriesSnapshotByKey(seriesKey: string) {
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

export async function getUpdateCount() {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([UPDATES_STORE], "readonly");
  const done = transactionDone(transaction);
  const updatesStore = transaction.objectStore(UPDATES_STORE);
  const count = await requestToPromise<number>(updatesStore.count());
  await done;
  return Number(count || 0);
}

async function persistSeriesRecordState(
  site: SiteKey,
  comicsID: string,
  input: {
    record?: Partial<SeriesRecord>;
    readChapterID?: string;
    addHistory?: boolean;
    dismissChapterID?: string;
    includeSubscriptionState?: boolean;
  },
) {
  await ensureLibraryReady();
  const seriesKey = buildSeriesKey(site, comicsID);
  const db = await openLibraryDb();
  const transaction = db.transaction(
    [SERIES_STORE, CHAPTERS_STORE, HISTORY_STORE, UPDATES_STORE, SUBSCRIPTIONS_STORE],
    "readwrite",
  );
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  const historyStore = transaction.objectStore(HISTORY_STORE);
  const updatesStore = transaction.objectStore(UPDATES_STORE);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);

  const previousRow = await requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey));
  const previousChapters = previousRow
    ? await requestToPromise<ChapterRow[]>(chaptersStore.index("seriesKey").getAll(seriesKey))
    : [];
  const previousRecord = previousRow
    ? composeSeriesRecord(previousRow, previousChapters)
    : normalizeSeriesRecord(site, comicsID, {});

  const mergedRecord = normalizeSeriesRecord(site, comicsID, {
    ...previousRecord,
    ...(input.record || {}),
  });

  if (input.readChapterID) {
    mergedRecord.lastRead = input.readChapterID;
    mergedRecord.read = uniqueStrings([...(mergedRecord.read || []), input.readChapterID]);
  }

  await requestToPromise(seriesStore.put(createSeriesRow(seriesKey, mergedRecord, previousRow)));
  await replaceSeriesChaptersInTransaction(chaptersStore, seriesKey, mergedRecord);

  if (input.addHistory) {
    const historyKeys = await loadOrderedSeriesKeysInTransaction(historyStore);
    await writeOrderedSeriesKeysInTransaction(
      historyStore,
      uniqueStrings([seriesKey, ...historyKeys], HISTORY_LIMIT),
    );
  }

  if (input.dismissChapterID) {
    const updates = await loadUpdatesInTransaction(updatesStore);
    await writeUpdatesInTransaction(
      updatesStore,
      updates
        .map(({ seriesKey: currentSeriesKey, chapterID, createdAt }) => ({
          seriesKey: currentSeriesKey,
          chapterID,
          createdAt,
        }))
        .filter(
          (item) =>
            item.seriesKey !== seriesKey || item.chapterID !== input.dismissChapterID,
        ),
    );
  }

  const updatesCount = await requestToPromise<number>(updatesStore.count());
  const subscribed = input.includeSubscriptionState
    ? Boolean(await requestToPromise(subscriptionsStore.get(seriesKey)))
    : false;

  await done;
  await emitLibrarySignal(
    "seriesMutation",
    ["series", ...(input.addHistory ? ["history" as const] : []), ...(input.dismissChapterID ? ["updates" as const] : [])],
    [seriesKey],
  );

  return {
    seriesKey,
    series: mergedRecord,
    subscribed,
    updatesCount: Number(updatesCount || 0),
  };
}

async function rewriteUpdatesForSeries(
  site: SiteKey,
  comicsID: string,
  updater: (updates: LibraryUpdateRecord[], seriesKey: string) => LibraryUpdateRecord[],
  source: string,
) {
  await ensureLibraryReady();
  const seriesKey = buildSeriesKey(site, comicsID);
  const db = await openLibraryDb();
  const transaction = db.transaction([UPDATES_STORE], "readwrite");
  const done = transactionDone(transaction);
  const updatesStore = transaction.objectStore(UPDATES_STORE);
  const updates = await loadUpdatesInTransaction(updatesStore);
  const normalizedUpdates = updates.map(({ seriesKey: currentSeriesKey, chapterID, createdAt }) => ({
    seriesKey: currentSeriesKey,
    chapterID,
    createdAt,
  }));
  const nextUpdates = updater(normalizedUpdates, seriesKey);
  await writeUpdatesInTransaction(updatesStore, nextUpdates);
  const updatesCount = await requestToPromise<number>(updatesStore.count());
  await done;
  await emitLibrarySignal(source, ["updates"], [seriesKey]);
  return Number(updatesCount || 0);
}

async function rewriteOrderedSeriesStore(
  storeName: typeof SUBSCRIPTIONS_STORE | typeof HISTORY_STORE,
  seriesKey: string,
  updater: (seriesKeys: string[]) => string[],
  source: string,
  scope: "subscriptions" | "history",
) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([storeName], "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(storeName);
  const currentKeys = await loadOrderedSeriesKeysInTransaction(store);
  await writeOrderedSeriesKeysInTransaction(store, updater(currentKeys));
  await done;
  await emitLibrarySignal(source, [scope], [seriesKey]);
}

export async function loadLibrary() {
  await ensureLibraryReady();
  return rowsToSnapshot(await readRowsFromDb());
}

export async function saveLibrary(snapshot: LibrarySnapshotV2) {
  await ensureLibraryReady();
  return persistSnapshot(snapshot, {
    cleanupLegacy: true,
    emitSignal: true,
    signalSource: "saveLibrary",
    scopes: ["series", "subscriptions", "history", "updates"],
    seriesKeys: Object.keys(snapshot.seriesByKey || {}),
  });
}

export async function resetLibrary() {
  await ensureLibraryReady();
  const initial = createEmptyLibrarySnapshot();
  return persistSnapshot(initial, {
    cleanupLegacy: true,
    emitSignal: true,
    signalSource: "resetLibrary",
    scopes: ["series", "subscriptions", "history", "updates"],
  });
}

export async function updateLibrary(
  updater: (snapshot: LibrarySnapshotV2) => LibrarySnapshotV2,
) {
  const current = await loadLibrary();
  const next = updater(current);
  return saveLibrary(next);
}

export async function exportLibraryDump(): Promise<LibraryDumpV1> {
  const snapshot = await loadLibrary();
  return {
    format: "comic-scroller-db-dump",
    formatVersion: 1,
    exportedAt: Date.now(),
    dbSchemaVersion: LIBRARY_DB_VERSION,
    data: snapshotToRows(snapshot),
  };
}

export async function importLibraryDump(raw: any) {
  const snapshot = isLibraryDumpV1(raw) ? migrateDump(raw) : migrateLibrary(raw);
  return persistSnapshot(snapshot, {
    cleanupLegacy: true,
    emitSignal: true,
    signalSource: "importLibrary",
    scopes: ["series", "subscriptions", "history", "updates"],
    seriesKeys: Object.keys(snapshot.seriesByKey || {}),
  });
}

export async function getSeriesSnapshot(siteOrSeriesKey: string, comicsID?: string) {
  const seriesKey = resolveSeriesKeyInput(siteOrSeriesKey, comicsID);
  return readSeriesSnapshotByKey(seriesKey);
}

export async function getSeriesMeta(siteOrSeriesKey: string, comicsID?: string) {
  return getSeriesSnapshot(siteOrSeriesKey, comicsID);
}

export async function isSeriesSubscribedByKey(seriesKey: string) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([SUBSCRIPTIONS_STORE], "readonly");
  const done = transactionDone(transaction);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const row = await requestToPromise(subscriptionsStore.get(seriesKey));
  await done;
  return Boolean(row);
}

export async function listSubscriptionKeys() {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([SUBSCRIPTIONS_STORE], "readonly");
  const done = transactionDone(transaction);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const seriesKeys = await loadOrderedSeriesKeysInTransaction(subscriptionsStore);
  await done;
  return seriesKeys;
}

export async function findExistingSeriesKey(comicsID: string, preferredSite?: string) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([SERIES_STORE], "readonly");
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const candidates = preferredSite
    ? [preferredSite, ...SITE_KEYS.filter((site) => site !== preferredSite)]
    : [...SITE_KEYS];

  for (const candidate of candidates) {
    const candidateKey = buildSeriesKey(candidate, comicsID);
    const row = await requestToPromise(seriesStore.get(candidateKey));
    if (row) {
      await done;
      return candidateKey;
    }
  }

  await done;
  return "";
}

export async function getPopupFeedSnapshot() {
  await ensureLibraryReady();
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

  const [subscriptions, history, updates] = await Promise.all([
    requestToPromise<SubscriptionRow[]>(subscriptionsStore.getAll()),
    requestToPromise<HistoryRow[]>(historyStore.getAll()),
    requestToPromise<UpdateRow[]>(updatesStore.getAll()),
  ]);

  const referencedKeys = uniqueStrings([
    ...sortRowsByPosition(subscriptions).map((row) => row.seriesKey),
    ...sortRowsByPosition(history).map((row) => row.seriesKey),
    ...sortRowsByPosition(updates).map((row) => row.seriesKey),
  ]);

  const seriesRows: SeriesRow[] = [];
  const chapterRows: ChapterRow[] = [];
  for (const seriesKey of referencedKeys) {
    const row = await requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey));
    if (!row) continue;
    seriesRows.push(row);
    chapterRows.push(
      ...(await requestToPromise<ChapterRow[]>(chaptersStore.index("seriesKey").getAll(seriesKey))),
    );
  }

  await done;

  return rowsToSnapshot({
    series: seriesRows,
    chapters: chapterRows,
    subscriptions,
    history,
    updates,
  });
}

export async function upsertSeriesWithChapters(
  site: SiteKey,
  comicsID: string,
  record: Partial<SeriesRecord>,
) {
  return persistSeriesRecordState(site, comicsID, { record });
}

export async function markSeriesRead(site: SiteKey, comicsID: string, chapterID: string) {
  return persistSeriesRecordState(site, comicsID, { readChapterID: chapterID });
}

export async function recordHistory(site: SiteKey, comicsID: string) {
  const seriesKey = buildSeriesKey(site, comicsID);
  await rewriteOrderedSeriesStore(
    HISTORY_STORE,
    seriesKey,
    (seriesKeys) => uniqueStrings([seriesKey, ...seriesKeys], HISTORY_LIMIT),
    "recordHistory",
    "history",
  );
}

export async function setSeriesSubscriptionByKey(seriesKey: string, subscribed: boolean) {
  await rewriteOrderedSeriesStore(
    SUBSCRIPTIONS_STORE,
    seriesKey,
    (seriesKeys) =>
      subscribed
        ? uniqueStrings([seriesKey, ...seriesKeys])
        : seriesKeys.filter((item) => item !== seriesKey),
    "setSubscription",
    "subscriptions",
  );
  return subscribed;
}

export async function setSeriesSubscription(
  site: SiteKey,
  comicsID: string,
  subscribed: boolean,
) {
  return setSeriesSubscriptionByKey(buildSeriesKey(site, comicsID), subscribed);
}

export async function dismissSeriesUpdate(
  site: SiteKey,
  comicsID: string,
  chapterID?: string,
) {
  return rewriteUpdatesForSeries(
    site,
    comicsID,
    (updates, seriesKey) =>
      updates.filter(
        (item) => item.seriesKey !== seriesKey || (chapterID && item.chapterID !== chapterID),
      ),
    "dismissUpdate",
  );
}

export async function prependSeriesUpdate(
  site: SiteKey,
  comicsID: string,
  chapterID: string,
) {
  return rewriteUpdatesForSeries(
    site,
    comicsID,
    (updates, seriesKey) => [
      {
        seriesKey,
        chapterID,
        createdAt: Date.now(),
      },
      ...updates.filter(
        (item) => item.seriesKey !== seriesKey || item.chapterID !== chapterID,
      ),
    ],
    "prependUpdate",
  );
}

export async function removeSeriesCascade(site: SiteKey, comicsID: string) {
  await ensureLibraryReady();
  const seriesKey = buildSeriesKey(site, comicsID);
  const db = await openLibraryDb();
  const transaction = db.transaction(
    [SERIES_STORE, CHAPTERS_STORE, SUBSCRIPTIONS_STORE, HISTORY_STORE, UPDATES_STORE],
    "readwrite",
  );
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const historyStore = transaction.objectStore(HISTORY_STORE);
  const updatesStore = transaction.objectStore(UPDATES_STORE);

  await requestToPromise(seriesStore.delete(seriesKey));
  const chapterKeys = await requestToPromise<IDBValidKey[]>(
    chaptersStore.index("seriesKey").getAllKeys(seriesKey),
  );
  for (const key of chapterKeys) {
    await requestToPromise(chaptersStore.delete(key));
  }

  await writeOrderedSeriesKeysInTransaction(
    subscriptionsStore,
    (await loadOrderedSeriesKeysInTransaction(subscriptionsStore)).filter(
      (item) => item !== seriesKey,
    ),
  );
  await writeOrderedSeriesKeysInTransaction(
    historyStore,
    (await loadOrderedSeriesKeysInTransaction(historyStore)).filter(
      (item) => item !== seriesKey,
    ),
  );
  await writeUpdatesInTransaction(
    updatesStore,
    (await loadUpdatesInTransaction(updatesStore))
      .map(({ seriesKey: currentSeriesKey, chapterID, createdAt }) => ({
        seriesKey: currentSeriesKey,
        chapterID,
        createdAt,
      }))
      .filter((item) => item.seriesKey !== seriesKey),
  );
  const updatesCount = await requestToPromise<number>(updatesStore.count());
  await done;
  await emitLibrarySignal(
    "removeSeries",
    ["series", "subscriptions", "history", "updates"],
    [seriesKey],
  );
  return Number(updatesCount || 0);
}

export async function applyReaderSeriesState(
  site: SiteKey,
  comicsID: string,
  record: Partial<SeriesRecord>,
  chapterID: string,
) {
  return persistSeriesRecordState(site, comicsID, {
    record,
    readChapterID: chapterID,
    addHistory: true,
    dismissChapterID: chapterID,
    includeSubscriptionState: true,
  });
}

export async function applyReadProgress(site: SiteKey, comicsID: string, chapterID: string) {
  return persistSeriesRecordState(site, comicsID, {
    readChapterID: chapterID,
    dismissChapterID: chapterID,
  });
}

export async function applyBackgroundSeriesRefresh(
  site: SiteKey,
  comicsID: string,
  record: Partial<SeriesRecord>,
  newChapterIDs: string[],
) {
  await ensureLibraryReady();
  const seriesKey = buildSeriesKey(site, comicsID);
  const db = await openLibraryDb();
  const transaction = db.transaction([SERIES_STORE, CHAPTERS_STORE, UPDATES_STORE], "readwrite");
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  const updatesStore = transaction.objectStore(UPDATES_STORE);

  const previousRow = await requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey));
  const previousChapters = previousRow
    ? await requestToPromise<ChapterRow[]>(chaptersStore.index("seriesKey").getAll(seriesKey))
    : [];
  const previousRecord = previousRow
    ? composeSeriesRecord(previousRow, previousChapters)
    : normalizeSeriesRecord(site, comicsID, {});
  const mergedRecord = normalizeSeriesRecord(site, comicsID, {
    ...previousRecord,
    ...(record || {}),
  });

  await requestToPromise(seriesStore.put(createSeriesRow(seriesKey, mergedRecord, previousRow)));
  await replaceSeriesChaptersInTransaction(chaptersStore, seriesKey, mergedRecord);

  const existingUpdates = await loadUpdatesInTransaction(updatesStore);
  const nextUpdates = [
    ...uniqueStrings(newChapterIDs)
      .filter(Boolean)
      .map((chapterID) => ({
        seriesKey,
        chapterID,
        createdAt: Date.now(),
      })),
    ...existingUpdates
      .map(({ seriesKey: currentSeriesKey, chapterID, createdAt }) => ({
        seriesKey: currentSeriesKey,
        chapterID,
        createdAt,
      }))
      .filter(
        (item) =>
          item.seriesKey !== seriesKey || !newChapterIDs.includes(item.chapterID),
      ),
  ];
  await writeUpdatesInTransaction(updatesStore, nextUpdates);
  const updatesCount = await requestToPromise<number>(updatesStore.count());
  await done;
  await emitLibrarySignal("backgroundRefresh", ["series", "updates"], [seriesKey]);
  return {
    series: mergedRecord,
    updatesCount: Number(updatesCount || 0),
  };
}

export function subscribeToLibrarySignal(listener: (signal: LibrarySignal) => void) {
  const onChanged = chrome?.storage?.onChanged;
  if (!onChanged?.addListener || !onChanged?.removeListener) {
    return () => undefined;
  }
  const handleChange = (changes: any, areaName: string) => {
    if (areaName !== "local" || !changes?.[LIBRARY_SIGNAL_KEY]?.newValue) return;
    listener(changes[LIBRARY_SIGNAL_KEY].newValue as LibrarySignal);
  };
  onChanged.addListener(handleChange);
  return () => onChanged.removeListener(handleChange);
}

export function subscribeToLibraryChanges(
  listener: (snapshot: LibrarySnapshotV2) => void,
) {
  return subscribeToLibrarySignal(async () => {
    listener(await loadLibrary());
  });
}

export function getSeries(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
) {
  return snapshot.seriesByKey[buildSeriesKey(site, comicsID)] || null;
}

export function isSubscribed(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
) {
  return snapshot.subscriptions.includes(buildSeriesKey(site, comicsID));
}

export function upsertSeries(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
  record: Partial<SeriesRecord>,
) {
  const key = buildSeriesKey(site, comicsID);
  const previous = snapshot.seriesByKey[key];
  const nextRecord = normalizeSeriesRecord(site as SiteKey, comicsID, {
    ...previous,
    ...record,
  });
  return {
    ...snapshot,
    seriesByKey: {
      ...snapshot.seriesByKey,
      [key]: nextRecord,
    },
  };
}

export function addHistoryEntry(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
) {
  const key = buildSeriesKey(site, comicsID);
  return {
    ...snapshot,
    history: uniqueStrings([key, ...snapshot.history], HISTORY_LIMIT),
  };
}

export function setSubscription(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
  subscribed: boolean,
) {
  const key = buildSeriesKey(site, comicsID);
  return {
    ...snapshot,
    subscriptions: subscribed
      ? uniqueStrings([key, ...snapshot.subscriptions])
      : snapshot.subscriptions.filter((item) => item !== key),
  };
}

export function dismissUpdate(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
  chapterID?: string,
) {
  const key = buildSeriesKey(site, comicsID);
  return {
    ...snapshot,
    updates: snapshot.updates.filter(
      (item) =>
        item.seriesKey !== key || (chapterID && item.chapterID !== chapterID),
    ),
  };
}

export function prependUpdate(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
  chapterID: string,
) {
  const key = buildSeriesKey(site, comicsID);
  const nextItem = {
    seriesKey: key,
    chapterID,
    createdAt: Date.now(),
  };
  return {
    ...snapshot,
    updates: [
      nextItem,
      ...snapshot.updates.filter(
        (item) => item.seriesKey !== key || item.chapterID !== chapterID,
      ),
    ],
  };
}

export function removeSeries(snapshot: LibrarySnapshotV2, site: string, comicsID: string) {
  const key = buildSeriesKey(site, comicsID);
  const nextSeriesByKey = { ...snapshot.seriesByKey };
  delete nextSeriesByKey[key];
  return {
    ...snapshot,
    seriesByKey: nextSeriesByKey,
    history: snapshot.history.filter((item) => item !== key),
    subscriptions: snapshot.subscriptions.filter((item) => item !== key),
    updates: snapshot.updates.filter((item) => item.seriesKey !== key),
  };
}

export function updateSeriesReadProgress(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
  chapterID: string,
) {
  const current = getSeries(snapshot, site, comicsID);
  if (!current) return snapshot;
  return upsertSeries(snapshot, site, comicsID, {
    ...current,
    lastRead: chapterID,
    read: uniqueStrings([...(current.read || []), chapterID]),
  });
}
