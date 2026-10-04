import type {
  BackgroundSeriesRefreshResult,
  ChapterGroup,
  ReaderSeriesMutationResult,
  ReadProgressMutationResult,
  SeriesChapterSnapshot,
  SeriesCleanupResult,
} from "@domain/library";
import {
  getChapterGroupCheckpoints,
  validateChapterGroups,
} from "@domain/library";

import { openLibraryDb, requestToPromise, transactionDone } from "./db";
import {
  addReadChapterInTransaction,
  composeSeriesRecord,
  createSeriesRow,
  loadOrderedSubscriptionRowsInTransaction,
  loadReadChapterIDsInTransaction,
  loadRowsByPositionInTransaction,
  loadUpdatesInTransaction,
  replaceSeriesChaptersInTransaction,
  replaceSeriesReadsInTransaction,
  writeOrderedSeriesKeysInTransaction,
} from "./rows";
import {
  buildSeriesKey,
  type ChapterRow,
  CHAPTERS_STORE,
  HISTORY_LIMIT,
  HISTORY_STORE,
  type LibraryUpdateRecord,
  normalizeSeriesRecord,
  READS_STORE,
  SERIES_STORE,
  type SeriesRecord,
  type SeriesRow,
  type SiteKey,
  type SubscriptionRow,
  SUBSCRIPTIONS_STORE,
  uniqueStrings,
  UPDATES_STORE,
} from "./schema";
import {
  emitLibrarySignal,
  ensureLibraryReady,
} from "./shared";

async function persistSeriesRecordState(
  site: SiteKey,
  comicsID: string,
  input: {
    record?: Partial<SeriesRecord>;
    readChapterID?: string;
    addHistory?: boolean;
    dismissChapterID?: string;
    includeSubscriptionState?: boolean;
    requireExistingSeries?: boolean;
    chapterGroups?: ChapterGroup[];
  },
) {
  await ensureLibraryReady();
  const seriesKey = buildSeriesKey(site, comicsID);
  const shouldPersistChapterCache = Boolean(
    input.record && ("chapterList" in input.record || "chapters" in input.record),
  );
  const shouldLoadReadChapter = Boolean(input.readChapterID && !shouldPersistChapterCache);
  const shouldLoadReads = Boolean(
    input.readChapterID || (input.record && "read" in input.record),
  );
  const storeNames = [
    SERIES_STORE,
    ...(shouldPersistChapterCache || shouldLoadReadChapter ? [CHAPTERS_STORE] : []),
    ...(shouldLoadReads ? [READS_STORE] : []),
    ...(input.addHistory ? [HISTORY_STORE] : []),
    UPDATES_STORE,
    ...(input.includeSubscriptionState ? [SUBSCRIPTIONS_STORE] : []),
  ] as const;
  const db = await openLibraryDb();
  const transaction = db.transaction(storeNames, "readwrite");
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = shouldPersistChapterCache || shouldLoadReadChapter
    ? transaction.objectStore(CHAPTERS_STORE)
    : null;
  const readsStore = shouldLoadReads ? transaction.objectStore(READS_STORE) : null;
  const historyStore = input.addHistory
    ? transaction.objectStore(HISTORY_STORE)
    : null;
  const updatesStore = transaction.objectStore(UPDATES_STORE);
  const subscriptionsStore = input.includeSubscriptionState
    ? transaction.objectStore(SUBSCRIPTIONS_STORE)
    : null;

  const previousRow = await requestToPromise<SeriesRow | undefined>(
    seriesStore.get(seriesKey),
  );
  // Progress and an existing reader's late metadata must not recreate deleted data.
  if (!previousRow && (!input.record || input.requireExistingSeries)) {
    const updatesCount = await requestToPromise<number>(updatesStore.count());
    await done;
    return { seriesKey, readChapterIDs: [], subscribed: false, updatesCount };
  }
  const previousChapters = previousRow && shouldPersistChapterCache && chaptersStore
    ? await requestToPromise<ChapterRow[]>(
        chaptersStore.index("seriesKey").getAll(seriesKey),
      )
    : [];
  const previousReadChapterIDs =
    previousRow && readsStore
      ? await loadReadChapterIDsInTransaction(readsStore, seriesKey)
      : [];
  const readChapterRow =
    shouldLoadReadChapter && chaptersStore && input.readChapterID
      ? await requestToPromise<ChapterRow | undefined>(
          chaptersStore.get([seriesKey, input.readChapterID]),
        )
      : undefined;
  const previousRecord = previousRow
    ? composeSeriesRecord(previousRow, previousChapters, previousReadChapterIDs)
    : normalizeSeriesRecord(site, comicsID, {});

  const mergedRecord = mergeSeriesRecord(
    site,
    comicsID,
    previousRecord,
    input.record,
  );
  if (input.chapterGroups) {
    validateChapterGroups(mergedRecord.chapterList, input.chapterGroups);
  }

  if (input.readChapterID) {
    mergedRecord.lastRead = input.readChapterID;
    mergedRecord.read = uniqueStrings([...(mergedRecord.read || []), input.readChapterID]);
  }

  await requestToPromise(
    seriesStore.put(
      createSeriesRow(seriesKey, mergedRecord, {
        previousRow,
        readChapterRow,
        ...(input.chapterGroups
          ? {
              latestChapterIDsByGroup: getChapterGroupCheckpoints(
                input.chapterGroups,
              ),
            }
          : {}),
      }),
    ),
  );
  if (shouldPersistChapterCache && chaptersStore) {
    await replaceSeriesChaptersInTransaction(chaptersStore, seriesKey, mergedRecord);
  }
  if (readsStore) {
    if (input.readChapterID) {
      await addReadChapterInTransaction(readsStore, seriesKey, input.readChapterID);
    } else if (input.record && "read" in input.record) {
      await replaceSeriesReadsInTransaction(readsStore, seriesKey, mergedRecord);
    }
  }

  if (historyStore) {
    const historyRows = await loadRowsByPositionInTransaction<{
      seriesKey: string;
      position: number;
    }>(historyStore);
    await prependOrderedSeriesKeyInTransaction(historyStore, seriesKey, {
      currentRows: historyRows,
      limit: HISTORY_LIMIT,
    });
  }

  if (input.dismissChapterID) {
    await requestToPromise(
      updatesStore.delete([seriesKey, input.dismissChapterID]),
    );
  }

  const updatesCount = await requestToPromise<number>(updatesStore.count());
  const subscribed = subscriptionsStore
    ? Boolean(await requestToPromise(subscriptionsStore.get(seriesKey)))
    : false;

  await done;
  await emitLibrarySignal(
    "seriesMutation",
    [
      "series",
      ...(shouldPersistChapterCache ? ["chapters" as const] : []),
      ...(input.addHistory ? ["history" as const] : []),
      ...(input.dismissChapterID ? ["updates" as const] : []),
    ],
    [seriesKey],
  );

  return {
    seriesKey,
    readChapterIDs: mergedRecord.read,
    subscribed,
    updatesCount: Number(updatesCount || 0),
  };
}

function mergeSeriesRecord(
  site: SiteKey,
  comicsID: string,
  previousRecord: SeriesRecord,
  record?: Partial<SeriesRecord>,
) {
  const nextRecord = normalizeSeriesRecord(site, comicsID, {
    ...previousRecord,
    ...(record || {}),
  });
  if (!record?.cover && previousRecord.cover) {
    nextRecord.cover = previousRecord.cover;
  }
  return nextRecord;
}

function mergeBackgroundRefreshRecord(
  site: SiteKey,
  comicsID: string,
  previousRow: SeriesRow | undefined,
  readChapterIDs: string[],
  snapshot: SeriesChapterSnapshot,
) {
  return normalizeSeriesRecord(site, comicsID, {
    site,
    comicsID,
    title: previousRow?.title || "",
    cover: previousRow?.cover || "",
    url: previousRow?.url || "",
    chapterList: snapshot.chapterList,
    chapters: snapshot.chapters,
    lastRead: previousRow?.lastRead || "",
    read: readChapterIDs,
  });
}

function createSeriesUpdateKeyRange(seriesKey: string) {
  if (typeof IDBKeyRange === "undefined") {
    return null;
  }
  return IDBKeyRange.bound([seriesKey, ""], [seriesKey, "\uffff"]);
}

const UPDATES_REBALANCE_POSITION_THRESHOLD = -1024;

async function deleteSeriesUpdatesInTransaction(
  updatesStore: IDBObjectStore,
  seriesKey: string,
) {
  const keyRange = createSeriesUpdateKeyRange(seriesKey);
  if (keyRange) {
    await requestToPromise(updatesStore.delete(keyRange));
    return;
  }

  const updates = await loadUpdatesInTransaction(updatesStore);
  for (const item of updates) {
    if (item.seriesKey !== seriesKey) continue;
    await requestToPromise(updatesStore.delete([item.seriesKey, item.chapterID]));
  }
}

async function deleteSeriesReadsInTransaction(
  readsStore: IDBObjectStore,
  seriesKey: string,
) {
  const readKeys = await requestToPromise<IDBValidKey[]>(
    readsStore.index("seriesKey").getAllKeys(seriesKey),
  );
  for (const key of readKeys) {
    await requestToPromise(readsStore.delete(key));
  }
}

async function prependOrderedSeriesKeyInTransaction(
  store: IDBObjectStore,
  seriesKey: string,
  input: {
    currentRows: Array<{ seriesKey: string; position: number; checkedAt?: number }>;
    limit?: number;
    resolveRowData?: (row?: { checkedAt?: number }) => Record<string, unknown>;
  },
) {
  const { currentRows, limit = Number.POSITIVE_INFINITY, resolveRowData } = input;
  const existingRow = currentRows.find((row) => row.seriesKey === seriesKey);
  const nextKeys = uniqueStrings(
    [seriesKey, ...currentRows.map((row) => row.seriesKey)],
    limit,
  );
  const keysToDelete = currentRows
    .map((row) => row.seriesKey)
    .filter((currentSeriesKey) => !nextKeys.includes(currentSeriesKey));
  for (const keyToDelete of keysToDelete) {
    await requestToPromise(store.delete(keyToDelete));
  }

  if (nextKeys[0] === seriesKey && currentRows[0]?.seriesKey === seriesKey) {
    return;
  }

  const minPosition = currentRows.reduce(
    (currentMin, row) => Math.min(currentMin, row.position),
    0,
  );
  const nextPosition = currentRows.length === 0 ? 0 : minPosition - 1;
  await requestToPromise(
    store.put({
      seriesKey,
      position: nextPosition,
      ...(resolveRowData ? resolveRowData(existingRow) : {}),
    }),
  );
}

async function removeOrderedSeriesKeyInTransaction(
  store: IDBObjectStore,
  seriesKey: string,
) {
  await requestToPromise(store.delete(seriesKey));
}

async function prependSeriesUpdatesInTransaction(
  updatesStore: IDBObjectStore,
  seriesKey: string,
  chapterIDs: string[],
) {
  const nextChapterIDs = uniqueStrings(chapterIDs).filter(Boolean);
  if (nextChapterIDs.length === 0) {
    return;
  }

  const existingUpdates = await loadUpdatesInTransaction(updatesStore);
  const minPosition = existingUpdates.reduce(
    (currentMin, row) => Math.min(currentMin, row.position),
    0,
  );
  const firstPosition = minPosition - nextChapterIDs.length;

  for (let index = 0; index < nextChapterIDs.length; index += 1) {
    const chapterID = nextChapterIDs[index];
    await requestToPromise(updatesStore.delete([seriesKey, chapterID]));
    await requestToPromise(
      updatesStore.put({
        seriesKey,
        chapterID,
        position: firstPosition + index,
      }),
    );
  }

  if (firstPosition <= UPDATES_REBALANCE_POSITION_THRESHOLD) {
    await rebalanceUpdatesInTransaction(updatesStore);
  }
}

async function rebalanceUpdatesInTransaction(updatesStore: IDBObjectStore) {
  const orderedUpdates = await loadUpdatesInTransaction(updatesStore);
  await requestToPromise(updatesStore.clear());
  for (let position = 0; position < orderedUpdates.length; position += 1) {
    const row = orderedUpdates[position];
    await requestToPromise(
      updatesStore.put({
        seriesKey: row.seriesKey,
        chapterID: row.chapterID,
        position,
      }),
    );
  }
}

async function hasSeriesUpdatesInTransaction(
  updatesStore: IDBObjectStore,
  seriesKey: string,
) {
  const keyRange = createSeriesUpdateKeyRange(seriesKey);
  if (keyRange) {
    const count = await requestToPromise<number>(updatesStore.count(keyRange));
    return Number(count || 0) > 0;
  }

  const updates = await requestToPromise<LibraryUpdateRecord[]>(updatesStore.getAll());
  return updates.some((item) => item.seriesKey === seriesKey);
}

async function pruneSeriesCacheIfOrphanedInTransaction(
  stores: {
    seriesStore: IDBObjectStore;
    chaptersStore: IDBObjectStore;
    readsStore: IDBObjectStore;
    subscriptionsStore: IDBObjectStore;
    historyStore: IDBObjectStore;
    updatesStore: IDBObjectStore;
  },
  seriesKey: string,
) {
  const {
    seriesStore,
    chaptersStore,
    readsStore,
    subscriptionsStore,
    historyStore,
    updatesStore,
  } = stores;
  const [seriesRow, subscriptionRow, historyRow, hasSeriesUpdates] = await Promise.all([
    requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey)),
    requestToPromise<SubscriptionRow | undefined>(subscriptionsStore.get(seriesKey)),
    requestToPromise(historyStore.get(seriesKey)),
    hasSeriesUpdatesInTransaction(updatesStore, seriesKey),
  ]);

  if (
    !seriesRow ||
    subscriptionRow ||
    historyRow ||
    hasSeriesUpdates
  ) {
    return false;
  }

  await requestToPromise(seriesStore.delete(seriesKey));
  const chapterKeys = await requestToPromise<IDBValidKey[]>(
    chaptersStore.index("seriesKey").getAllKeys(seriesKey),
  );
  for (const key of chapterKeys) {
    await requestToPromise(chaptersStore.delete(key));
  }
  await deleteSeriesReadsInTransaction(readsStore, seriesKey);
  return true;
}

async function mutateSeriesUpdates(
  site: SiteKey,
  comicsID: string,
  mutator: (updatesStore: IDBObjectStore, seriesKey: string) => Promise<void>,
  source: string,
  options: {
    pruneIfOrphaned?: boolean;
  } = {},
) {
  await ensureLibraryReady();
  const seriesKey = buildSeriesKey(site, comicsID);
  const storeNames = [
    UPDATES_STORE,
    ...(options.pruneIfOrphaned
      ? [SERIES_STORE, CHAPTERS_STORE, READS_STORE, SUBSCRIPTIONS_STORE, HISTORY_STORE]
      : []),
  ] as const;
  const db = await openLibraryDb();
  const transaction = db.transaction(storeNames, "readwrite");
  const done = transactionDone(transaction);
  const updatesStore = transaction.objectStore(UPDATES_STORE);
  const seriesStore = options.pruneIfOrphaned
    ? transaction.objectStore(SERIES_STORE)
    : null;
  const chaptersStore = options.pruneIfOrphaned
    ? transaction.objectStore(CHAPTERS_STORE)
    : null;
  const readsStore = options.pruneIfOrphaned
    ? transaction.objectStore(READS_STORE)
    : null;
  const subscriptionsStore = options.pruneIfOrphaned
    ? transaction.objectStore(SUBSCRIPTIONS_STORE)
    : null;
  const historyStore = options.pruneIfOrphaned
    ? transaction.objectStore(HISTORY_STORE)
    : null;
  await mutator(updatesStore, seriesKey);
  const updatesCount = await requestToPromise<number>(updatesStore.count());
  const pruned = options.pruneIfOrphaned && seriesStore && chaptersStore && readsStore && subscriptionsStore && historyStore
    ? await pruneSeriesCacheIfOrphanedInTransaction(
        {
          seriesStore,
          chaptersStore,
          readsStore,
          subscriptionsStore,
          historyStore,
          updatesStore,
        },
        seriesKey,
      )
    : false;
  await done;
  await emitLibrarySignal(
    source,
    ["updates", ...(pruned ? ["series" as const] : [])],
    [seriesKey],
  );
  return Number(updatesCount || 0);
}

async function rewriteHistoryStore(
  seriesKey: string,
  updater: (seriesKeys: string[]) => string[],
  source: string,
  options: {
    pruneIfOrphaned?: boolean;
  } = {},
) {
  await ensureLibraryReady();
  const storeNames = options.pruneIfOrphaned
    ? [
        SERIES_STORE,
        CHAPTERS_STORE,
        READS_STORE,
        SUBSCRIPTIONS_STORE,
        HISTORY_STORE,
        UPDATES_STORE,
      ]
    : [HISTORY_STORE];
  const db = await openLibraryDb();
  const transaction = db.transaction(storeNames, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(HISTORY_STORE);
  const seriesStore = options.pruneIfOrphaned
    ? transaction.objectStore(SERIES_STORE)
    : null;
  const chaptersStore = options.pruneIfOrphaned
    ? transaction.objectStore(CHAPTERS_STORE)
    : null;
  const readsStore = options.pruneIfOrphaned
    ? transaction.objectStore(READS_STORE)
    : null;
  const subscriptionsStore = options.pruneIfOrphaned
    ? transaction.objectStore(SUBSCRIPTIONS_STORE)
    : null;
  const historyStore = options.pruneIfOrphaned
    ? transaction.objectStore(HISTORY_STORE)
    : null;
  const updatesStore = options.pruneIfOrphaned
    ? transaction.objectStore(UPDATES_STORE)
    : null;
  const currentRows = await loadRowsByPositionInTransaction<{
    seriesKey: string;
    position: number;
  }>(store);
  const currentKeys = currentRows.map((row) => row.seriesKey);
  const nextKeys = updater(currentKeys);
  const removed = currentKeys.includes(seriesKey) && !nextKeys.includes(seriesKey);
  const prepended = nextKeys[0] === seriesKey;

  if (removed) {
    await removeOrderedSeriesKeyInTransaction(store, seriesKey);
  } else if (prepended) {
    await prependOrderedSeriesKeyInTransaction(store, seriesKey, {
      currentRows,
      limit: HISTORY_LIMIT,
    });
  } else {
    await writeOrderedSeriesKeysInTransaction(store, nextKeys);
  }
  const pruned = options.pruneIfOrphaned && seriesStore && chaptersStore && readsStore && subscriptionsStore && historyStore && updatesStore
    ? await pruneSeriesCacheIfOrphanedInTransaction(
        {
          seriesStore,
          chaptersStore,
          readsStore,
          subscriptionsStore,
          historyStore,
          updatesStore,
        },
        seriesKey,
      )
    : false;
  await done;
  await emitLibrarySignal(
    source,
    ["history", ...(pruned ? ["series" as const] : [])],
    [seriesKey],
  );
}

export async function setSeriesSubscriptionByKey(seriesKey: string, subscribed: boolean) {
  await ensureLibraryReady();
  const storeNames = subscribed
    ? [SERIES_STORE, SUBSCRIPTIONS_STORE]
    : [
        SERIES_STORE,
        CHAPTERS_STORE,
        READS_STORE,
        SUBSCRIPTIONS_STORE,
        HISTORY_STORE,
        UPDATES_STORE,
      ];
  const db = await openLibraryDb();
  const transaction = db.transaction(storeNames, "readwrite");
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const [seriesRow, subscriptionRows] = await Promise.all([
    requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey)),
    loadOrderedSubscriptionRowsInTransaction(subscriptionsStore),
  ]);
  const hasSubscription = subscriptionRows.some(
    (row) => row.seriesKey === seriesKey,
  );

  if (subscribed && !seriesRow) {
    if (hasSubscription) {
      await removeOrderedSeriesKeyInTransaction(subscriptionsStore, seriesKey);
    }
    await done;
    if (hasSubscription) {
      await emitLibrarySignal(
        "setSubscription",
        ["subscriptions"],
        [seriesKey],
      );
    }
    return false;
  }

  if (subscribed) {
    await prependOrderedSeriesKeyInTransaction(subscriptionsStore, seriesKey, {
      currentRows: subscriptionRows,
      resolveRowData: (row?: { checkedAt?: number }) => ({
        checkedAt: Number(row?.checkedAt || 0),
      }),
    });
  } else {
    await removeOrderedSeriesKeyInTransaction(subscriptionsStore, seriesKey);
  }

  const pruned = !subscribed
    ? await pruneSeriesCacheIfOrphanedInTransaction(
        {
          seriesStore,
          chaptersStore: transaction.objectStore(CHAPTERS_STORE),
          readsStore: transaction.objectStore(READS_STORE),
          subscriptionsStore,
          historyStore: transaction.objectStore(HISTORY_STORE),
          updatesStore: transaction.objectStore(UPDATES_STORE),
        },
        seriesKey,
      )
    : false;
  await done;
  await emitLibrarySignal(
    "setSubscription",
    ["subscriptions", ...(pruned ? ["series" as const] : [])],
    [seriesKey],
  );
  return subscribed;
}

export async function toggleSeriesSubscriptionByKey(seriesKey: string) {
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
  const subscriptionRows = await loadOrderedSubscriptionRowsInTransaction(
    subscriptionsStore,
  );
  const nextSubscribed = !subscriptionRows.some((row) => row.seriesKey === seriesKey);
  if (
    nextSubscribed &&
    !(await requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey)))
  ) {
    await done;
    return false;
  }
  if (nextSubscribed) {
    await prependOrderedSeriesKeyInTransaction(subscriptionsStore, seriesKey, {
      currentRows: subscriptionRows,
      resolveRowData: (row?: { checkedAt?: number }) => ({
        checkedAt: Number(row?.checkedAt || 0),
      }),
    });
  } else {
    await removeOrderedSeriesKeyInTransaction(subscriptionsStore, seriesKey);
  }
  const pruned = !nextSubscribed
    ? await pruneSeriesCacheIfOrphanedInTransaction(
        {
          seriesStore,
          chaptersStore,
          readsStore,
          subscriptionsStore,
          historyStore,
          updatesStore,
        },
        seriesKey,
      )
    : false;
  await done;
  await emitLibrarySignal(
    "toggleSubscription",
    ["subscriptions", ...(pruned ? ["series" as const] : [])],
    [seriesKey],
  );
  return nextSubscribed;
}

export async function setSeriesSubscription(
  site: SiteKey,
  comicsID: string,
  subscribed: boolean,
) {
  return setSeriesSubscriptionByKey(buildSeriesKey(site, comicsID), subscribed);
}

export async function markSubscriptionCheckedByKey(
  seriesKey: string,
  checkedAt = Date.now(),
) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([SUBSCRIPTIONS_STORE], "readwrite");
  const done = transactionDone(transaction);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const row = await requestToPromise<SubscriptionRow | undefined>(
    subscriptionsStore.get(seriesKey),
  );
  if (row) {
    await requestToPromise(
      subscriptionsStore.put({
        ...row,
        checkedAt,
      }),
    );
  }
  await done;
}

export async function dismissSeriesUpdate(
  site: SiteKey,
  comicsID: string,
  chapterID?: string,
) {
  return mutateSeriesUpdates(
    site,
    comicsID,
    async (updatesStore, seriesKey) => {
      if (chapterID) {
        await requestToPromise(updatesStore.delete([seriesKey, chapterID]));
        return;
      }
      await deleteSeriesUpdatesInTransaction(updatesStore, seriesKey);
    },
    "dismissUpdate",
    {
      pruneIfOrphaned: true,
    },
  );
}

export async function removeSeriesFromHistory(site: SiteKey, comicsID: string) {
  const seriesKey = buildSeriesKey(site, comicsID);
  await rewriteHistoryStore(
    seriesKey,
    (seriesKeys) => seriesKeys.filter((item) => item !== seriesKey),
    "removeHistory",
    {
      pruneIfOrphaned: true,
    },
  );
}

type SeriesCleanupStores = {
  seriesStore: IDBObjectStore;
  chaptersStore: IDBObjectStore;
  readsStore: IDBObjectStore;
  subscriptionsStore: IDBObjectStore;
  historyStore: IDBObjectStore;
  updatesStore: IDBObjectStore;
};

const SERIES_CLEANUP_STORES = [
  SERIES_STORE,
  CHAPTERS_STORE,
  READS_STORE,
  SUBSCRIPTIONS_STORE,
  HISTORY_STORE,
  UPDATES_STORE,
] as const;

function getSeriesCleanupStores(
  transaction: IDBTransaction,
): SeriesCleanupStores {
  return {
    seriesStore: transaction.objectStore(SERIES_STORE),
    chaptersStore: transaction.objectStore(CHAPTERS_STORE),
    readsStore: transaction.objectStore(READS_STORE),
    subscriptionsStore: transaction.objectStore(SUBSCRIPTIONS_STORE),
    historyStore: transaction.objectStore(HISTORY_STORE),
    updatesStore: transaction.objectStore(UPDATES_STORE),
  };
}

async function abortSeriesCleanup(
  transaction: IDBTransaction,
  done: Promise<void>,
) {
  try {
    transaction.abort();
  } catch {
    // A failed IndexedDB request may already have aborted the transaction.
  }
  await done.catch(() => undefined);
}

async function deleteSeriesDataInTransaction(
  stores: SeriesCleanupStores,
  seriesKey: string,
) {
  const {
    seriesStore,
    chaptersStore,
    readsStore,
    subscriptionsStore,
    historyStore,
    updatesStore,
  } = stores;
  await requestToPromise(seriesStore.delete(seriesKey));
  const chapterKeys = await requestToPromise<IDBValidKey[]>(
    chaptersStore.index("seriesKey").getAllKeys(seriesKey),
  );
  for (const key of chapterKeys) {
    await requestToPromise(chaptersStore.delete(key));
  }
  await deleteSeriesReadsInTransaction(readsStore, seriesKey);
  await removeOrderedSeriesKeyInTransaction(subscriptionsStore, seriesKey);
  await removeOrderedSeriesKeyInTransaction(historyStore, seriesKey);
  await deleteSeriesUpdatesInTransaction(updatesStore, seriesKey);
}

export async function unsubscribeSeriesByKey(
  seriesKey: string,
  { clearSeriesData }: { clearSeriesData: boolean },
) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction(SERIES_CLEANUP_STORES, "readwrite");
  const done = transactionDone(transaction);
  const stores = getSeriesCleanupStores(transaction);
  let removedSeries = clearSeriesData;
  let updatesCount: number;
  try {
    if (clearSeriesData) {
      await deleteSeriesDataInTransaction(stores, seriesKey);
    } else {
      await removeOrderedSeriesKeyInTransaction(
        stores.subscriptionsStore,
        seriesKey,
      );
      await deleteSeriesUpdatesInTransaction(stores.updatesStore, seriesKey);
      removedSeries = await pruneSeriesCacheIfOrphanedInTransaction(
        stores,
        seriesKey,
      );
    }
    updatesCount = await requestToPromise<number>(stores.updatesStore.count());
  } catch (error) {
    await abortSeriesCleanup(transaction, done);
    throw error;
  }
  await done;
  await emitLibrarySignal(
    clearSeriesData ? "removeSeries" : "unsubscribeSeries",
    [
      ...(removedSeries ? ["series" as const] : []),
      "subscriptions",
      ...(clearSeriesData ? ["history" as const] : []),
      "updates",
    ],
    [seriesKey],
  );
  return Number(updatesCount || 0);
}

export async function removeSeriesCascade(site: SiteKey, comicsID: string) {
  return unsubscribeSeriesByKey(buildSeriesKey(site, comicsID), {
    clearSeriesData: true,
  });
}

export async function cleanupUnsubscribedSeries(): Promise<SeriesCleanupResult> {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction(SERIES_CLEANUP_STORES, "readwrite");
  const done = transactionDone(transaction);
  const stores = getSeriesCleanupStores(transaction);
  let seriesKeys: string[] = [];
  let updatesCount: number;
  try {
    const [subscriptionKeys, ...allKeys] = await Promise.all([
      requestToPromise<IDBValidKey[]>(stores.subscriptionsStore.getAllKeys()),
      ...[
        stores.seriesStore,
        stores.chaptersStore,
        stores.readsStore,
        stores.historyStore,
        stores.updatesStore,
      ].map((store) => requestToPromise<IDBValidKey[]>(store.getAllKeys())),
    ]);
    const subscribed = new Set(subscriptionKeys.map(String));
    // Keys only: include orphaned child rows without loading chapter metadata.
    seriesKeys = Array.from(
      new Set(
        allKeys.flat().map((key) => String(Array.isArray(key) ? key[0] : key)),
      ),
    ).filter((key) => !subscribed.has(key));
    for (const seriesKey of seriesKeys) {
      await deleteSeriesDataInTransaction(stores, seriesKey);
    }
    updatesCount = await requestToPromise<number>(stores.updatesStore.count());
  } catch (error) {
    await abortSeriesCleanup(transaction, done);
    throw error;
  }
  await done;
  if (seriesKeys.length) {
    // A whole-library hint stays small even when years of orphaned caches are removed.
    await emitLibrarySignal("cleanupUnsubscribedSeries", [
      "series",
      "history",
      "updates",
    ]);
  }
  return {
    removedSeriesCount: seriesKeys.length,
    updatesCount: Number(updatesCount || 0),
  };
}

export async function applyReaderSeriesState(
  site: SiteKey,
  comicsID: string,
  record: Partial<SeriesRecord>,
  chapterID: string,
  options: {
    requireExistingSeries?: boolean;
    chapterGroups?: ChapterGroup[];
  } = {},
): Promise<ReaderSeriesMutationResult> {
  return persistSeriesRecordState(site, comicsID, {
    record,
    readChapterID: chapterID,
    addHistory: true,
    dismissChapterID: chapterID,
    includeSubscriptionState: true,
    requireExistingSeries: options.requireExistingSeries,
    chapterGroups: options.chapterGroups,
  });
}

export async function applyReadProgress(
  site: SiteKey,
  comicsID: string,
  chapterID: string,
): Promise<ReadProgressMutationResult> {
  const result = await persistSeriesRecordState(site, comicsID, {
    readChapterID: chapterID,
    dismissChapterID: chapterID,
  });
  return {
    seriesKey: result.seriesKey,
    readChapterIDs: result.readChapterIDs,
    updatesCount: result.updatesCount,
  };
}

export async function applyBackgroundSeriesRefresh(
  site: SiteKey,
  comicsID: string,
  snapshot: SeriesChapterSnapshot,
  newChapterIDs: string[],
): Promise<BackgroundSeriesRefreshResult> {
  if (snapshot.chapterGroups) {
    validateChapterGroups(snapshot.chapterList, snapshot.chapterGroups);
  }
  await ensureLibraryReady();
  const seriesKey = buildSeriesKey(site, comicsID);
  const db = await openLibraryDb();
  const transaction = db.transaction(
    [SERIES_STORE, CHAPTERS_STORE, READS_STORE, UPDATES_STORE, SUBSCRIPTIONS_STORE],
    "readwrite",
  );
  const done = transactionDone(transaction);
  const seriesStore = transaction.objectStore(SERIES_STORE);
  const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  const readsStore = transaction.objectStore(READS_STORE);
  const updatesStore = transaction.objectStore(UPDATES_STORE);

  const [previousRow, readChapterIDs, subscriptionRow] = await Promise.all([
    requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey)),
    loadReadChapterIDsInTransaction(readsStore, seriesKey),
    requestToPromise<SubscriptionRow | undefined>(
      transaction.objectStore(SUBSCRIPTIONS_STORE).get(seriesKey),
    ),
  ]);
  if (!previousRow || !subscriptionRow) {
    const updatesCount = await requestToPromise<number>(updatesStore.count());
    await done;
    return { updatesCount: Number(updatesCount || 0) };
  }
  const mergedRecord = mergeBackgroundRefreshRecord(
    site,
    comicsID,
    previousRow,
    readChapterIDs,
    snapshot,
  );

  await requestToPromise(
    seriesStore.put(
      createSeriesRow(seriesKey, mergedRecord, {
        previousRow,
        ...(snapshot.chapterGroups
          ? {
              latestChapterIDsByGroup: getChapterGroupCheckpoints(
                snapshot.chapterGroups,
              ),
            }
          : {}),
      }),
    ),
  );
  await replaceSeriesChaptersInTransaction(chaptersStore, seriesKey, mergedRecord);
  await prependSeriesUpdatesInTransaction(updatesStore, seriesKey, newChapterIDs);
  const updatesCount = await requestToPromise<number>(updatesStore.count());
  await done;
  await emitLibrarySignal(
    "backgroundRefresh",
    ["series", "chapters", "updates"],
    [seriesKey],
  );
  return {
    updatesCount: Number(updatesCount || 0),
  };
}
