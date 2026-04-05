import type { AppEpic } from "@epics/types";
import type { ChapterRecord } from "@infra/services/library/schema";
import type { Observable } from "rxjs";

export type FetchMetaOptions = {
  includeCover?: boolean;
};

export type SiteMeta = {
  title?: string;
  cover?: string;
  chapterList: string[];
  chapters: Record<string, ChapterRecord>;
};

export type SiteMetaFetcher = (
  url: string,
  options?: FetchMetaOptions,
) => Observable<SiteMeta>;

export type SiteAdapter = {
  key: string;
  baseURL: string;
  fetchMeta: SiteMetaFetcher;
  epics: {
    fetchChapterEpic: AppEpic;
    fetchImgSrcEpic: AppEpic;
    fetchImgListEpic: AppEpic;
    updateReadEpic: AppEpic;
  };
};
