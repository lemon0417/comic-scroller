import type { AppEpic } from "@epics/types";

import * as eightComic from "./8comic";
import * as dm5 from "./dm5";
import * as manhuagui from "./manhuagui";

type SiteReaderEpics = {
  fetchChapterEpic: AppEpic;
  fetchImgSrcEpic: AppEpic;
  fetchImgListEpic: AppEpic;
  updateReadEpic: AppEpic;
};

const readerEpicsBySite: Record<string, SiteReaderEpics> = {
  manhuagui: {
    fetchChapterEpic: manhuagui.fetchChapterEpic,
    fetchImgSrcEpic: manhuagui.fetchImgSrcEpic,
    fetchImgListEpic: manhuagui.fetchImgListEpic,
    updateReadEpic: manhuagui.updateReadEpic,
  },
  dm5: {
    fetchChapterEpic: dm5.fetchChapterEpic,
    fetchImgSrcEpic: dm5.fetchImgSrcEpic,
    fetchImgListEpic: dm5.fetchImgListEpic,
    updateReadEpic: dm5.updateReadEpic,
  },
  "8comic": {
    fetchChapterEpic: eightComic.fetchChapterEpic,
    fetchImgSrcEpic: eightComic.fetchImgSrcEpic,
    fetchImgListEpic: eightComic.fetchImgListEpic,
    updateReadEpic: eightComic.updateReadEpic,
  },
};

export function getSiteReaderEpics(site: string) {
  return readerEpicsBySite[site];
}
