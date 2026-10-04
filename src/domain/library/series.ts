export const SITE_KEYS = ["dm5", "sf", "comicbus", "manhuagui"] as const;

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

export type SeriesChapterSnapshot = Pick<
  SeriesRecord,
  "chapterList" | "chapters"
> & { chapterGroups?: ChapterGroup[] };

export type ChapterGroup = {
  id: string;
  chapterList: string[];
};

export type LibraryUpdateRecord = {
  seriesKey: SeriesKey;
  chapterID: string;
};

export type ReadProgressMutationResult = {
  seriesKey: SeriesKey;
  readChapterIDs: string[];
  updatesCount: number;
};

export type ReaderSeriesMutationResult = ReadProgressMutationResult & {
  subscribed: boolean;
};

export type BackgroundSeriesRefreshResult = {
  updatesCount: number;
};

export type SeriesCleanupResult = {
  removedSeriesCount: number;
  updatesCount: number;
};

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
