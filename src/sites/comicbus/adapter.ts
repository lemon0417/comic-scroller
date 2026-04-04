import * as reader from "@epics/sites/comicbus";
import { fetchMeta$ } from "./meta";
import type { SiteAdapter } from "../types";

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
