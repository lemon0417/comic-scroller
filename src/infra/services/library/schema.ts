export const LIBRARY_SCHEMA_VERSION = 2;
export const LIBRARY_DB_VERSION = 5;
export const HISTORY_LIMIT = 50;
export const SITE_KEYS = ["dm5", "sf", "comicbus"] as const;
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

export type SiteKey = (typeof SITE_KEYS)[number];
type SeriesKey = string;

export type ChapterRecord = {
  title: string;
  href: string;
  chapter?: string;
};

export type SeriesRecord = {
  site: SiteKey;
  comicsID: string;
  title: string;
  cover: string;
  url: string;
  chapterList: string[];
  chapters: Record<string, ChapterRecord>;
  lastRead: string;
  read: string[];
};

export type LibraryUpdateRecord = {
  seriesKey: SeriesKey;
  chapterID: string;
  createdAt: number;
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
  read?: string[];
  lastReadTitle: string;
  lastReadHref: string;
  latestChapterID: string;
  latestChapterTitle: string;
  latestChapterHref: string;
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
  checkedAt?: number;
};

export type HistoryRow = {
  seriesKey: SeriesKey;
  position: number;
};

export type UpdateRow = LibraryUpdateRecord & {
  position: number;
};

export type LibrarySignal = {
  revision: string;
  changedAt: number;
  source: string;
  dbSchemaVersion: number;
  scopes: Array<"series" | "subscriptions" | "history" | "updates">;
  seriesKeys?: string[];
};

export type LibraryDumpV1 = {
  format: "comic-scroller-db-dump";
  formatVersion: 1;
  exportedAt: number;
  dbSchemaVersion: number;
  data: {
    series: SeriesRow[];
    chapters: ChapterRow[];
    subscriptions: SubscriptionRow[];
    history: HistoryRow[];
    updates: UpdateRow[];
  };
};

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

export function uniqueStrings(
  input: unknown,
  limit = Number.POSITIVE_INFINITY,
) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of Array.isArray(input) ? input : []) {
    const value = String(item || "");
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
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

function canonicalizeComicsID(site: string, comicsID: string) {
  const raw = String(comicsID || "");
  if (!raw) return "";
  if (site === "dm5") {
    if (/^\d+$/.test(raw)) {
      return `m${raw}`;
    }
    if (/^m\d+$/i.test(raw)) {
      return `m${raw.slice(1)}`;
    }
    return raw;
  }
  return raw;
}

export function buildSeriesKey(site: string, comicsID: string) {
  return `${site}:${canonicalizeComicsID(site, comicsID)}`;
}

export function parseSeriesKey(seriesKey: string) {
  const [site, ...rest] = String(seriesKey || "").split(":");
  return {
    site: site as SiteKey,
    comicsID: rest.join(":"),
  };
}

export function normalizeSeriesRecord(
  site: SiteKey,
  comicsID: string,
  record: unknown,
): SeriesRecord {
  const source = toRecord(record);
  const normalizedComicsID = canonicalizeComicsID(site, comicsID);
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
    lastRead: typeof source.lastRead === "string" ? source.lastRead : "",
    read: uniqueStrings(source.read),
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
