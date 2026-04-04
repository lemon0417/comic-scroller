import type { AppEpic } from "@epics/types";

export type FetchMetaOptions = {
  includeCover?: boolean;
};

export type SiteAdapter = {
  key: string;
  baseURL: string;
  fetchMeta: (
    url: string,
    comicsID?: string,
    options?: FetchMetaOptions,
  ) => unknown;
  epics: {
    fetchChapterEpic: AppEpic;
    fetchImgSrcEpic: AppEpic;
    fetchImgListEpic: AppEpic;
    updateReadEpic: AppEpic;
  };
};
