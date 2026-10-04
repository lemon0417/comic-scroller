import { storageGetAll, storageRemove, storageSet } from "../storage";
import {
  type LibraryMetaRow,
  openLibraryDb,
  readLibraryMeta,
  requestToPromise,
  transactionDone,
} from "./db";
import {
  composeSeriesRecord,
  createChapterRows,
  createReadRows,
  createSeriesRow,
  loadReadChapterIDsInTransaction,
} from "./rows";
import type {
  ChapterRecord,
  ChapterRow,
  HistoryRow,
  LibraryDbRows,
  LibraryDumpChapterV2,
  LibraryDumpRowsV1,
  LibraryDumpRowsV2,
  LibraryDumpSeriesRow,
  LibraryDumpSubscriptionRow,
  LibraryDumpV1,
  LibraryDumpV2,
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

export {
  openLibraryDb,
  requestToPromise,
  transactionDone,
} from "./db";
export {
  addReadChapterInTransaction,
  composeSeriesRecord,
  createSeriesRow,
  loadOrderedSeriesKeysInTransaction,
  loadOrderedSubscriptionRowsInTransaction,
  loadReadChapterIDsInTransaction,
  loadRowsByPositionInTransaction,
  loadSubscriptionKeysByCheckedAtInTransaction,
  loadUpdatesInTransaction,
  replaceSeriesChaptersInTransaction,
  replaceSeriesReadsInTransaction,
  resolveSeriesKeyInput,
  sortRowsByPosition,
  sortSubscriptionRowsByCheckedAt,
  writeOrderedSeriesKeysInTransaction,
} from "./rows";

type LegacyStore = {
  version?: string;
  history?: Array<{ site?: string; comicsID?: string }> | string[];
  subscribe?: Array<{ site?: string; comicsID?: string }>;
  update?: Array<{ site?: string; comicsID?: string; chapterID?: string }>;
  dm5?: Record<string, unknown>;
  comicbus?: Record<string, unknown>;
  manhuagui?: Record<string, unknown>;
  schemaVersion?: number;
  seriesByKey?: Record<string, SeriesRecord>;
  subscriptions?: string[];
  updates?: LibraryUpdateRecord[];
};

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

function normalizeCheckedAt(input: unknown) {
  const value = Number(input || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function getSubscriptionCheckedAtByKey(
  rows: Array<{ seriesKey: string; checkedAt?: number }>,
) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    if (row.seriesKey) {
      acc[row.seriesKey] = normalizeCheckedAt(row.checkedAt);
    }
    return acc;
  }, {});
}

export function snapshotToDbRows(
  snapshot: LibrarySnapshotV2,
  subscriptionCheckedAtByKey: Record<string, number> = {},
): LibraryDbRows {
  const series: SeriesRow[] = [];
  const chapters: ChapterRow[] = [];
  const reads: ReadRow[] = [];

  Object.entries(snapshot.seriesByKey || {}).forEach(([seriesKey, record]) => {
    const normalized = normalizeSeriesRecord(record.site, record.comicsID, record);
    series.push(createSeriesRow(seriesKey, normalized));
    chapters.push(...createChapterRows(seriesKey, normalized));
    reads.push(...createReadRows(seriesKey, normalized));
  });

  return {
    series,
    chapters,
    reads,
    subscriptions: uniqueStrings(snapshot.subscriptions).map((seriesKey, position) => ({
      seriesKey,
      position,
      checkedAt: normalizeCheckedAt(subscriptionCheckedAtByKey[seriesKey]),
    })),
    history: uniqueStrings(snapshot.history, HISTORY_LIMIT).map((seriesKey, position) => ({
      seriesKey,
      position,
    })),
    updates: (Array.isArray(snapshot.updates) ? snapshot.updates : []).map((item, position) => ({
      seriesKey: String(item?.seriesKey || ""),
      chapterID: String(item?.chapterID || ""),
      position,
    })),
  };
}

export function snapshotToRows(snapshot: LibrarySnapshotV2): LibraryDumpRowsV1 {
  const rows = snapshotToDbRows(snapshot);
  const readsBySeriesKey = groupReadRowsBySeriesKey(rows.reads);

  return {
    series: rows.series.map((row) => {
      const read = uniqueStrings(readsBySeriesKey[row.seriesKey]);
      return read.length > 0
        ? {
            ...row,
            read,
          }
        : row;
    }),
    chapters: rows.chapters,
    subscriptions: rows.subscriptions,
    history: rows.history,
    updates: rows.updates,
  };
}

export function snapshotToCompactDumpRows(
  snapshot: LibrarySnapshotV2,
  subscriptionCheckedAtByKey: Record<string, number> = {},
): LibraryDumpRowsV2 {
  const normalizedEntries = Object.entries(snapshot.seriesByKey || {}).map(
    ([seriesKey, record]) => [seriesKey, normalizeSeriesRecord(record.site, record.comicsID, record)] as const,
  );

  return {
    series: normalizedEntries.map(([, record]) => ({
      site: record.site,
      comicsID: record.comicsID,
      title: record.title,
      cover: record.cover,
      url: record.url,
      lastRead: record.lastRead,
      chapters: record.chapterList
        .filter(Boolean)
        .map((chapterID): LibraryDumpChapterV2 => {
          const chapter = record.chapters[chapterID];
          return {
            chapterID,
            title: chapter?.title || "",
            href: chapter?.href || "",
          };
        }),
      ...(record.read.length > 0 ? { read: uniqueStrings(record.read) } : {}),
    })),
    subscriptions: uniqueStrings(snapshot.subscriptions).map((seriesKey) => {
      const checkedAt = normalizeCheckedAt(
        subscriptionCheckedAtByKey[seriesKey],
      );
      return {
        seriesKey,
        ...(checkedAt > 0 ? { checkedAt } : {}),
      };
    }),
    history: uniqueStrings(snapshot.history, HISTORY_LIMIT),
    updates: (Array.isArray(snapshot.updates) ? snapshot.updates : [])
      .map((item) => ({
        seriesKey: String(item?.seriesKey || ""),
        chapterID: String(item?.chapterID || ""),
      }))
      .filter((item) => !!item.seriesKey && !!item.chapterID),
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
  series: Array<SeriesRow | LibraryDumpSeriesRow>;
  chapters: ChapterRow[];
  reads?: ReadRow[];
  subscriptions: LibraryDumpSubscriptionRow[];
  history: HistoryRow[];
  updates: UpdateRow[];
}) {
  const snapshot = createEmptyLibrarySnapshot();
  const readsBySeriesKey = groupReadRowsBySeriesKey(input.reads || []);

  for (const row of input.series) {
    const seriesRow = row as LibraryDumpSeriesRow;
    if (!SITE_KEYS.includes(seriesRow.site)) continue;
    const key = buildSeriesKey(seriesRow.site, seriesRow.comicsID);
    snapshot.seriesByKey[key] = {
      site: seriesRow.site,
      comicsID: seriesRow.comicsID,
      title: seriesRow.title || "",
      cover: seriesRow.cover || "",
      url: seriesRow.url || "",
      chapterList: [],
      chapters: {},
      lastRead: seriesRow.lastRead || "",
      read: uniqueStrings([
        ...uniqueStrings(readsBySeriesKey[key] || seriesRow.read),
        seriesRow.lastRead || "",
      ]),
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
    }))
    .filter(
      (item) =>
        !!item.seriesKey &&
        !!item.chapterID &&
        !!snapshot.seriesByKey[item.seriesKey],
    );

  return snapshot;
}

export function compactDumpRowsToSnapshot(data: LibraryDumpRowsV2) {
  const snapshot = createEmptyLibrarySnapshot();

  for (const series of Array.isArray(data.series) ? data.series : []) {
    const site = series?.site;
    const comicsID = String(series?.comicsID || "");
    if (!SITE_KEYS.includes(site) || !comicsID) {
      continue;
    }

    const normalizedChapters = Array.isArray(series?.chapters)
      ? series.chapters
          .map((chapter) => ({
            chapterID: String(chapter?.chapterID || ""),
            title: String(chapter?.title || ""),
            href: String(chapter?.href || ""),
          }))
          .filter((chapter) => !!chapter.chapterID)
      : [];

    const key = buildSeriesKey(site, comicsID);
    snapshot.seriesByKey[key] = normalizeSeriesRecord(site, comicsID, {
      site,
      comicsID,
      title: String(series?.title || ""),
      cover: String(series?.cover || ""),
      url: String(series?.url || ""),
      lastRead: String(series?.lastRead || ""),
      chapterList: normalizedChapters.map((chapter) => chapter.chapterID),
      chapters: normalizedChapters.reduce<Record<string, ChapterRecord>>(
        (acc, chapter) => {
          acc[chapter.chapterID] = {
            title: chapter.title,
            href: chapter.href,
          };
          return acc;
        },
        {},
      ),
      read: uniqueStrings(series?.read),
    });
  }

  snapshot.subscriptions = uniqueStrings(
    (Array.isArray(data.subscriptions) ? data.subscriptions : []).map((item) =>
      String(item?.seriesKey || ""),
    ),
  ).filter((seriesKey) => !!snapshot.seriesByKey[seriesKey]);

  snapshot.history = uniqueStrings(data.history).filter(
    (seriesKey) => !!snapshot.seriesByKey[seriesKey],
  ).slice(0, HISTORY_LIMIT);

  snapshot.updates = (Array.isArray(data.updates) ? data.updates : [])
    .map((item) => ({
      seriesKey: String(item?.seriesKey || ""),
      chapterID: String(item?.chapterID || ""),
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
  rows: LibraryDbRows,
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
    await requestToPromise(seriesStore.put(row));
  }
  for (const row of rows.chapters) {
    await requestToPromise(chaptersStore.put(row));
  }
  for (const row of rows.reads) {
    await requestToPromise(readsStore.put(row));
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
        supportedSiteKeys: [...SITE_KEYS],
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

  const [series, chapters, reads, subscriptions, history, updates] = await Promise.all([
    requestToPromise<SeriesRow[]>(seriesStore.getAll()),
    requestToPromise<ChapterRow[]>(chaptersStore.getAll()),
    requestToPromise<ReadRow[]>(readsStore.getAll()),
    requestToPromise<SubscriptionRow[]>(subscriptionsStore.getAll()),
    requestToPromise<HistoryRow[]>(historyStore.getAll()),
    requestToPromise<UpdateRow[]>(updatesStore.getAll()),
  ]);
  await done;

  return { series, chapters, reads, subscriptions, history, updates };
}

function hasLegacyLibraryData(raw: Record<string, unknown>) {
  return LEGACY_STORAGE_KEYS.some((key) => key in (raw || {}));
}

async function cleanupLegacyStorage() {
  await removeStorageItems(LEGACY_STORAGE_KEYS);
}

type LibrarySignalBatch = {
  participants: number;
  sources: Set<string>;
  scopes: Set<LibrarySignal["scopes"][number]>;
  seriesKeys: Set<string>;
  includesAllSeries: boolean;
};

let activeLibrarySignalBatch: LibrarySignalBatch | null = null;

async function writeLibrarySignal(
  source = "library",
  scopes: LibrarySignal["scopes"] = [
    "series",
    "chapters",
    "subscriptions",
    "history",
    "updates",
  ],
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

export async function emitLibrarySignal(
  source = "library",
  scopes: LibrarySignal["scopes"] = [
    "series",
    "chapters",
    "subscriptions",
    "history",
    "updates",
  ],
  seriesKeys?: string[],
) {
  const batch = activeLibrarySignalBatch;
  if (!batch) {
    await writeLibrarySignal(source, scopes, seriesKeys);
    return;
  }

  batch.sources.add(source);
  scopes.forEach((scope) => batch.scopes.add(scope));
  if (seriesKeys?.length) {
    seriesKeys.forEach((seriesKey) => batch.seriesKeys.add(seriesKey));
  } else {
    batch.includesAllSeries = true;
  }
}

export async function withBatchedLibrarySignals<T>(
  run: () => Promise<T>,
): Promise<T> {
  const batch = activeLibrarySignalBatch || {
    participants: 0,
    sources: new Set<string>(),
    scopes: new Set<LibrarySignal["scopes"][number]>(),
    seriesKeys: new Set<string>(),
    includesAllSeries: false,
  };
  activeLibrarySignalBatch = batch;
  batch.participants += 1;
  let runFailed = false;
  let runError: unknown;
  let result: T | undefined;

  try {
    result = await run();
  } catch (error) {
    runFailed = true;
    runError = error;
  }

  batch.participants -= 1;
  let flushError: unknown;
  if (batch.participants === 0 && activeLibrarySignalBatch === batch) {
    activeLibrarySignalBatch = null;
    if (batch.scopes.size > 0) {
      const source =
        batch.sources.size === 1
          ? Array.from(batch.sources)[0]
          : "libraryBatch";
      try {
        await writeLibrarySignal(
          source,
          Array.from(batch.scopes),
          batch.includesAllSeries ? undefined : Array.from(batch.seriesKeys),
        );
      } catch (error) {
        flushError = error;
      }
    }
  }

  if (runFailed) throw runError;
  if (flushError) throw flushError;
  return result as T;
}

export async function persistSnapshot(
  snapshot: LibrarySnapshotV2,
  options: {
    cleanupLegacy?: boolean;
    emitSignal?: boolean;
    signalSource?: string;
    scopes?: LibrarySignal["scopes"];
    seriesKeys?: string[];
    subscriptionCheckedAtByKey?: Record<string, number>;
  } = {},
) {
  const normalized = migrateV2(snapshot as LegacyStore);
  await writeRowsToDb(
    snapshotToDbRows(normalized, options.subscriptionCheckedAtByKey),
    normalized.version,
  );
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

async function cleanupUnsupportedSiteRows(meta: LibraryMetaRow) {
  const db = await openLibraryDb();
  const stores = [
    SERIES_STORE,
    CHAPTERS_STORE,
    READS_STORE,
    SUBSCRIPTIONS_STORE,
    HISTORY_STORE,
    UPDATES_STORE,
  ];
  const transaction = db.transaction([META_STORE, ...stores], "readwrite");
  const done = transactionDone(transaction);

  await Promise.all(
    stores.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const request = transaction.objectStore(name).openCursor();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
              resolve();
              return;
            }
            const { site } = parseSeriesKey(cursor.value.seriesKey);
            if (!SITE_KEYS.includes(site)) cursor.delete();
            cursor.continue();
          };
        }),
    ),
  );
  await requestToPromise(
    transaction.objectStore(META_STORE).put({
      ...meta,
      value: { ...meta.value, supportedSiteKeys: [...SITE_KEYS] },
    }),
  );
  await done;
}

export async function ensureLibraryReady() {
  if (!libraryReadyPromise) {
    libraryReadyPromise = (async () => {
      const meta = await readLibraryMeta(LIBRARY_META_KEY);
      if (meta?.value?.initialized) {
        if (meta?.value?.supportedSiteKeys?.join(",") !== SITE_KEYS.join(",")) {
          await cleanupUnsupportedSiteRows(meta);
        }
        if (Number(meta?.value?.dbSchemaVersion || 0) < LIBRARY_DB_VERSION) {
          const rows = await readRowsFromDb();
          await writeRowsToDb(
            snapshotToDbRows(
              rowsToSnapshot(rows),
              getSubscriptionCheckedAtByKey(rows.subscriptions),
            ),
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
  next.history = uniqueStrings(raw.history).filter(
    (seriesKey) => !!next.seriesByKey[seriesKey],
  ).slice(0, HISTORY_LIMIT);
  next.updates = (Array.isArray(raw.updates) ? raw.updates : [])
    .map((item) => ({
      seriesKey: String(item?.seriesKey || ""),
      chapterID: String(item?.chapterID || ""),
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
  ).filter((seriesKey) => !!seriesByKey[seriesKey]).slice(0, HISTORY_LIMIT);

  const subscriptions = uniqueStrings(
    (raw.subscribe || []).map((item) =>
      buildSeriesKey(String(item?.site || ""), String(item?.comicsID || "")),
    ),
  ).filter((seriesKey) => !!seriesByKey[seriesKey]);

  const updates = (Array.isArray(raw.update) ? raw.update : [])
    .map((item) => ({
      seriesKey: buildSeriesKey(
        String(item?.site || ""),
        String(item?.comicsID || ""),
      ),
      chapterID: String(item?.chapterID || ""),
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

export function isLibraryDumpV2(raw: unknown): raw is LibraryDumpV2 {
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const candidate = raw as Partial<LibraryDumpV2>;
  return (
    candidate.format === "comic-scroller-db-dump" &&
    candidate.formatVersion === 2 &&
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

export function migrateCompactDump(data: LibraryDumpV2) {
  return compactDumpRowsToSnapshot({
    series: Array.isArray(data.data?.series) ? data.data.series : [],
    subscriptions: Array.isArray(data.data?.subscriptions)
      ? data.data.subscriptions
      : [],
    history: Array.isArray(data.data?.history) ? data.data.history : [],
    updates: Array.isArray(data.data?.updates) ? data.data.updates : [],
  });
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
