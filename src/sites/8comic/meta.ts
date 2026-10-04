import {
  type ChapterGroup,
  type ChapterRecord,
  validateChapterGroups,
} from "@domain/library";
import { map, timeout } from "rxjs/operators";

import { fetchText$ } from "../http";
import type { FetchMetaOptions, SiteMeta } from "../types";
import { htmlText, readHtmlAttribute } from "./html";
import {
  EIGHT_COMIC_BASE_URL,
  EIGHT_COMIC_READER_URL,
  EIGHT_COMIC_REQUEST_TIMEOUT_MS,
  eightComicSeriesURL,
  parseEightComicSeriesURL,
} from "./url";

export function parseEightComicMeta(
  html: string,
  seriesID: string,
  includeCover = true,
): SiteMeta {
  html = html.replace(
    /<!--[^]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );
  const metadata = new Map<string, string>();
  for (const tag of Array.from(html.matchAll(/<meta\b([^>]*)>/gi))) {
    metadata.set(
      readHtmlAttribute(tag[1], "name"),
      readHtmlAttribute(tag[1], "content"),
    );
  }
  if (metadata.get("id") !== seriesID || !metadata.get("name")) {
    throw new Error("Invalid 8comic series metadata.");
  }
  // Only the manga chapter container is eligible; anime and recommendations reuse cview.
  const container = Array.from(html.matchAll(/<div\b([^>]*)>/gi)).find(
    (tag) => readHtmlAttribute(tag[1], "id") === "chapters",
  );
  if (!container) throw new Error("Missing 8comic chapter list.");
  const start = container.index! + container[0].length;
  const end = html.indexOf("</div>", start);
  if (end < 0) throw new Error("Incomplete 8comic chapter list.");
  const groups: Record<string, string[]> = { single: [], volume: [] };
  const chapters: Record<string, ChapterRecord> = {};
  for (const anchor of Array.from(
    html.slice(start, end).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi),
  )) {
    const classes = readHtmlAttribute(anchor[1], "class")
      .toLowerCase()
      .split(/\s+/);
    const group = classes.includes("ch")
      ? "single"
      : classes.includes("vol")
        ? "volume"
        : "";
    const view =
      /^\s*cview\(\s*(['"])([1-9]\d*)-([1-9]\d*[a-z]?)\.html\1\s*,\s*\d+\s*,\s*\d+\s*\)\s*;\s*return false;?\s*$/.exec(
        readHtmlAttribute(anchor[1], "onclick"),
      );
    if (!group || !view || view[2] !== seriesID) continue;
    const chapterID = `online/new-${seriesID}.html?ch=${view[3]}`;
    if (Object.hasOwn(chapters, chapterID)) continue;
    const title = htmlText(anchor[2]);
    if (!title) throw new Error("Missing 8comic chapter title.");
    chapters[chapterID] = {
      title,
      href: `${EIGHT_COMIC_READER_URL}/${chapterID}`,
    };
    groups[group].push(chapterID);
  }
  const chapterGroups: ChapterGroup[] = Object.entries(groups)
    .filter(([, chapterList]) => chapterList.length)
    .map(([id, chapterList]) => ({ id, chapterList: chapterList.reverse() }));
  const chapterList = chapterGroups.flatMap((group) => group.chapterList);
  validateChapterGroups(chapterList, chapterGroups);
  const cover =
    includeCover && metadata.get("pic")
      ? new URL(metadata.get("pic")!, EIGHT_COMIC_BASE_URL)
      : null;
  if (
    cover &&
    (cover.origin !== EIGHT_COMIC_BASE_URL ||
      !/^\/pics\/\d+\/\d+m?\.jpg$/.test(cover.pathname))
  ) {
    throw new Error("Unsupported 8comic cover URL.");
  }
  return {
    title: metadata.get("name"),
    cover: cover?.href || "",
    chapterList,
    chapters,
    chapterGroups,
  };
}

export function fetchMeta$(
  url: string,
  { includeCover = true }: FetchMetaOptions = {},
) {
  const seriesID = parseEightComicSeriesURL(url);
  return fetchText$(eightComicSeriesURL(seriesID), "8comic metadata").pipe(
    timeout({ first: EIGHT_COMIC_REQUEST_TIMEOUT_MS }),
    map((html) => parseEightComicMeta(html, seriesID, includeCover)),
  );
}
