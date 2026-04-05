import * as reader from "@epics/sites/comicbus";

import type { SiteAdapter } from "../types";
import { fetchMeta$ } from "./meta";

const comicbusAdapter: SiteAdapter = {
  key: "comicbus",
  baseURL: "http://www.comicbus.com",
  fetchMeta: fetchMeta$,
  epics: {
    fetchChapterEpic: reader.fetchChapterEpic,
    fetchImgSrcEpic: reader.fetchImgSrcEpic,
    fetchImgListEpic: reader.fetchImgListEpic,
    updateReadEpic: reader.updateReadEpic,
  },
};

export default comicbusAdapter;
