import {
  type ChapterGroup,
  type ChapterRecord,
  validateChapterGroups,
} from "@domain/library";
import { map, timeout } from "rxjs/operators";

import {
  htmlText,
  readHtmlAttribute,
  readHtmlDivContentAt,
  stripHtmlScripts,
} from "../html";
import { fetchText$ } from "../http";
import type { FetchMetaOptions, SiteMeta } from "../types";
import {
  isMyComicObject,
  readMyComicChapterArray,
  readMyComicStructuredData,
} from "./html";
import {
  MYCOMIC_REQUEST_OPTIONS,
  MYCOMIC_REQUEST_TIMEOUT_MS,
  myComicChapterURL,
  myComicSeriesURL,
  parseMyComicImageURL,
  parseMyComicSeriesURL,
} from "./url";

const GROUP_IDS = new Map([
  ["單話", "single"],
  ["单话", "single"],
  ["單行本", "volume"],
  ["单行本", "volume"],
  ["番外篇", "extra"],
]);

export function parseMyComicMeta(
  html: string,
  seriesID: string,
  includeCover = true,
): SiteMeta {
  const data = readMyComicStructuredData(html, "ComicSeries");
  if (
    typeof data.name !== "string" ||
    !data.name.trim() ||
    typeof data.url !== "string" ||
    parseMyComicSeriesURL(data.url) !== seriesID
  ) {
    throw new Error("Invalid MyComic series metadata.");
  }
  html = stripHtmlScripts(html);
  const chapters: Record<string, ChapterRecord> = {};
  const chapterGroups: ChapterGroup[] = [];
  for (const tag of Array.from(
    html.matchAll(/<div\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi),
  )) {
    const state = readHtmlAttribute(tag[1], "x-data");
    if (!/^\s*\{\s*chapters:/.test(state)) continue;
    const content = readHtmlDivContentAt(html, tag.index!);
    const header =
      /<div\b[^>]*\sdata-flux-subheading(?:\s*=|\s|>)[^>]*>\s*<div\b[^>]*>([\s\S]*?)<\/div>/i.exec(
        content,
      );
    const groupID = GROUP_IDS.get(htmlText(header?.[1] || ""));
    if (!groupID) throw new Error("Unknown MyComic chapter group.");
    const chapterList = readMyComicChapterArray(state).map((chapter) => {
      if (
        !isMyComicObject(chapter) ||
        typeof chapter.id !== "number" ||
        !Number.isSafeInteger(chapter.id) ||
        chapter.id < 1 ||
        typeof chapter.title !== "string" ||
        !chapter.title.trim()
      ) {
        throw new Error("Invalid MyComic chapter record.");
      }
      const chapterID = `chapters/${chapter.id}`;
      if (Object.hasOwn(chapters, chapterID))
        throw new Error("Duplicate MyComic chapter.");
      chapters[chapterID] = {
        title: chapter.title.trim(),
        href: myComicChapterURL(chapterID),
      };
      return chapterID;
    });
    if (chapterList.length) chapterGroups.push({ id: groupID, chapterList });
  }
  const chapterList = chapterGroups.flatMap((group) => group.chapterList);
  validateChapterGroups(chapterList, chapterGroups);
  let cover = "";
  if (includeCover) {
    if (typeof data.image !== "string")
      throw new Error("Missing MyComic cover.");
    cover = parseMyComicImageURL(data.image, `/comics/${seriesID}-`);
  }
  return {
    title: data.name.trim(),
    cover,
    chapterList,
    chapters,
    chapterGroups,
  };
}

export function fetchMeta$(
  url: string,
  { includeCover = true }: FetchMetaOptions = {},
) {
  const seriesID = parseMyComicSeriesURL(url);
  return fetchText$(
    myComicSeriesURL(seriesID),
    "MyComic metadata",
    MYCOMIC_REQUEST_OPTIONS,
  ).pipe(
    timeout({ first: MYCOMIC_REQUEST_TIMEOUT_MS }),
    map((html) => parseMyComicMeta(html, seriesID, includeCover)),
  );
}
