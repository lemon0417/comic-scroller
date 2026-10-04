import type { SeriesKey, SeriesRecord, SiteKey } from "./series";

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
  updateCount?: number;
  updatesTruncated?: boolean;
};

export type ReaderSeriesState = {
  series: SeriesRecord | null;
  subscribed: boolean;
};

export type ReaderSeriesSyncState = {
  exists: boolean;
  subscribed: boolean;
};

export type BackgroundRefreshCandidate = {
  seriesKey: SeriesKey;
  site: SiteKey;
  comicsID: string;
  url: string;
  latestChapterID: string;
  latestChapterIDsByGroup?: Record<string, string>;
};

export function createEmptyPopupFeedSnapshot(): PopupFeedSnapshot {
  return {
    update: [],
    subscribe: [],
    history: [],
    continueReading: null,
  };
}

export function getPopupUpdateCount(
  feed: Pick<PopupFeedSnapshot, "update" | "updateCount"> | null | undefined,
) {
  if (typeof feed?.updateCount === "number" && Number.isFinite(feed.updateCount)) {
    return Math.max(0, feed.updateCount);
  }
  return Array.isArray(feed?.update) ? feed.update.length : 0;
}
