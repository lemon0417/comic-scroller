import {
  openLibraryDb,
  requestToPromise,
  transactionDone,
} from "./db";
import {
  type BackgroundRefreshCandidate,
  createEmptyPopupFeedSnapshot,
  type PopupFeedCategory,
  type PopupFeedEntry,
  type PopupFeedSnapshot,
  type ReaderSeriesState,
  type ReaderSeriesSyncState,
} from "./models";
import {
  composeSeriesRecord,
  loadReadChapterIDsInTransaction,
  loadRowsByPositionInTransaction,
  loadSubscriptionKeysByCheckedAtInTransaction,
  loadUpdatesInTransaction,
  resolveSeriesKeyInput,
} from "./rows";
import {
  type ChapterRow,
  CHAPTERS_STORE,
  HISTORY_STORE,
  type HistoryRow,
  parseSeriesKey,
  READS_STORE,
  SERIES_STORE,
  type SeriesRow,
  type SubscriptionRow,
  SUBSCRIPTIONS_STORE,
  type UpdateRow,
  UPDATES_STORE,
} from "./schema";
import {
  ensureLibraryReady,
  readSeriesSnapshotByKey,
} from "./shared";

const SITE_LABELS: Record<string, string> = {
  dm5: "DM5",
  "8comic": "8comic",
  manhuagui: "漫畫櫃",
};

function buildUpdateChapterKey(seriesKey: string, chapterID: string) {
  return `${seriesKey}::${chapterID}`;
}

function buildPopupFeedEntry(
  seriesByKey: Record<string, SeriesRow>,
  updateChaptersByKey: Record<string, ChapterRow>,
  category: PopupFeedCategory,
  seriesKey: string,
  index: number,
  chapterID = "",
): PopupFeedEntry | null {
  const row = seriesByKey[seriesKey];
  if (!row) return null;

  const lastReadChapterID = row.lastRead || "";
  const lastChapterID = row.latestChapterID || "";
  const updateChapter =
    (chapterID ? updateChaptersByKey[buildUpdateChapterKey(seriesKey, chapterID)] : null) ||
    null;
  const lastReadTitle =
    row.lastReadTitle ||
    (lastReadChapterID && lastReadChapterID === lastChapterID
      ? row.latestChapterTitle
      : "") ||
    "Not started";
  const lastReadHref =
    row.lastReadHref ||
    (lastReadChapterID && lastReadChapterID === lastChapterID
      ? row.latestChapterHref
      : "");
  const lastChapterTitle = row.latestChapterTitle || "No chapters yet";
  const lastChapterHref = row.latestChapterHref || "";
  const updateChapterTitle =
    updateChapter?.title ||
    (chapterID && chapterID === lastChapterID ? row.latestChapterTitle : "") ||
    "";
  const updateChapterHref =
    updateChapter?.href ||
    (chapterID && chapterID === lastChapterID ? row.latestChapterHref : "") ||
    "";
  const continueChapterID = lastReadChapterID || chapterID || lastChapterID;
  const continueHref =
    lastReadHref || updateChapterHref || row.latestChapterHref || row.url || "";

  return {
    category,
    key: `${category}_${seriesKey}_${chapterID || index}`,
    index,
    site: row.site,
    siteLabel: SITE_LABELS[row.site] || String(row.site || "").toUpperCase(),
    comicsID: row.comicsID,
    chapterID,
    lastReadChapterID,
    lastChapterID,
    updateChapterID: chapterID,
    continueChapterID,
    title: row.title || "Untitled Series",
    url: row.url || "",
    cover: row.cover || "",
    lastReadTitle,
    lastReadHref,
    lastChapterTitle,
    lastChapterHref,
    updateChapterTitle,
    updateChapterHref,
    continueHref,
  };
}

function mapPopupSeriesList(
  seriesByKey: Record<string, SeriesRow>,
  updateChaptersByKey: Record<string, ChapterRow>,
  category: Extract<PopupFeedCategory, "subscribe" | "history">,
  list: string[],
) {
  return list
    .map((seriesKey, index) =>
      buildPopupFeedEntry(
        seriesByKey,
        updateChaptersByKey,
        category,
        seriesKey,
        index,
      ),
    )
    .filter((entry): entry is PopupFeedEntry => entry !== null);
}

function mapPopupUpdates(
  seriesByKey: Record<string, SeriesRow>,
  updateChaptersByKey: Record<string, ChapterRow>,
  updates: UpdateRow[],
) {
  return updates
    .map((item, index) =>
      buildPopupFeedEntry(
        seriesByKey,
        updateChaptersByKey,
        "update",
        item.seriesKey,
        index,
        String(item.chapterID || ""),
      ),
    )
    .filter((entry): entry is PopupFeedEntry => entry !== null);
}

function buildPopupFeedSnapshot(input: {
  seriesByKey: Record<string, SeriesRow>;
  updateChaptersByKey: Record<string, ChapterRow>;
  subscriptions: SubscriptionRow[];
  history: HistoryRow[];
  updates: UpdateRow[];
  updateCount?: number;
  updatesTruncated?: boolean;
}): PopupFeedSnapshot {
  const subscriptionKeys = input.subscriptions.map((row) => row.seriesKey);
  const historyKeys = input.history.map((row) => row.seriesKey);
  const update = mapPopupUpdates(
    input.seriesByKey,
    input.updateChaptersByKey,
    input.updates,
  );
  const subscribe = mapPopupSeriesList(
    input.seriesByKey,
    input.updateChaptersByKey,
    "subscribe",
    subscriptionKeys,
  );
  const history = mapPopupSeriesList(
    input.seriesByKey,
    input.updateChaptersByKey,
    "history",
    historyKeys,
  );
  const firstSubscribed = subscriptionKeys.find(
    (seriesKey) => !!input.seriesByKey[seriesKey],
  );
  const continueReading =
    history[0] ||
    (firstSubscribed
      ? buildPopupFeedEntry(
          input.seriesByKey,
          input.updateChaptersByKey,
          "subscribe",
          firstSubscribed,
          0,
        )
      : null);

  return {
    ...createEmptyPopupFeedSnapshot(),
    update,
    subscribe,
    history,
    continueReading,
    ...(typeof input.updateCount === "number"
      ? { updateCount: input.updateCount }
      : {}),
    ...(input.updatesTruncated ? { updatesTruncated: true } : {}),
  };
}

async function loadReferencedSeriesRows(
  seriesStore: IDBObjectStore,
  referencedKeys: string[],
) {
  if (referencedKeys.length === 0) {
    return {};
  }

  const referencedKeySet = new Set(referencedKeys);
  const rows = await requestToPromise<SeriesRow[]>(seriesStore.getAll());
  return rows.reduce<Record<string, SeriesRow>>((acc, row) => {
    if (referencedKeySet.has(row.seriesKey)) {
      acc[row.seriesKey] = row;
    }
    return acc;
  }, {});
}

async function loadUpdateChapterRows(
  chaptersStore: IDBObjectStore,
  updates: UpdateRow[],
) {
  const chapterRows = await Promise.all(
    Array.from(
      new Set(
        updates
          .map((row) => buildUpdateChapterKey(row.seriesKey, row.chapterID))
          .filter(Boolean),
      ),
    ).map(async (lookupKey) => {
      const [seriesKey, chapterID] = lookupKey.split("::");
      if (!seriesKey || !chapterID) {
        return null;
      }
      const row = await requestToPromise<ChapterRow | undefined>(
        chaptersStore.get([seriesKey, chapterID]),
      );
      return row ? ([lookupKey, row] as const) : null;
    }),
  );

  return chapterRows.reduce<Record<string, ChapterRow>>((acc, entry) => {
    if (!entry) {
      return acc;
    }
    const [lookupKey, row] = entry;
    acc[lookupKey] = row;
    return acc;
  }, {});
}

export async function getSeriesSnapshot(siteOrSeriesKey: string, comicsID?: string) {
  return readSeriesSnapshotByKey(resolveSeriesKeyInput(siteOrSeriesKey, comicsID));
}

export async function getSeriesCover(siteOrSeriesKey: string, comicsID?: string) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([SERIES_STORE], "readonly");
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const row = await requestToPromise<SeriesRow | undefined>(
    seriesStore.get(resolveSeriesKeyInput(siteOrSeriesKey, comicsID)),
  );
  await done;
  return row?.cover || "";
}

export async function getReaderSeriesState(
  seriesKey: string,
): Promise<ReaderSeriesState> {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction(
    [SERIES_STORE, CHAPTERS_STORE, READS_STORE, SUBSCRIPTIONS_STORE],
    "readonly",
  );
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  const readsStore = transaction.objectStore(READS_STORE);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const row = await requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey));
  const subscriptionRow = await requestToPromise(subscriptionsStore.get(seriesKey));

  if (!row) {
    await done;
    return {
      series: null,
      subscribed: Boolean(subscriptionRow),
    };
  }

  const chapterRows = await requestToPromise<ChapterRow[]>(
    chaptersStore.index("seriesKey").getAll(seriesKey),
  );
  const readChapterIDs = await loadReadChapterIDsInTransaction(readsStore, seriesKey);
  await done;

  return {
    series: composeSeriesRecord(row, chapterRows, readChapterIDs),
    subscribed: Boolean(subscriptionRow),
  };
}

export async function getReaderSeriesSyncState(
  seriesKey: string,
): Promise<ReaderSeriesSyncState> {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction(
    [SERIES_STORE, SUBSCRIPTIONS_STORE],
    "readonly",
  );
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const [row, subscriptionRow] = await Promise.all([
    requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey)),
    requestToPromise(subscriptionsStore.get(seriesKey)),
  ]);
  await done;

  return {
    exists: Boolean(row),
    subscribed: Boolean(subscriptionRow),
  };
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

export async function listBackgroundRefreshCandidates(
  limit = Number.POSITIVE_INFINITY,
): Promise<BackgroundRefreshCandidate[]> {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction(
    [SUBSCRIPTIONS_STORE, SERIES_STORE],
    "readonly",
  );
  const done = transactionDone(transaction);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const [seriesKeys, seriesRows] = await Promise.all([
    loadSubscriptionKeysByCheckedAtInTransaction(subscriptionsStore, limit),
    requestToPromise<SeriesRow[]>(seriesStore.getAll()),
  ]);
  await done;

  const seriesByKey = new Map(
    seriesRows.map((row) => [row.seriesKey, row] as const),
  );
  return seriesKeys.map((seriesKey) => {
    const row = seriesByKey.get(seriesKey);
    const { site, comicsID } = parseSeriesKey(seriesKey);
    return {
      seriesKey,
      site,
      comicsID,
      url: row?.url || "",
      latestChapterID: row?.latestChapterID || "",
      ...(row?.latestChapterIDsByGroup
        ? { latestChapterIDsByGroup: row.latestChapterIDsByGroup }
        : {}),
    };
  });
}

const popupFeedSnapshotInFlight = new Map<string, Promise<PopupFeedSnapshot>>();

async function loadPopupFeedSnapshot(updateLimit: number) {
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
  const updatesReadLimit = Number.isFinite(updateLimit)
    ? updateLimit + 1
    : Number.POSITIVE_INFINITY;

  const [subscriptions, history, loadedUpdates] = await Promise.all([
    loadRowsByPositionInTransaction<SubscriptionRow>(subscriptionsStore),
    loadRowsByPositionInTransaction<HistoryRow>(historyStore),
    loadUpdatesInTransaction(updatesStore, updatesReadLimit),
  ]);
  const updatesTruncated =
    Number.isFinite(updateLimit) && loadedUpdates.length > updateLimit;
  const updates = updatesTruncated
    ? loadedUpdates.slice(0, updateLimit)
    : loadedUpdates;
  const updateCount = updatesTruncated
    ? Number(
        (
          await requestToPromise<number>(updatesStore.count())
        ) || 0,
      )
    : updates.length;

  const referencedKeys = Array.from(
    new Set([
      ...subscriptions.map((row) => row.seriesKey),
      ...history.map((row) => row.seriesKey),
      ...updates.map((row) => row.seriesKey),
    ]),
  );

  const [seriesByKey, updateChaptersByKey] = await Promise.all([
    loadReferencedSeriesRows(seriesStore, referencedKeys),
    loadUpdateChapterRows(chaptersStore, updates),
  ]);

  await done;

  return buildPopupFeedSnapshot({
    seriesByKey,
    updateChaptersByKey,
    subscriptions,
    history,
    updates,
    updateCount,
    updatesTruncated,
  });
}

export function getPopupFeedSnapshot(
  options: {
    updateLimit?: number;
  } = {},
) {
  const updateLimit = Number.isFinite(options.updateLimit)
    ? Math.max(0, Math.floor(Number(options.updateLimit)))
    : Number.POSITIVE_INFINITY;
  const cacheKey = Number.isFinite(updateLimit) ? String(updateLimit) : "all";
  const existing = popupFeedSnapshotInFlight.get(cacheKey);
  if (existing) return existing;

  const trackedPromise = loadPopupFeedSnapshot(updateLimit).finally(() => {
    if (popupFeedSnapshotInFlight.get(cacheKey) === trackedPromise) {
      popupFeedSnapshotInFlight.delete(cacheKey);
    }
  });
  popupFeedSnapshotInFlight.set(cacheKey, trackedPromise);
  return trackedPromise;
}
