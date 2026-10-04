import { requestToPromise } from "./db";
import type {
  ChapterRecord,
  ChapterRow,
  ReadRow,
  SeriesRecord,
  SeriesRow,
  SubscriptionRow,
  UpdateRow,
} from "./schema";
import {
  buildSeriesKey,
  normalizeChapterRecord,
  normalizeSeriesRecord,
  uniqueStrings,
} from "./schema";

export function sortRowsByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position);
}

export function sortSubscriptionRowsByCheckedAt(rows: SubscriptionRow[]) {
  return [...rows].sort(
    (a, b) =>
      Number(a.checkedAt || 0) - Number(b.checkedAt || 0) ||
      a.position - b.position ||
      a.seriesKey.localeCompare(b.seriesKey),
  );
}

function hasIndex(store: IDBObjectStore, indexName: string) {
  if (typeof store.index !== "function") {
    return false;
  }
  if (!("indexNames" in store) || !store.indexNames) {
    return true;
  }
  return store.indexNames.contains(indexName);
}

async function readRowsFromCursor<T>(
  source: IDBObjectStore | IDBIndex,
  options: {
    limit?: number;
    direction?: IDBCursorDirection;
  } = {},
) {
  const { limit = Number.POSITIVE_INFINITY, direction = "next" } = options;
  return new Promise<T[]>((resolve, reject) => {
    const rows: T[] = [];
    const request = source.openCursor(undefined, direction);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(rows);
        return;
      }
      rows.push(cursor.value as T);
      if (rows.length >= limit) {
        resolve(rows);
        return;
      }
      cursor.continue();
    };
  });
}

export async function loadRowsByPositionInTransaction<
  T extends { position: number },
>(store: IDBObjectStore, limit = Number.POSITIVE_INFINITY) {
  if (hasIndex(store, "position")) {
    return readRowsFromCursor<T>(store.index("position"), { limit });
  }
  const rows = await requestToPromise<T[]>(store.getAll());
  return sortRowsByPosition(rows).slice(
    0,
    Number.isFinite(limit) ? Math.max(0, limit) : rows.length,
  );
}

export async function loadSubscriptionKeysByCheckedAtInTransaction(
  store: IDBObjectStore,
  limit = Number.POSITIVE_INFINITY,
) {
  if (hasIndex(store, "checkedAtPosition")) {
    const rows = await readRowsFromCursor<SubscriptionRow>(
      store.index("checkedAtPosition"),
      {
        limit: Number.isFinite(limit)
          ? Math.max(0, limit)
          : Number.POSITIVE_INFINITY,
      },
    );
    return rows.map((row) => row.seriesKey).filter(Boolean);
  }

  const rows = await requestToPromise<SubscriptionRow[]>(store.getAll());
  return sortSubscriptionRowsByCheckedAt(rows)
    .slice(0, Number.isFinite(limit) ? Math.max(0, limit) : rows.length)
    .map((row) => row.seriesKey)
    .filter(Boolean);
}

export function resolveSeriesKeyInput(
  siteOrSeriesKey: string,
  comicsID?: string,
) {
  if (typeof comicsID === "string") {
    return buildSeriesKey(siteOrSeriesKey, comicsID);
  }
  return String(siteOrSeriesKey || "");
}

export function composeSeriesRecord(
  row: SeriesRow,
  chapterRows: ChapterRow[],
  readChapterIDs: string[] = [],
) {
  const sortedChapters = [...chapterRows].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const chapters = sortedChapters.reduce<Record<string, ChapterRecord>>(
    (acc, chapterRow) => {
      acc[chapterRow.chapterID] = normalizeChapterRecord(chapterRow);
      return acc;
    },
    {},
  );

  return normalizeSeriesRecord(row.site, row.comicsID, {
    ...row,
    chapterList: sortedChapters.map((chapterRow) => chapterRow.chapterID),
    chapters,
    read: readChapterIDs,
  });
}

function resolveSeriesRowSummary(
  record: SeriesRecord,
  input: {
    latestChapterID?: string;
    previousRow?: SeriesRow | null;
    readChapterRow?: ChapterRow | null;
  } = {},
) {
  const latestChapterID =
    typeof input.latestChapterID === "string"
      ? input.latestChapterID
      : record.chapterList[0] || input.previousRow?.latestChapterID || "";
  const latestChapter =
    (latestChapterID ? record.chapters[latestChapterID] : null) || null;
  const latestChapterTitle =
    latestChapter?.title ||
    (latestChapterID === input.previousRow?.latestChapterID
      ? input.previousRow.latestChapterTitle
      : "");
  const latestChapterHref =
    latestChapter?.href ||
    (latestChapterID === input.previousRow?.latestChapterID
      ? input.previousRow.latestChapterHref
      : "");

  const lastReadChapterID = record.lastRead || "";
  const readChapter =
    (input.readChapterRow ? normalizeChapterRecord(input.readChapterRow) : null) ||
    (lastReadChapterID ? record.chapters[lastReadChapterID] : null) ||
    (lastReadChapterID && lastReadChapterID === latestChapterID
      ? { title: latestChapterTitle, href: latestChapterHref }
      : null);
  const canReusePreviousLastRead = lastReadChapterID === input.previousRow?.lastRead;
  const lastReadTitle = lastReadChapterID
    ? readChapter?.title ||
      (canReusePreviousLastRead ? input.previousRow?.lastReadTitle || "" : "")
    : "";
  const lastReadHref = lastReadChapterID
    ? readChapter?.href ||
      (canReusePreviousLastRead ? input.previousRow?.lastReadHref || "" : "")
    : "";

  return {
    lastReadTitle,
    lastReadHref,
    latestChapterID,
    latestChapterTitle,
    latestChapterHref,
  };
}

export function createSeriesRow(
  seriesKey: string,
  record: SeriesRecord,
  input: {
    latestChapterID?: string;
    previousRow?: SeriesRow | null;
    readChapterRow?: ChapterRow | null;
    latestChapterIDsByGroup?: Record<string, string>;
  } = {},
): SeriesRow {
  const latestChapterIDsByGroup =
    input.latestChapterIDsByGroup ?? input.previousRow?.latestChapterIDsByGroup;
  return {
    seriesKey,
    site: record.site,
    comicsID: record.comicsID,
    title: record.title,
    cover: record.cover,
    url: record.url,
    lastRead: record.lastRead,
    ...resolveSeriesRowSummary(record, input),
    ...(latestChapterIDsByGroup ? { latestChapterIDsByGroup } : {}),
  };
}

export function createChapterRows(
  seriesKey: string,
  record: SeriesRecord,
): ChapterRow[] {
  return record.chapterList
    .filter(Boolean)
    .map((chapterID, orderIndex) => {
      const chapter = record.chapters[chapterID];
      return {
        seriesKey,
        chapterID,
        title: chapter?.title || "",
        href: chapter?.href || "",
        orderIndex,
      };
    });
}

function sortChapterRowsByOrderIndex(rows: ChapterRow[]) {
  return [...rows].sort((a, b) => a.orderIndex - b.orderIndex);
}

function haveSameChapterRows(left: ChapterRow[], right: ChapterRow[]) {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = sortChapterRowsByOrderIndex(left);
  const sortedRight = sortChapterRowsByOrderIndex(right);
  for (let index = 0; index < sortedLeft.length; index += 1) {
    const leftRow = sortedLeft[index];
    const rightRow = sortedRight[index];
    if (
      leftRow.seriesKey !== rightRow.seriesKey ||
      leftRow.chapterID !== rightRow.chapterID ||
      leftRow.title !== rightRow.title ||
      leftRow.href !== rightRow.href ||
      leftRow.orderIndex !== rightRow.orderIndex
    ) {
      return false;
    }
  }

  return true;
}

export function createReadRows(
  seriesKey: string,
  record: SeriesRecord,
): ReadRow[] {
  return uniqueStrings([...record.read, record.lastRead])
    .filter(Boolean)
    .map((chapterID) => ({
      seriesKey,
      chapterID,
    }));
}

export async function replaceSeriesChaptersInTransaction(
  chaptersStore: IDBObjectStore,
  seriesKey: string,
  record: SeriesRecord,
) {
  const chapterIndex = chaptersStore.index("seriesKey");
  const existingRows = await requestToPromise<ChapterRow[]>(
    chapterIndex.getAll(seriesKey),
  );
  const nextRows = createChapterRows(seriesKey, record);
  if (haveSameChapterRows(existingRows, nextRows)) {
    return false;
  }
  for (const row of existingRows) {
    await requestToPromise(chaptersStore.delete([row.seriesKey, row.chapterID]));
  }
  for (const row of nextRows) {
    await requestToPromise(chaptersStore.put(row));
  }
  return true;
}

export async function loadReadChapterIDsInTransaction(
  readsStore: IDBObjectStore,
  seriesKey: string,
) {
  const readKeys = await requestToPromise<IDBValidKey[]>(
    readsStore.index("seriesKey").getAllKeys(seriesKey),
  );
  return uniqueStrings(
    readKeys.map((key) => {
      if (Array.isArray(key) && typeof key[1] === "string") {
        return key[1];
      }
      return "";
    }),
  ).filter(Boolean);
}

export async function replaceSeriesReadsInTransaction(
  readsStore: IDBObjectStore,
  seriesKey: string,
  record: SeriesRecord,
) {
  const existingKeys = await requestToPromise<IDBValidKey[]>(
    readsStore.index("seriesKey").getAllKeys(seriesKey),
  );
  for (const key of existingKeys) {
    await requestToPromise(readsStore.delete(key));
  }
  for (const row of createReadRows(seriesKey, record)) {
    await requestToPromise(readsStore.put(row));
  }
}

export async function addReadChapterInTransaction(
  readsStore: IDBObjectStore,
  seriesKey: string,
  chapterID: string,
) {
  if (!seriesKey || !chapterID) {
    return;
  }
  await requestToPromise(
    readsStore.put({
      seriesKey,
      chapterID,
    }),
  );
}

export async function loadOrderedSeriesKeysInTransaction(store: IDBObjectStore) {
  const rows = await loadRowsByPositionInTransaction<{
    seriesKey: string;
    position: number;
  }>(store);
  return rows.map((row) => row.seriesKey);
}

export async function loadOrderedSubscriptionRowsInTransaction(
  store: IDBObjectStore,
) {
  return loadRowsByPositionInTransaction<SubscriptionRow>(store);
}

export async function writeOrderedSeriesKeysInTransaction(
  store: IDBObjectStore,
  seriesKeys: string[],
  resolveRowData?: (
    seriesKey: string,
    position: number,
  ) => Record<string, unknown>,
) {
  await requestToPromise(store.clear());
  const nextSeriesKeys = uniqueStrings(seriesKeys);
  for (let position = 0; position < nextSeriesKeys.length; position += 1) {
    const seriesKey = nextSeriesKeys[position];
    await requestToPromise(
      store.put({
        seriesKey,
        position,
        ...(resolveRowData ? resolveRowData(seriesKey, position) : {}),
      }),
    );
  }
}

export async function loadUpdatesInTransaction(
  store: IDBObjectStore,
  limit = Number.POSITIVE_INFINITY,
) {
  return loadRowsByPositionInTransaction<UpdateRow>(store, limit);
}
