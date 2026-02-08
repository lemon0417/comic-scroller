import * as reader from "@epics/sites/comicbus";
import * as background from "@background/sites/comicbus";
import type { SiteAdapter } from "../types";

const comicbusAdapter: SiteAdapter = {
  key: "comicbus",
  baseURL: "http://www.comicbus.com",
  fetchMeta: reader.fetchChapterPage$,
  epics: {
    fetchChapterEpic: reader.fetchChapterEpic,
    fetchImgSrcEpic: reader.fetchImgSrcEpic,
    fetchImgListEpic: reader.fetchImgListEpic,
    updateReadEpic: reader.updateReadEpic,
  },
  background: {
    fetchChapterPage$: background.fetchChapterPage$,
  },
};

export default comicbusAdapter;
