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
  addReadChapterInTransaction,
  composeSeriesRecord,
  createSeriesRow,
  emitLibrarySignal,
  ensureLibraryReady,
  loadOrderedSubscriptionRowsInTransaction,
  loadReadChapterIDsInTransaction,
  loadRowsByPositionInTransaction,
  loadUpdatesInTransaction,
  openLibraryDb,
  replaceSeriesChaptersInTransaction,
  replaceSeriesReadsInTransaction,
  requestToPromise,
  transactionDone,
  writeOrderedSeriesKeysInTransaction,
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

  const mergedRecord = mergeSeriesRecord(site, comicsID, previousRecord, input.record);

  if (input.readChapterID) {
    mergedRecord.lastRead = input.readChapterID;
    mergedRecord.read = uniqueStrings([...(mergedRecord.read || []), input.readChapterID]);
  }

  await requestToPromise(
    seriesStore.put(
      createSeriesRow(seriesKey, mergedRecord, {
        previousRow,
        readChapterRow,
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
      ...(input.addHistory ? ["history" as const] : []),
      ...(input.dismissChapterID ? ["updates" as const] : []),
    ],
    [seriesKey],
  );

  return {
    seriesKey,
    series: mergedRecord,
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
  const createdAt = Date.now();

  for (let index = 0; index < nextChapterIDs.length; index += 1) {
    const chapterID = nextChapterIDs[index];
    await requestToPromise(updatesStore.delete([seriesKey, chapterID]));
    await requestToPromise(
      updatesStore.put({
        seriesKey,
        chapterID,
        createdAt,
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
        createdAt: row.createdAt,
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

async function rewriteOrderedSeriesStore(
  storeName: typeof SUBSCRIPTIONS_STORE | typeof HISTORY_STORE,
  seriesKey: string,
  updater: (seriesKeys: string[]) => string[],
  source: string,
  scope: "subscriptions" | "history",
  options: {
    pruneIfOrphaned?: boolean;
  } = {},
) {
  await ensureLibraryReady();
  const storeNames = [
    storeName,
    ...(options.pruneIfOrphaned
      ? [SERIES_STORE, CHAPTERS_STORE, READS_STORE, SUBSCRIPTIONS_STORE, HISTORY_STORE, UPDATES_STORE]
      : []),
  ] as const;
  const db = await openLibraryDb();
  const transaction = db.transaction(storeNames, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(storeName);
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
  const currentRows =
    storeName === SUBSCRIPTIONS_STORE
      ? await loadOrderedSubscriptionRowsInTransaction(store)
      : await loadRowsByPositionInTransaction<{ seriesKey: string; position: number }>(store);
  const currentKeys = currentRows.map((row) => row.seriesKey);
  const nextKeys = updater(currentKeys);
  const removed = currentKeys.includes(seriesKey) && !nextKeys.includes(seriesKey);
  const prepended = nextKeys[0] === seriesKey;

  if (removed) {
    await removeOrderedSeriesKeyInTransaction(store, seriesKey);
  } else if (prepended) {
    await prependOrderedSeriesKeyInTransaction(store, seriesKey, {
      currentRows,
      ...(storeName === HISTORY_STORE
        ? { limit: HISTORY_LIMIT }
        : {}),
      ...(storeName === SUBSCRIPTIONS_STORE
        ? {
            resolveRowData: (row?: { checkedAt?: number }) => ({
              checkedAt: Number(row?.checkedAt || 0),
            }),
          }
        : {}),
    });
  } else {
    await writeOrderedSeriesKeysInTransaction(
      store,
      nextKeys,
      storeName === SUBSCRIPTIONS_STORE
        ? (currentSeriesKey) => {
            const row = currentRows.find(
              (item) => item.seriesKey === currentSeriesKey,
            ) as SubscriptionRow | undefined;
            return {
              checkedAt: Number(row?.checkedAt || 0),
            };
          }
        : undefined,
    );
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
    [scope, ...(pruned ? ["series" as const] : [])],
    [seriesKey],
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
    {
      pruneIfOrphaned: !subscribed,
    },
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
  await rewriteOrderedSeriesStore(
    HISTORY_STORE,
    seriesKey,
    (seriesKeys) => seriesKeys.filter((item) => item !== seriesKey),
    "removeHistory",
    "history",
    {
      pruneIfOrphaned: true,
    },
  );
}

export async function removeSeriesCascade(site: SiteKey, comicsID: string) {
  await ensureLibraryReady();
  const seriesKey = buildSeriesKey(site, comicsID);
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

  const previousRow = await requestToPromise<SeriesRow | undefined>(
    seriesStore.get(seriesKey),
  );
  const previousChapters = previousRow
    ? await requestToPromise<ChapterRow[]>(
        chaptersStore.index("seriesKey").getAll(seriesKey),
      )
    : [];
  const previousRecord = previousRow
    ? composeSeriesRecord(previousRow, previousChapters)
    : normalizeSeriesRecord(site, comicsID, {});
  const mergedRecord = mergeSeriesRecord(site, comicsID, previousRecord, record);

  await requestToPromise(
    seriesStore.put(
      createSeriesRow(seriesKey, mergedRecord, {
        previousRow,
      }),
    ),
  );
  await replaceSeriesChaptersInTransaction(chaptersStore, seriesKey, mergedRecord);
  await prependSeriesUpdatesInTransaction(updatesStore, seriesKey, newChapterIDs);
  const updatesCount = await requestToPromise<number>(updatesStore.count());
  await done;
  await emitLibrarySignal("backgroundRefresh", ["series", "updates"], [seriesKey]);
  return {
    series: mergedRecord,
    updatesCount: Number(updatesCount || 0),
  };
}
