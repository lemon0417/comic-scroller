declare var chrome: any;

export const LIBRARY_SCHEMA_VERSION = 2;
export const LIBRARY_DB_VERSION = 1;
export const HISTORY_LIMIT = 50;
export const SITE_KEYS = ["dm5", "sf", "comicbus"] as const;
export const LIBRARY_SIGNAL_KEY = "librarySignal";

export const LIBRARY_DB_NAME = "comic-scroller-library";
export const META_STORE = "meta";
export const SERIES_STORE = "series";
export const CHAPTERS_STORE = "chapters";
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
export type SeriesKey = string;

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
  read: string[];
  updatedAt: number;
};

export type ChapterRow = {
  seriesKey: SeriesKey;
  chapterID: string;
  title: string;
  href: string;
  chapter?: string;
  orderIndex: number;
};

export type SubscriptionRow = {
  seriesKey: SeriesKey;
  position: number;
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

export type PopupFeedCategory = "update" | "subscribe" | "history";

export type PopupFeedEntry = {
  category: PopupFeedCategory;
  key: string;
  index: number;
  site: SiteKey;
  siteLabel: string;
  comicsID: string;
  chapterID: string;
  lastReadChapterID: string;
  lastChapterID: string;
  updateChapterID: string;
  continueChapterID: string;
  title: string;
  url: string;
  cover: string;
  lastReadTitle: string;
  lastReadHref: string;
  lastChapterTitle: string;
  lastChapterHref: string;
  updateChapterTitle: string;
  updateChapterHref: string;
  continueHref: string;
};

export type PopupFeedSnapshot = {
  update: PopupFeedEntry[];
  subscribe: PopupFeedEntry[];
  history: PopupFeedEntry[];
  continueReading: PopupFeedEntry | null;
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

export function getExtensionVersion() {
  try {
    return chrome?.runtime?.getManifest?.().version || "";
  } catch {
    return "";
  }
}

export function uniqueStrings(input: any, limit = Number.POSITIVE_INFINITY) {
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

export function normalizeChapterRecord(chapter: any): ChapterRecord {
  return {
    title: typeof chapter?.title === "string" ? chapter.title : "",
    href: typeof chapter?.href === "string" ? chapter.href : "",
    ...(typeof chapter?.chapter === "string" ? { chapter: chapter.chapter } : {}),
  };
}

export function canonicalizeComicsID(site: string, comicsID: string) {
  const raw = String(comicsID || "");
  if (!raw) return "";
  if (site === "dm5") {
    return raw.startsWith("m") ? raw : `m${raw}`;
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

export function normalizeSeriesRecord(site: SiteKey, comicsID: string, record: any): SeriesRecord {
  const normalizedComicsID = canonicalizeComicsID(site, comicsID);
  const normalizedChapterList = Array.isArray(record?.chapterList)
    ? record.chapterList.map((item: any) => String(item || "")).filter(Boolean)
    : [];
  const normalizedChapters = Object.entries(record?.chapters || {}).reduce<
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
    title: typeof record?.title === "string" ? record.title : "",
    cover: typeof record?.cover === "string" ? record.cover : "",
    url: typeof record?.url === "string" ? record.url : "",
    chapterList: normalizedChapterList,
    chapters: normalizedChapters,
    lastRead: typeof record?.lastRead === "string" ? record.lastRead : "",
    read: uniqueStrings(record?.read),
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

export function createEmptyPopupFeedSnapshot(): PopupFeedSnapshot {
  return {
    update: [],
    subscribe: [],
    history: [],
    continueReading: null,
  };
}
