import * as reader from "@epics/sites/dm5";

import type { SiteAdapter } from "../types";
import { fetchMeta$ } from "./meta";

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
};

export default dm5Adapter;
