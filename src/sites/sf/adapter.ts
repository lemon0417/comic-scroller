import * as reader from "@epics/sites/sf";

import type { SiteAdapter } from "../types";
import { fetchMeta$ } from "./meta";

const sfAdapter: SiteAdapter = {
  key: "sf",
  baseURL: "http://comic.sfacg.com",
  fetchMeta: fetchMeta$,
  epics: {
    fetchChapterEpic: reader.fetchChapterEpic,
    fetchImgSrcEpic: reader.fetchImgSrcEpic,
    fetchImgListEpic: reader.fetchImgListEpic,
    updateReadEpic: reader.updateReadEpic,
  },
};

export default sfAdapter;
