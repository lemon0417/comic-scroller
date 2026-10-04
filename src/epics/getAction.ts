import { getSiteReaderEpics } from "@epics/sites/registry";
import { devLog } from "@utils/devLog";
import { EMPTY } from "rxjs";

const inferSite = (siteParam: string, chapterParam: string) => {
  if (siteParam) return siteParam;
  if (/^m\d+$/i.test(chapterParam)) return "dm5";
  if (/^comic-\d+\.html\?ch=/i.test(chapterParam)) return "comicbus";
  if (/^comic\/\d+\/\d+\.html$/.test(chapterParam)) return "manhuagui";
  return "";
};

const noopEpic = () => EMPTY;

const searchParams = new URLSearchParams(window.location.search);
const siteParam = searchParams.get("site") || "";
const chapterParam = searchParams.get("chapter") || "";
const _site = inferSite(siteParam, chapterParam);
const readerEpics = getSiteReaderEpics(_site);

devLog("reader:getAction", {
  siteParam,
  chapterParam,
  inferredSite: _site,
  hasReaderEpics: Boolean(readerEpics),
});

export const {
  fetchChapterEpic = noopEpic,
  fetchImgSrcEpic = noopEpic,
  fetchImgListEpic = noopEpic,
  updateReadEpic = noopEpic,
} = readerEpics || {};
