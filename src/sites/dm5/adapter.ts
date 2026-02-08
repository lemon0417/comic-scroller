import * as reader from "@epics/sites/dm5";
import * as background from "@background/sites/dm5";
import { fetchMeta$ } from "./meta";
import type { SiteAdapter } from "../types";

const dm5Adapter: SiteAdapter = {
  key: "dm5",
  baseURL: "https://www.dm5.com",
  fetchMeta: fetchMeta$,
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

export default dm5Adapter;
