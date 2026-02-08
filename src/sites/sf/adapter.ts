import * as reader from "@epics/sites/sf";
import * as background from "@background/sites/sf";
import type { SiteAdapter } from "../types";

const sfAdapter: SiteAdapter = {
  key: "sf",
  baseURL: "http://comic.sfacg.com",
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

export default sfAdapter;
