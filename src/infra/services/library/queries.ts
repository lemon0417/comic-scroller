import {
  CHAPTERS_STORE,
  HISTORY_STORE,
  SERIES_STORE,
  SITE_KEYS,
  SUBSCRIPTIONS_STORE,
  UPDATES_STORE,
  buildSeriesKey,
  type ChapterRow,
  type HistoryRow,
  type LibrarySnapshotV2,
  type PopupFeedCategory,
  type PopupFeedEntry,
  type PopupFeedSnapshot,
  type SeriesRow,
  type SubscriptionRow,
  type UpdateRow,
  createEmptyPopupFeedSnapshot,
  parseSeriesKey,
} from "./schema";
import {
  ensureLibraryReady,
  loadOrderedSeriesKeysInTransaction,
  openLibraryDb,
  readSeriesSnapshotByKey,
  requestToPromise,
  resolveSeriesKeyInput,
  rowsToSnapshot,
  sortRowsByPosition,
  transactionDone,
} from "./shared";

const SITE_LABELS: Record<string, string> = {
  dm5: "DM5",
  sf: "SF",
  comicbus: "ComicBus",
};

function buildPopupFeedEntry(
  library: LibrarySnapshotV2,
  category: PopupFeedCategory,
  seriesKey: string,
  index: number,
  chapterID = "",
): PopupFeedEntry | null {
  const record = library.seriesByKey[seriesKey];
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
  const { site } = parseSeriesKey(seriesKey);

  return {
    category,
    key: `${category}_${seriesKey}_${chapterID || index}`,
    index,
    site,
    siteLabel: SITE_LABELS[site] || String(site || "").toUpperCase(),
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
  library: LibrarySnapshotV2,
  category: Extract<PopupFeedCategory, "subscribe" | "history">,
  list: string[],
) {
  return list
    .map((seriesKey, index) => buildPopupFeedEntry(library, category, seriesKey, index))
    .filter((entry): entry is PopupFeedEntry => entry !== null);
}

function mapPopupUpdates(library: LibrarySnapshotV2) {
  return library.updates
    .map((item, index) =>
      buildPopupFeedEntry(
        library,
        "update",
        item.seriesKey,
        index,
        String(item.chapterID || ""),
      ),
    )
    .filter((entry): entry is PopupFeedEntry => entry !== null);
}

function buildPopupFeedSnapshot(library: LibrarySnapshotV2): PopupFeedSnapshot {
  const update = mapPopupUpdates(library);
  const subscribe = mapPopupSeriesList(library, "subscribe", library.subscriptions);
  const history = mapPopupSeriesList(library, "history", library.history);
  const firstSubscribed = library.subscriptions.find(
    (seriesKey) => !!library.seriesByKey[seriesKey],
  );
  const continueReading =
    history[0] ||
    (firstSubscribed
      ? buildPopupFeedEntry(library, "subscribe", firstSubscribed, 0)
      : null);

  return {
    ...createEmptyPopupFeedSnapshot(),
    update,
    subscribe,
    history,
    continueReading,
  };
}

export async function getSeriesSnapshot(siteOrSeriesKey: string, comicsID?: string) {
  return readSeriesSnapshotByKey(resolveSeriesKeyInput(siteOrSeriesKey, comicsID));
}

export async function getSeriesMeta(siteOrSeriesKey: string, comicsID?: string) {
  return getSeriesSnapshot(siteOrSeriesKey, comicsID);
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

  const referencedKeys = Array.from(
    new Set([
      ...sortRowsByPosition(subscriptions).map((row) => row.seriesKey),
      ...sortRowsByPosition(history).map((row) => row.seriesKey),
      ...sortRowsByPosition(updates).map((row) => row.seriesKey),
    ]),
  );

  const seriesRows: SeriesRow[] = [];
  const chapterRows: ChapterRow[] = [];
  for (const seriesKey of referencedKeys) {
    const row = await requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey));
    if (!row) continue;
    seriesRows.push(row);
    chapterRows.push(
      ...(await requestToPromise<ChapterRow[]>(
        chaptersStore.index("seriesKey").getAll(seriesKey),
      )),
    );
  }

  await done;

  return buildPopupFeedSnapshot(
    rowsToSnapshot({
      series: seriesRows,
      chapters: chapterRows,
      subscriptions,
      history,
      updates,
    }),
  );
}
