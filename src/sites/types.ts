import type { AppEpic } from "@epics/types";

export type SiteAdapter = {
  key: string;
  baseURL: string;
  fetchMeta: (url: string, comicsID?: string) => unknown;
  epics: {
    fetchChapterEpic: AppEpic;
    fetchImgSrcEpic: AppEpic;
    fetchImgListEpic: AppEpic;
    updateReadEpic: AppEpic;
  };
};
