import type {
  ChapterRecord,
  LibraryUpdateRecord,
  SeriesKey,
  SeriesRecord,
  SiteKey,
} from "@domain/library";
import {
  buildSeriesKey,
  parseSeriesKey,
  SITE_KEYS,
  uniqueStrings,
} from "@domain/library";

export const LIBRARY_SCHEMA_VERSION = 2;
export const LIBRARY_DB_VERSION = 7;
export const HISTORY_LIMIT = 50;
export const LIBRARY_SIGNAL_KEY = "librarySignal";

export const LIBRARY_DB_NAME = "comic-scroller-library";
export const META_STORE = "meta";
export const SERIES_STORE = "series";
export const CHAPTERS_STORE = "chapters";
export const READS_STORE = "reads";
export const SUBSCRIPTIONS_STORE = "subscriptions";
export const HISTORY_STORE = "history";
export const UPDATES_STORE = "updates";
export const LIBRARY_META_KEY = "library-state";
export const LEGACY_STORAGE_KEYS = [
  "version",
  "history",
  "subscribe",
  "update",
  "dm5",
  "sf",
  "comicbus",
  "schemaVersion",
  "seriesByKey",
  "subscriptions",
  "updates",
];

export { buildSeriesKey, parseSeriesKey, SITE_KEYS, uniqueStrings };
export type {
  ChapterRecord,
  LibraryUpdateRecord,
  SeriesKey,
  SeriesRecord,
  SiteKey,
};

export type LibrarySnapshotV2 = {
  schemaVersion: 2;
  version: string;
  seriesByKey: Record<SeriesKey, SeriesRecord>;
  subscriptions: SeriesKey[];
  history: SeriesKey[];
  updates: LibraryUpdateRecord[];
};

export type SeriesRow = {
  seriesKey: SeriesKey;
  site: SiteKey;
  comicsID: string;
  title: string;
  cover: string;
  url: string;
  lastRead: string;
  lastReadTitle: string;
  lastReadHref: string;
  latestChapterID: string;
  latestChapterTitle: string;
  latestChapterHref: string;
  latestChapterIDsByGroup?: Record<string, string>;
};

export type ChapterRow = {
  seriesKey: SeriesKey;
  chapterID: string;
  title: string;
  href: string;
  orderIndex: number;
};

export type ReadRow = {
  seriesKey: SeriesKey;
  chapterID: string;
};

export type SubscriptionRow = {
  seriesKey: SeriesKey;
  position: number;
  checkedAt: number;
};

export type HistoryRow = {
  seriesKey: SeriesKey;
  position: number;
};

export type UpdateRow = LibraryUpdateRecord & {
  position: number;
};

export type LibraryDbRows = {
  series: SeriesRow[];
  chapters: ChapterRow[];
  reads: ReadRow[];
  subscriptions: SubscriptionRow[];
  history: HistoryRow[];
  updates: UpdateRow[];
};

export type LibraryDumpSeriesRow = SeriesRow & {
  read?: string[];
};

export type LibraryDumpSubscriptionRow = {
  seriesKey: SeriesKey;
  position: number;
  checkedAt?: number;
};

export type LibraryDumpRowsV1 = {
  series: LibraryDumpSeriesRow[];
  chapters: ChapterRow[];
  subscriptions: LibraryDumpSubscriptionRow[];
  history: HistoryRow[];
  updates: Array<UpdateRow & { createdAt?: number }>;
};

export type LibraryDumpChapterV2 = {
  chapterID: string;
  title: string;
  href: string;
};

export type LibraryDumpSeriesV2 = {
  site: SiteKey;
  comicsID: string;
  title: string;
  cover: string;
  url: string;
  lastRead: string;
  chapters: LibraryDumpChapterV2[];
  read?: string[];
};

export type LibraryDumpRowsV2 = {
  series: LibraryDumpSeriesV2[];
  subscriptions: Array<{
    seriesKey: string;
    checkedAt?: number;
  }>;
  history: string[];
  updates: LibraryUpdateRecord[];
};

export type LibrarySignal = {
  revision: string;
  changedAt: number;
  source: string;
  dbSchemaVersion: number;
  scopes: Array<
    "series" | "chapters" | "subscriptions" | "history" | "updates"
  >;
  seriesKeys?: string[];
};

export type LibraryDumpV1 = {
  format: "comic-scroller-db-dump";
  formatVersion: 1;
  exportedAt: number;
  dbSchemaVersion: number;
  data: LibraryDumpRowsV1;
};

export type LibraryDumpV2 = {
  format: "comic-scroller-db-dump";
  formatVersion: 2;
  exportedAt: number;
  dbSchemaVersion: number;
  data: LibraryDumpRowsV2;
};

export type LibraryDump = LibraryDumpV1 | LibraryDumpV2;

function toRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

export function getExtensionVersion() {
  try {
    return chrome?.runtime?.getManifest?.().version || "";
  } catch {
    return "";
  }
}

export function normalizeChapterRecord(chapter: unknown): ChapterRecord {
  const chapterRecord = toRecord(chapter);
  return {
    title:
      typeof chapterRecord.title === "string" ? chapterRecord.title : "",
    href:
      typeof chapterRecord.href === "string" ? chapterRecord.href : "",
    ...(typeof chapterRecord.chapter === "string"
      ? { chapter: chapterRecord.chapter }
      : {}),
  };
}

export function normalizeSeriesRecord(
  site: SiteKey,
  comicsID: string,
  record: unknown,
): SeriesRecord {
  const source = toRecord(record);
  const lastRead = typeof source.lastRead === "string" ? source.lastRead : "";
  const normalizedComicsID = parseSeriesKey(
    buildSeriesKey(site, comicsID),
  ).comicsID;
  const normalizedChapterList = Array.isArray(source.chapterList)
    ? source.chapterList.map((item: unknown) => String(item || "")).filter(Boolean)
    : [];
  const normalizedChapters = Object.entries(toRecord(source.chapters)).reduce<
    Record<string, ChapterRecord>
  >((acc, [chapterID, chapter]) => {
    const normalizedChapterID = String(chapterID || "");
    if (!normalizedChapterID) return acc;
    acc[normalizedChapterID] = normalizeChapterRecord(chapter);
    return acc;
  }, {});

  return {
    site,
    comicsID: normalizedComicsID,
    title: typeof source.title === "string" ? source.title : "",
    cover: typeof source.cover === "string" ? source.cover : "",
    url: typeof source.url === "string" ? source.url : "",
    chapterList: normalizedChapterList,
    chapters: normalizedChapters,
    lastRead,
    read: uniqueStrings([...uniqueStrings(source.read), lastRead]),
  };
}

export function createEmptyLibrarySnapshot(
  version = getExtensionVersion(),
): LibrarySnapshotV2 {
  return {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    version,
    seriesByKey: {},
    subscriptions: [],
    history: [],
    updates: [],
  };
}
