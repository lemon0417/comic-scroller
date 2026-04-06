import {
  buildSeriesKey,
  type ChapterRow,
  CHAPTERS_STORE,
  HISTORY_LIMIT,
  HISTORY_STORE,
  type LibraryUpdateRecord,
  normalizeSeriesRecord,
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
  composeSeriesRecord,
  createSeriesRow,
  emitLibrarySignal,
  ensureLibraryReady,
  loadOrderedSeriesKeysInTransaction,
  loadUpdatesInTransaction,
  openLibraryDb,
  replaceSeriesChaptersInTransaction,
  requestToPromise,
  transactionDone,
  writeOrderedSeriesKeysInTransaction,
  writeUpdatesInTransaction,
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
  const storeNames = [
    SERIES_STORE,
    ...(shouldPersistChapterCache || shouldLoadReadChapter ? [CHAPTERS_STORE] : []),
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
  const readChapterRow =
    shouldLoadReadChapter && chaptersStore && input.readChapterID
      ? await requestToPromise<ChapterRow | undefined>(
          chaptersStore.get([seriesKey, input.readChapterID]),
        )
      : undefined;
  const previousRecord = previousRow
    ? composeSeriesRecord(previousRow, previousChapters)
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

  if (historyStore) {
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
  const nextKeys = updater(currentKeys);
  const subscriptionRowsByKey =
    storeName === SUBSCRIPTIONS_STORE
      ? (await requestToPromise<SubscriptionRow[]>(store.getAll())).reduce<
          Record<string, SubscriptionRow>
        >((acc, row) => {
          acc[row.seriesKey] = row;
          return acc;
        }, {})
      : {};
  if (storeName === SUBSCRIPTIONS_STORE) {
    await writeOrderedSeriesKeysInTransaction(
      store,
      nextKeys,
      (seriesKey) => ({
        checkedAt: Number(subscriptionRowsByKey[seriesKey]?.checkedAt || 0),
      }),
    );
  } else {
    await writeOrderedSeriesKeysInTransaction(store, nextKeys);
  }
  await done;
  await emitLibrarySignal(source, [scope], [seriesKey]);
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

export async function toggleSeriesSubscriptionByKey(seriesKey: string) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([SUBSCRIPTIONS_STORE], "readwrite");
  const done = transactionDone(transaction);
  const subscriptionsStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
  const subscriptionRows = await requestToPromise<SubscriptionRow[]>(
    subscriptionsStore.getAll(),
  );
  const nextSubscribed = !subscriptionRows.some((row) => row.seriesKey === seriesKey);
  const currentKeys = await loadOrderedSeriesKeysInTransaction(subscriptionsStore);
  const rowsBySeriesKey = subscriptionRows.reduce<Record<string, SubscriptionRow>>(
    (acc, row) => {
      acc[row.seriesKey] = row;
      return acc;
    },
    {},
  );
  const nextKeys = nextSubscribed
    ? uniqueStrings([seriesKey, ...currentKeys])
    : currentKeys.filter((item) => item !== seriesKey);

  await writeOrderedSeriesKeysInTransaction(
    subscriptionsStore,
    nextKeys,
    (currentSeriesKey) => ({
      checkedAt: Number(rowsBySeriesKey[currentSeriesKey]?.checkedAt || 0),
    }),
  );
  await done;
  await emitLibrarySignal("toggleSubscription", ["subscriptions"], [seriesKey]);
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

export async function removeSeriesFromHistory(site: SiteKey, comicsID: string) {
  const seriesKey = buildSeriesKey(site, comicsID);
  await rewriteOrderedSeriesStore(
    HISTORY_STORE,
    seriesKey,
    (seriesKeys) => seriesKeys.filter((item) => item !== seriesKey),
    "removeHistory",
    "history",
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
