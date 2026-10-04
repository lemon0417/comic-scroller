import type { AppEpic } from "@epics/types";

import * as comicbus from "./comicbus";
import * as dm5 from "./dm5";
import * as manhuagui from "./manhuagui";
import * as sf from "./sf";

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
  sf: {
    fetchChapterEpic: sf.fetchChapterEpic,
    fetchImgSrcEpic: sf.fetchImgSrcEpic,
    fetchImgListEpic: sf.fetchImgListEpic,
    updateReadEpic: sf.updateReadEpic,
  },
  comicbus: {
    fetchChapterEpic: comicbus.fetchChapterEpic,
    fetchImgSrcEpic: comicbus.fetchImgSrcEpic,
    fetchImgListEpic: comicbus.fetchImgListEpic,
    updateReadEpic: comicbus.updateReadEpic,
  },
};

export function getSiteReaderEpics(site: string) {
  return readerEpicsBySite[site];
}
