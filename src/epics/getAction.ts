import { EMPTY } from "rxjs";
import { dm5, sf, comicbus } from "./sites";

type SiteAdapter = {
  key: string;
  baseURL: string;
  actions: {
    fetchChapter: Function;
    fetchImgSrc: Function;
    fetchImgList: Function;
    updateRead: Function;
  };
  epics: {
    fetchChapterEpic: Function;
    fetchImgSrcEpic: Function;
    fetchImgListEpic: Function;
    updateReadEpic: Function;
  };
};

const siteAdapters: Record<string, SiteAdapter> = {
  dm5: {
    key: "dm5",
    baseURL: "https://www.dm5.com",
    actions: {
      fetchChapter: dm5.fetchChapter,
      fetchImgSrc: dm5.fetchImgSrc,
      fetchImgList: dm5.fetchImgList,
      updateRead: dm5.updateRead,
    },
    epics: {
      fetchChapterEpic: dm5.fetchChapterEpic,
      fetchImgSrcEpic: dm5.fetchImgSrcEpic,
      fetchImgListEpic: dm5.fetchImgListEpic,
      updateReadEpic: dm5.updateReadEpic,
    },
  },
  sf: {
    key: "sf",
    baseURL: "http://comic.sfacg.com",
    actions: {
      fetchChapter: sf.fetchChapter,
      fetchImgSrc: sf.fetchImgSrc,
      fetchImgList: sf.fetchImgList,
      updateRead: sf.updateRead,
    },
    epics: {
      fetchChapterEpic: sf.fetchChapterEpic,
      fetchImgSrcEpic: sf.fetchImgSrcEpic,
      fetchImgListEpic: sf.fetchImgListEpic,
      updateReadEpic: sf.updateReadEpic,
    },
  },
  comicbus: {
    key: "comicbus",
    baseURL: "http://www.comicbus.com",
    actions: {
      fetchChapter: comicbus.fetchChapter,
      fetchImgSrc: comicbus.fetchImgSrc,
      fetchImgList: comicbus.fetchImgList,
      updateRead: comicbus.updateRead,
    },
    epics: {
      fetchChapterEpic: comicbus.fetchChapterEpic,
      fetchImgSrcEpic: comicbus.fetchImgSrcEpic,
      fetchImgListEpic: comicbus.fetchImgListEpic,
      updateReadEpic: comicbus.updateReadEpic,
    },
  },
};

const inferSite = (siteParam: string, chapterParam: string) => {
  if (siteParam) return siteParam;
  if (/^m\d+$/i.test(chapterParam)) return "dm5";
  if (/^comic-\d+\.html\?ch=/i.test(chapterParam)) return "comicbus";
  if (chapterParam.startsWith("HTML/")) return "sf";
  return "";
};

const noopEpic = () => EMPTY;

const searchParams = new URLSearchParams(window.location.search);
const siteParam = searchParams.get("site") || "";
const chapterParam = searchParams.get("chapter") || "";
const _site = inferSite(siteParam, chapterParam);
const adapter = siteAdapters[_site];

export const site = adapter?.key || "";
export const baseURL = adapter?.baseURL || "";

export const { fetchChapter, fetchImgSrc, fetchImgList, updateRead } =
  adapter?.actions || {};

export const {
  fetchChapterEpic = noopEpic,
  fetchImgSrcEpic = noopEpic,
  fetchImgListEpic = noopEpic,
  updateReadEpic = noopEpic,
} = adapter?.epics || {};
