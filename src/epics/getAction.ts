import { getSiteAdapter } from "@sites/registry";
import { devLog } from "@utils/devLog";
import { EMPTY } from "rxjs";

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
const adapter = getSiteAdapter(_site);

devLog("reader:getAction", {
  siteParam,
  chapterParam,
  inferredSite: _site,
  hasAdapter: Boolean(adapter),
  adapterKey: adapter?.key || "",
});

export const site = adapter?.key || "";
export const baseURL = adapter?.baseURL || "";

export const {
  fetchChapterEpic = noopEpic,
  fetchImgSrcEpic = noopEpic,
  fetchImgListEpic = noopEpic,
  updateReadEpic = noopEpic,
} = adapter?.epics || {};
