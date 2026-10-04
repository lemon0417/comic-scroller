import { type ChapterRecord, validateChapterGroups } from "@domain/library";
import { map, timeout } from "rxjs/operators";

import {
  htmlText,
  readHtmlAttribute,
  readHtmlDivContent,
  stripHtmlScripts,
} from "../html";
import { fetchText$ } from "../http";
import type { FetchMetaOptions, SiteMeta } from "../types";
import {
  BAOZIMH_READER_URL,
  BAOZIMH_REQUEST_TIMEOUT_MS,
  baozimhChapterURL,
  parseBaozimhChapterURL,
  parseBaozimhSeriesURL,
} from "./url";

export function parseBaozimhMeta(
  html: string,
  seriesID: string,
  includeCover = true,
): SiteMeta {
  if (html.length > 2 * 1024 * 1024)
    throw new Error("Baozimh metadata is too large.");
  html = stripHtmlScripts(html);
  const metadata = new Map<string, string>();
  for (const tag of Array.from(html.matchAll(/<meta\b([^>]*)>/gi))) {
    metadata.set(
      readHtmlAttribute(tag[1], "name"),
      readHtmlAttribute(tag[1], "content"),
    );
  }
  const title = metadata.get("og:novel:book_name");
  if (
    !title?.trim() ||
    parseBaozimhSeriesURL(metadata.get("og:url") || "") !== seriesID
  ) {
    throw new Error("Invalid Baozimh series metadata.");
  }
  const visible = readHtmlDivContent(html, "chapter-items");
  if (visible === undefined) throw new Error("Missing Baozimh chapter list.");
  const hidden = readHtmlDivContent(html, "chapters_other_list") || "";
  const chapters: Record<string, ChapterRecord> = {};
  const sections = new Map<string, string[]>();
  for (const anchor of Array.from(
    `${visible}${hidden}`.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi),
  )) {
    if (
      !readHtmlAttribute(anchor[1], "class")
        .split(/\s+/)
        .includes("comics-chapters__item")
    )
      continue;
    const href = new URL(
      readHtmlAttribute(anchor[1], "href"),
      BAOZIMH_READER_URL,
    ).href;
    const chapter = parseBaozimhChapterURL(href);
    if (
      chapter.seriesID !== seriesID ||
      Object.hasOwn(chapters, chapter.chapterID)
    )
      continue;
    const chapterTitle = htmlText(anchor[2]);
    if (!chapterTitle) throw new Error("Missing Baozimh chapter title.");
    chapters[chapter.chapterID] = {
      title: chapterTitle,
      href: baozimhChapterURL(chapter.chapterID),
    };
    const section = sections.get(chapter.sectionSlot) || [];
    section.push(chapter.chapterID);
    sections.set(chapter.sectionSlot, section);
  }
  const chapterGroups = Array.from(sections, ([id, list]) => ({
    id: `section:${id}`,
    chapterList: list.reverse(),
  }));
  const chapterList = chapterGroups.flatMap((group) => group.chapterList);
  if (!chapterList.length) throw new Error("Empty Baozimh chapter list.");
  const latestURL = metadata.get("og:novel:latest_chapter_url");
  if (
    latestURL &&
    !Object.hasOwn(chapters, parseBaozimhChapterURL(latestURL).chapterID)
  ) {
    throw new Error("Incomplete Baozimh chapter list.");
  }
  validateChapterGroups(chapterList, chapterGroups);
  const cover = includeCover ? new URL(metadata.get("og:image") || "") : null;
  if (
    cover &&
    (cover.origin !== "https://static-tw.baozimh.com" ||
      cover.username ||
      cover.password ||
      cover.pathname !== `/cover/${seriesID}.jpg`)
  ) {
    throw new Error("Unsupported Baozimh cover URL.");
  }
  return {
    title: title.trim(),
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
  const seriesID = parseBaozimhSeriesURL(url);
  return fetchText$(
    `${BAOZIMH_READER_URL}/comic/${seriesID}`,
    "Baozimh metadata",
    { redirect: "error" },
  ).pipe(
    timeout({ first: BAOZIMH_REQUEST_TIMEOUT_MS }),
    map((html) => parseBaozimhMeta(html, seriesID, includeCover)),
  );
}
