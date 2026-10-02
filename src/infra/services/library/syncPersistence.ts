import {
  openLibraryDb,
  requestToPromise,
  transactionDone,
} from "./db";
import {
  createSeriesRow,
  loadRowsByPositionInTransaction,
  loadUpdatesInTransaction,
  writeOrderedSeriesKeysInTransaction,
} from "./rows";
import type {
  ChapterRow,
  HistoryRow,
  ReadRow,
  SeriesRow,
  SubscriptionRow,
  UpdateRow,
} from "./schema";
import {
  CHAPTERS_STORE,
  HISTORY_LIMIT,
  HISTORY_STORE,
  READS_STORE,
  SERIES_STORE,
  SUBSCRIPTIONS_STORE,
  uniqueStrings,
  UPDATES_STORE,
} from "./schema";
import {
  emitLibrarySignal,
  ensureLibraryReady,
} from "./shared";
import type {
  LibrarySyncChapterSummary,
  LibrarySyncSeriesStateV1,
  LibrarySyncStateV1,
} from "./syncModel";
import { createEmptyLibrarySyncState } from "./syncModel";

export type LocalLibrarySyncState = {
  state: LibrarySyncStateV1;
  subscriptionCheckedAtByKey: Record<string, number>;
};

function groupChapterIDsBySeriesKey(rows: ReadRow[] | UpdateRow[]) {
  return rows.reduce<Record<string, string[]>>((acc, row) => {
    if (!row.seriesKey || !row.chapterID) {
      return acc;
    }
    acc[row.seriesKey] = uniqueStrings([
      ...(acc[row.seriesKey] || []),
      row.chapterID,
    ]);
    return acc;
  }, {});
}

function buildChapterLookupKey(seriesKey: string, chapterID: string) {
  return `${seriesKey}::${chapterID}`;
}

function createProjectedSeries(
  row: SeriesRow,
  chapterIDs: string[],
  chaptersByKey: Record<string, ChapterRow>,
  readChapterIDs: string[],
): LibrarySyncSeriesStateV1 {
  return {
    site: row.site,
    comicsID: row.comicsID,
    title: row.title,
    cover: row.cover,
    url: row.url,
    latestChapterID: row.latestChapterID,
    lastReadChapterID: row.lastRead,
    readChapterIDs: uniqueStrings([...readChapterIDs, row.lastRead]),
    chapterSummaries: chapterIDs.reduce<
      Record<string, LibrarySyncChapterSummary>
    >((acc, chapterID) => {
      const chapter = chaptersByKey[
        buildChapterLookupKey(row.seriesKey, chapterID)
      ];
      const isLatest = chapterID === row.latestChapterID;
      const isLastRead = chapterID === row.lastRead;
      acc[chapterID] = {
        title:
          chapter?.title ||
          (isLatest ? row.latestChapterTitle : "") ||
          (isLastRead ? row.lastReadTitle : ""),
        href:
          chapter?.href ||
          (isLatest ? row.latestChapterHref : "") ||
          (isLastRead ? row.lastReadHref : ""),
      };
      return acc;
    }, {}),
  };
}

export async function readLibrarySyncState(): Promise<LocalLibrarySyncState> {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const rowsTransaction = db.transaction(
    [SERIES_STORE, READS_STORE, SUBSCRIPTIONS_STORE, HISTORY_STORE, UPDATES_STORE],
    "readonly",
  );
  const rowsDone = transactionDone(rowsTransaction);
  const [series, reads, subscriptions, history, updates] = await Promise.all([
    requestToPromise<SeriesRow[]>(
      rowsTransaction.objectStore(SERIES_STORE).getAll(),
    ),
    requestToPromise<ReadRow[]>(rowsTransaction.objectStore(READS_STORE).getAll()),
    loadRowsByPositionInTransaction<SubscriptionRow>(
      rowsTransaction.objectStore(SUBSCRIPTIONS_STORE),
    ),
    loadRowsByPositionInTransaction<HistoryRow>(
      rowsTransaction.objectStore(HISTORY_STORE),
    ),
    loadUpdatesInTransaction(rowsTransaction.objectStore(UPDATES_STORE)),
  ]);
  await rowsDone;

  const readsBySeriesKey = groupChapterIDsBySeriesKey(reads);
  const updatesBySeriesKey = groupChapterIDsBySeriesKey(updates);
  const chapterIDsBySeriesKey = series.reduce<Record<string, string[]>>(
    (acc, row) => {
      acc[row.seriesKey] = uniqueStrings([
        row.latestChapterID,
        row.lastRead,
        ...(readsBySeriesKey[row.seriesKey] || []),
        ...(updatesBySeriesKey[row.seriesKey] || []),
      ]);
      return acc;
    },
    {},
  );
  const chapterLookups = Object.entries(chapterIDsBySeriesKey).flatMap(
    ([seriesKey, chapterIDs]) =>
      chapterIDs.map((chapterID) => ({ seriesKey, chapterID })),
  );
  const chaptersByKey: Record<string, ChapterRow> = {};

  if (chapterLookups.length > 0) {
    const chaptersTransaction = db.transaction([CHAPTERS_STORE], "readonly");
    const chaptersDone = transactionDone(chaptersTransaction);
    const chaptersStore = chaptersTransaction.objectStore(CHAPTERS_STORE);
    const chapterRows = await Promise.all(
      chapterLookups.map(({ seriesKey, chapterID }) =>
        requestToPromise<ChapterRow | undefined>(
          chaptersStore.get([seriesKey, chapterID]),
        ),
      ),
    );
    chapterRows.forEach((chapter) => {
      if (!chapter) return;
      chaptersByKey[
        buildChapterLookupKey(chapter.seriesKey, chapter.chapterID)
      ] = chapter;
    });
    await chaptersDone;
  }

  const state = createEmptyLibrarySyncState();
  for (const row of series) {
    state.seriesByKey[row.seriesKey] = createProjectedSeries(
      row,
      chapterIDsBySeriesKey[row.seriesKey] || [],
      chaptersByKey,
      readsBySeriesKey[row.seriesKey] || [],
    );
  }
  const knownSeriesKeys = new Set(Object.keys(state.seriesByKey));
  state.subscriptions = subscriptions
    .filter((row) => knownSeriesKeys.has(row.seriesKey))
    .map((row) => row.seriesKey);
  state.history = history
    .map((row) => row.seriesKey)
    .filter((seriesKey) => knownSeriesKeys.has(seriesKey))
    .slice(0, HISTORY_LIMIT);
  state.updates = updates
    .filter((row) => knownSeriesKeys.has(row.seriesKey))
    .map((row) => ({
      seriesKey: row.seriesKey,
      chapterID: row.chapterID,
    }));

  return {
    state,
    subscriptionCheckedAtByKey: subscriptions.reduce<Record<string, number>>(
      (acc, row) => {
        acc[row.seriesKey] = Number(row.checkedAt || 0);
        return acc;
      },
      {},
    ),
  };
}

async function upsertProjectedChapters(
  chaptersStore: IDBObjectStore,
  seriesKey: string,
  chapterList: string[],
  chapterSummaries: Record<string, LibrarySyncChapterSummary>,
) {
  const existingRows = await requestToPromise<ChapterRow[]>(
    chaptersStore.index("seriesKey").getAll(seriesKey),
  );
  const existingByChapterID = new Map(
    existingRows.map((row) => [row.chapterID, row]),
  );
  let minOrderIndex = existingRows.reduce(
    (minimum, row) => Math.min(minimum, row.orderIndex),
    0,
  );
  let maxOrderIndex = existingRows.reduce(
    (maximum, row) => Math.max(maximum, row.orderIndex),
    -1,
  );

  for (let index = 0; index < chapterList.length; index += 1) {
    const chapterID = chapterList[index];
    const chapter = chapterSummaries[chapterID];
    const existing = existingByChapterID.get(chapterID);
    const orderIndex = existing
      ? existing.orderIndex
      : index === 0
        ? --minOrderIndex
        : ++maxOrderIndex;
    await requestToPromise(
      chaptersStore.put({
        seriesKey,
        chapterID,
        title: chapter?.title || existing?.title || "",
        href: chapter?.href || existing?.href || "",
        orderIndex,
      }),
    );
  }
}

export async function applyLibrarySyncState(
  state: LibrarySyncStateV1,
  subscriptionCheckedAtByKey: Record<string, number>,
) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction(
    [SERIES_STORE, CHAPTERS_STORE, READS_STORE, SUBSCRIPTIONS_STORE, HISTORY_STORE, UPDATES_STORE],
    "readwrite",
  );
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  const readsStore = transaction.objectStore(READS_STORE);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const historyStore = transaction.objectStore(HISTORY_STORE);
  const updatesStore = transaction.objectStore(UPDATES_STORE);

  for (const [seriesKey, syncSeries] of Object.entries(state.seriesByKey)) {
    const chapterList = uniqueStrings([
      syncSeries.latestChapterID,
      syncSeries.lastReadChapterID,
      ...syncSeries.readChapterIDs,
      ...Object.keys(syncSeries.chapterSummaries),
    ]);
    const record = {
      site: syncSeries.site,
      comicsID: syncSeries.comicsID,
      title: syncSeries.title,
      cover: syncSeries.cover,
      url: syncSeries.url,
      chapterList,
      chapters: syncSeries.chapterSummaries,
      lastRead: syncSeries.lastReadChapterID,
      read: uniqueStrings([
        ...syncSeries.readChapterIDs,
        syncSeries.lastReadChapterID,
      ]),
    };
    const previousRow = await requestToPromise<SeriesRow | undefined>(
      seriesStore.get(seriesKey),
    );
    await requestToPromise(
      seriesStore.put(
        createSeriesRow(seriesKey, record, {
          latestChapterID: syncSeries.latestChapterID,
          previousRow,
        }),
      ),
    );
    await upsertProjectedChapters(
      chaptersStore,
      seriesKey,
      chapterList,
      syncSeries.chapterSummaries,
    );
    for (const chapterID of uniqueStrings(record.read)) {
      await requestToPromise(readsStore.put({ seriesKey, chapterID }));
    }
  }

  const knownSeriesKeys = new Set(Object.keys(state.seriesByKey));
  await writeOrderedSeriesKeysInTransaction(
    subscriptionsStore,
    state.subscriptions.filter((seriesKey) => knownSeriesKeys.has(seriesKey)),
    (seriesKey) => ({
      checkedAt: Number(subscriptionCheckedAtByKey[seriesKey] || 0),
    }),
  );
  await writeOrderedSeriesKeysInTransaction(
    historyStore,
    state.history
      .filter((seriesKey) => knownSeriesKeys.has(seriesKey))
      .slice(0, HISTORY_LIMIT),
  );
  await requestToPromise(updatesStore.clear());
  const updates = state.updates.filter((update) =>
    knownSeriesKeys.has(update.seriesKey),
  );
  for (let position = 0; position < updates.length; position += 1) {
    const update = updates[position];
    await requestToPromise(
      updatesStore.put({
        seriesKey: update.seriesKey,
        chapterID: update.chapterID,
        position,
      }),
    );
  }

  await done;
  await emitLibrarySignal(
    "library-sync",
    ["series", "chapters", "subscriptions", "history", "updates"],
    Object.keys(state.seriesByKey),
  );
}
