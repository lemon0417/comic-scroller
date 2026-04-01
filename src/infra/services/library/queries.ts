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
  type SeriesRow,
  type SubscriptionRow,
  type UpdateRow,
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

  return rowsToSnapshot({
    series: seriesRows,
    chapters: chapterRows,
    subscriptions,
    history,
    updates,
  });
}
