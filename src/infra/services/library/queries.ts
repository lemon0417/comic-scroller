import {
  type BackgroundSeriesState,
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

function readChapterIDFromRowKey(key: IDBValidKey) {
  if (Array.isArray(key) && typeof key[1] === "string") {
    return key[1];
  }
  return "";
}

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
  return sortRowsByPosition(updates)
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
}): PopupFeedSnapshot {
  const subscriptionKeys = sortRowsByPosition(input.subscriptions).map(
    (row) => row.seriesKey,
  );
  const historyKeys = sortRowsByPosition(input.history).map((row) => row.seriesKey);
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
  };
}

async function loadReferencedSeriesRows(
  seriesStore: IDBObjectStore,
  referencedKeys: string[],
) {
  if (referencedKeys.length === 0) {
    return {};
  }

  const seriesEntries = await Promise.all(
    referencedKeys.map(async (seriesKey) => {
      const row = await requestToPromise<SeriesRow | undefined>(seriesStore.get(seriesKey));
      if (!row) {
        return null;
      }
      return [seriesKey, row] as const;
    }),
  );

  return seriesEntries.reduce<Record<string, SeriesRow>>((acc, entry) => {
    if (!entry) {
      return acc;
    }
    const [seriesKey, row] = entry;
    acc[seriesKey] = row;
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
        sortRowsByPosition(updates)
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

export async function getBackgroundSeriesState(
  seriesKey: string,
): Promise<BackgroundSeriesState | null> {
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

  const chapterKeys = await requestToPromise<IDBValidKey[]>(
    chaptersStore.index("seriesKey").getAllKeys(seriesKey),
  );
  await done;

  return {
    url: row.url || "",
    cover: row.cover || "",
    knownChapterIDs: chapterKeys.map(readChapterIDFromRowKey).filter(Boolean),
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
  });
}
