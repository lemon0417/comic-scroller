import {
  type ChapterGroup,
  type ChapterRecord,
  validateChapterGroups,
} from "@domain/library";
import { decompressFromBase64 } from "lz-string";
import { map, timeout } from "rxjs/operators";

import { fetchText$ } from "../http";
import type { FetchMetaOptions, SiteMeta } from "../types";
import { htmlText, readHtmlAttribute } from "./html";
import {
  MANHUAGUI_BASE_URL,
  MANHUAGUI_REQUEST_TIMEOUT_MS,
  parseManhuaguiSeriesURL,
} from "./url";

function extractChapterGroups(html: string, seriesID: string) {
  const chapterGroups: ChapterGroup[] = [];
  const chapters: Record<string, ChapterRecord> = {};
  const seen = new Set<string>();
  // The site reuses chapter-list-* IDs across different categories.
  const divRegex = /<h4\b[^>]*>([\s\S]*?)<\/h4>|<div\b([^>]*)>/gi;
  let heading = "";
  let div: RegExpExecArray | null;
  while ((div = divRegex.exec(html))) {
    if (div[1] !== undefined) {
      heading = htmlText(div[1]);
      continue;
    }
    if (
      !readHtmlAttribute(div[2], "class").split(/\s+/).includes("chapter-list")
    )
      continue;
    const id = heading;
    if (!id) throw new Error("Missing Manhuagui chapter group heading.");
    const end = html.indexOf("</div>", divRegex.lastIndex);
    if (end < 0) throw new Error("Incomplete Manhuagui chapter group.");
    const body = html.slice(divRegex.lastIndex, end);
    const pages = Array.from(
      body.matchAll(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi),
    ).reverse();
    const chapterList: string[] = [];
    for (const page of pages) {
      for (const anchor of Array.from(
        page[1].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi),
      )) {
        const href = readHtmlAttribute(anchor[1], "href");
        const url = new URL(href, MANHUAGUI_BASE_URL);
        if (
          url.origin !== MANHUAGUI_BASE_URL ||
          !new RegExp(`^/comic/${seriesID}/\\d+\\.html$`).test(url.pathname)
        )
          continue;
        const chapterID = url.pathname.slice(1);
        if (seen.has(chapterID)) continue;
        seen.add(chapterID);
        chapterList.push(chapterID);
        chapters[chapterID] = {
          title:
            readHtmlAttribute(anchor[1], "title") ||
            htmlText(anchor[2].replace(/<i\b[^>]*>[\s\S]*?<\/i>/gi, "")),
          href: `${MANHUAGUI_BASE_URL}/${chapterID}`,
        };
      }
    }
    if (chapterList.length) chapterGroups.push({ id, chapterList });
    divRegex.lastIndex = end + "</div>".length;
  }
  return { chapters, chapterGroups };
}

export function parseManhuaguiMeta(
  html: string,
  seriesID: string,
  includeCover = true,
): SiteMeta {
  let parsed = extractChapterGroups(html, seriesID);
  // The site's main script replaces its audit placeholder with this chapter HTML.
  if (parsed.chapterGroups.length === 0) {
    const input = Array.from(html.matchAll(/<input\b([^>]*)>/gi)).find(
      (match) => readHtmlAttribute(match[1], "id") === "__VIEWSTATE",
    );
    if (input) {
      const decoded = decompressFromBase64(
        readHtmlAttribute(input[1], "value"),
      );
      if (!decoded)
        throw new Error("Invalid Manhuagui compressed chapter list.");
      parsed = extractChapterGroups(decoded, seriesID);
    }
  }
  const chapterList = parsed.chapterGroups.flatMap(
    (group) => group.chapterList,
  );
  validateChapterGroups(chapterList, parsed.chapterGroups);
  const titleMatch =
    /<div\b[^>]*class=["'][^"']*\bbook-title\b[^"']*["'][^>]*>\s*<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(
      html,
    );
  const title = titleMatch ? htmlText(titleMatch[1]) : "";
  if (!title) throw new Error("Manhuagui metadata did not include a title.");
  const coverMatch =
    /<div\b[^>]*class=["'][^"']*\bbook-cover\b[^"']*["'][^>]*>[\s\S]*?<img\b([^>]*)>/i.exec(
      html,
    );
  const coverSource =
    includeCover && coverMatch ? readHtmlAttribute(coverMatch[1], "src") : "";
  const coverURL = coverSource
    ? new URL(coverSource, MANHUAGUI_BASE_URL)
    : null;
  if (
    coverURL &&
    (coverURL.protocol !== "https:" ||
      !["cf.mhgui.com", "www.manhuagui.com"].includes(coverURL.hostname))
  ) {
    throw new Error("Unsupported Manhuagui cover URL.");
  }
  return { title, cover: coverURL?.href || "", chapterList, ...parsed };
}

export function fetchMeta$(
  url: string,
  { includeCover = true }: FetchMetaOptions = {},
) {
  const seriesID = parseManhuaguiSeriesURL(url);
  return fetchText$(
    `${MANHUAGUI_BASE_URL}/comic/${seriesID}/`,
    "Manhuagui metadata",
  ).pipe(
    timeout({ first: MANHUAGUI_REQUEST_TIMEOUT_MS }),
    map((html) => parseManhuaguiMeta(html, seriesID, includeCover)),
  );
}
