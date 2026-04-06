import {
  createEmptyPopupFeedSnapshot,
  type PopupFeedCategory,
  type PopupFeedEntry,
  type PopupFeedSnapshot,
  type ReaderSeriesState,
} from "./models";
import {
  type ChapterRow,
  CHAPTERS_STORE,
  HISTORY_STORE,
  type HistoryRow,
  SERIES_STORE,
  type SeriesRecord,
  type SeriesRow,
  type SubscriptionRow,
  SUBSCRIPTIONS_STORE,
  type UpdateRow,
  UPDATES_STORE,
} from "./schema";
import {
  composeSeriesRecord,
  ensureLibraryReady,
  openLibraryDb,
  readSeriesSnapshotByKey,
  requestToPromise,
  resolveSeriesKeyInput,
  sortRowsByPosition,
  sortSubscriptionRowsByCheckedAt,
  transactionDone,
} from "./shared";

const SITE_LABELS: Record<string, string> = {
  dm5: "DM5",
  sf: "SF",
  comicbus: "ComicBus",
};

function buildPopupFeedEntry(
  seriesByKey: Record<string, SeriesRecord>,
  category: PopupFeedCategory,
  seriesKey: string,
  index: number,
  chapterID = "",
): PopupFeedEntry | null {
  const record = seriesByKey[seriesKey];
  if (!record) return null;

  const chapters = record.chapters || {};
  const chapterList = record.chapterList || [];
  const lastReadChapterID = record.lastRead || "";
  const lastChapterID = chapterList[0] || "";
  const lastRead = (lastReadChapterID ? chapters[lastReadChapterID] : null) || null;
  const lastChapter = (lastChapterID ? chapters[lastChapterID] : null) || null;
  const updateChapter = (chapterID ? chapters[chapterID] : null) || null;
  const continueChapterID = lastReadChapterID || chapterID || lastChapterID;
  const continueHref =
    lastRead?.href || updateChapter?.href || lastChapter?.href || record.url || "";

  return {
    category,
    key: `${category}_${seriesKey}_${chapterID || index}`,
    index,
    site: record.site,
    siteLabel: SITE_LABELS[record.site] || String(record.site || "").toUpperCase(),
    comicsID: record.comicsID,
    chapterID,
    lastReadChapterID,
    lastChapterID,
    updateChapterID: chapterID,
    continueChapterID,
    title: record.title || "Untitled Series",
    url: record.url || "",
    cover: record.cover || "",
    lastReadTitle: lastRead?.title || "Not started",
    lastReadHref: lastRead?.href || "",
    lastChapterTitle: lastChapter?.title || "No chapters yet",
    lastChapterHref: lastChapter?.href || "",
    updateChapterTitle: updateChapter?.title || "",
    updateChapterHref: updateChapter?.href || "",
    continueHref,
  };
}

function mapPopupSeriesList(
  seriesByKey: Record<string, SeriesRecord>,
  category: Extract<PopupFeedCategory, "subscribe" | "history">,
  list: string[],
) {
  return list
    .map((seriesKey, index) =>
      buildPopupFeedEntry(seriesByKey, category, seriesKey, index),
    )
    .filter((entry): entry is PopupFeedEntry => entry !== null);
}

function mapPopupUpdates(
  seriesByKey: Record<string, SeriesRecord>,
  updates: UpdateRow[],
) {
  return sortRowsByPosition(updates)
    .map((item, index) =>
      buildPopupFeedEntry(
        seriesByKey,
        "update",
        item.seriesKey,
        index,
        String(item.chapterID || ""),
      ),
    )
    .filter((entry): entry is PopupFeedEntry => entry !== null);
}

function buildPopupFeedSnapshot(input: {
  seriesByKey: Record<string, SeriesRecord>;
  subscriptions: SubscriptionRow[];
  history: HistoryRow[];
  updates: UpdateRow[];
}): PopupFeedSnapshot {
  const subscriptionKeys = sortRowsByPosition(input.subscriptions).map(
    (row) => row.seriesKey,
  );
  const historyKeys = sortRowsByPosition(input.history).map((row) => row.seriesKey);
  const update = mapPopupUpdates(input.seriesByKey, input.updates);
  const subscribe = mapPopupSeriesList(input.seriesByKey, "subscribe", subscriptionKeys);
  const history = mapPopupSeriesList(input.seriesByKey, "history", historyKeys);
  const firstSubscribed = subscriptionKeys.find(
    (seriesKey) => !!input.seriesByKey[seriesKey],
  );
  const continueReading =
    history[0] ||
    (firstSubscribed
      ? buildPopupFeedEntry(input.seriesByKey, "subscribe", firstSubscribed, 0)
      : null);

  return {
    ...createEmptyPopupFeedSnapshot(),
    update,
    subscribe,
    history,
    continueReading,
  };
}

async function loadReferencedSeriesRecords(
  seriesStore: IDBObjectStore,
  chaptersStore: IDBObjectStore,
  referencedKeys: string[],
) {
  if (referencedKeys.length === 0) {
    return {};
  }

  const chapterIndex = chaptersStore.index("seriesKey");
  const seriesEntries = await Promise.all(
    referencedKeys.map(async (seriesKey) => {
      const row = await requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey));
      if (!row) {
        return null;
      }

      const chapterRows = await requestToPromise<ChapterRow[]>(
        chapterIndex.getAll(seriesKey),
      );
      return [seriesKey, composeSeriesRecord(row, chapterRows)] as const;
    }),
  );

  return seriesEntries.reduce<Record<string, SeriesRecord>>((acc, entry) => {
    if (!entry) {
      return acc;
    }
    const [seriesKey, record] = entry;
    acc[seriesKey] = record;
    return acc;
  }, {});
}

export async function getSeriesSnapshot(siteOrSeriesKey: string, comicsID?: string) {
  return readSeriesSnapshotByKey(resolveSeriesKeyInput(siteOrSeriesKey, comicsID));
}

export async function getReaderSeriesState(
  seriesKey: string,
): Promise<ReaderSeriesState> {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction(
    [SERIES_STORE, CHAPTERS_STORE, SUBSCRIPTIONS_STORE],
    "readonly",
  );
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
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
  await done;

  return {
    series: composeSeriesRecord(row, chapterRows),
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

export async function listSubscriptionKeys(limit = Number.POSITIVE_INFINITY) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([SUBSCRIPTIONS_STORE], "readonly");
  const done = transactionDone(transaction);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const rows = await requestToPromise<SubscriptionRow[]>(subscriptionsStore.getAll());
  const seriesKeys = sortSubscriptionRowsByCheckedAt(rows)
    .slice(0, Number.isFinite(limit) ? Math.max(0, limit) : rows.length)
    .map((row) => row.seriesKey)
    .filter(Boolean);
  await done;
  return seriesKeys;
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

  const referencedKeys = Array.from(
    new Set([
      ...sortRowsByPosition(subscriptions).map((row) => row.seriesKey),
      ...sortRowsByPosition(history).map((row) => row.seriesKey),
      ...sortRowsByPosition(updates).map((row) => row.seriesKey),
    ]),
  );

  const seriesByKey = await loadReferencedSeriesRecords(
    seriesStore,
    chaptersStore,
    referencedKeys,
  );

  await done;

  return buildPopupFeedSnapshot({
    seriesByKey,
    subscriptions,
    history,
    updates,
  });
}
