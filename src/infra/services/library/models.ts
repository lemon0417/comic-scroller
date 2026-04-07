import type { SeriesRecord, SiteKey } from "./schema";

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

export type ReaderSeriesState = {
  series: SeriesRecord | null;
  subscribed: boolean;
};

export type ReaderSeriesSyncState = {
  exists: boolean;
  subscribed: boolean;
};

export type BackgroundSeriesState = {
  url: string;
  cover: string;
  knownChapterIDs: string[];
};

export function createEmptyPopupFeedSnapshot(): PopupFeedSnapshot {
  return {
    update: [],
    subscribe: [],
    history: [],
    continueReading: null,
  };
}
