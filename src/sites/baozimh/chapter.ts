import { htmlText, readHtmlAttribute, stripHtmlScripts } from "../html";
import {
  baozimhChapterURL,
  parseBaozimhChapterID,
  parseBaozimhChapterURL,
  parseBaozimhSeriesURL,
} from "./url";

export function parseBaozimhChapterPage(html: string, pageID: string) {
  const requested = parseBaozimhChapterID(pageID);
  if (html.length > 2 * 1024 * 1024)
    throw new Error("Baozimh chapter is too large.");
  html = stripHtmlScripts(html);
  const anchors = Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi));
  const directory = anchors.find((anchor) =>
    readHtmlAttribute(anchor[1], "class").split(/\s+/).includes("goto"),
  );
  if (
    !directory ||
    parseBaozimhSeriesURL(readHtmlAttribute(directory[1], "href")) !==
      requested.seriesID
  ) {
    throw new Error("Baozimh chapter identity mismatch.");
  }
  const title = htmlText(
    /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "",
  );
  const pagination = /\((\d+)\/(\d+)\)/.exec(title);
  const totalPages = Number(pagination?.[2] || 1);
  if (
    !title ||
    Number(pagination?.[1] || 1) !== requested.page ||
    !Number.isSafeInteger(totalPages) ||
    totalPages < requested.page ||
    totalPages > 100
  ) {
    throw new Error("Invalid Baozimh chapter pagination.");
  }
  const imgList = Array.from(html.matchAll(/<amp-img\b([^>]*)>/gi))
    .filter((tag) =>
      /^chapter-img-\d+-\d+$/.test(readHtmlAttribute(tag[1], "id")),
    )
    .map((tag) => {
      const src = new URL(
        readHtmlAttribute(tag[1], "data-src") ||
          readHtmlAttribute(tag[1], "src"),
      );
      if (
        src.protocol !== "https:" ||
        src.port ||
        src.username ||
        src.password ||
        !/^s[1-9]\d*\.bzcdn\.net$/.test(src.hostname) ||
        !src.pathname.startsWith(`/scomic/${requested.seriesID}/`)
      ) {
        throw new Error("Unsupported Baozimh image URL.");
      }
      return { chapter: requested.chapterID, src: src.href };
    });
  if (!imgList.length) throw new Error("Missing Baozimh chapter images.");
  let nextPageID: string | undefined;
  for (const anchor of anchors) {
    if (!/下一[頁页]/.test(htmlText(anchor[2]))) continue;
    const href = new URL(
      readHtmlAttribute(anchor[1], "href"),
      baozimhChapterURL(requested.chapterID, requested.page),
    );
    const next = parseBaozimhChapterURL(href.href);
    if (
      next.chapterID !== requested.chapterID ||
      next.page !== requested.page + 1 ||
      next.page > totalPages
    ) {
      throw new Error("Invalid Baozimh next page.");
    }
    nextPageID = new URL(
      baozimhChapterURL(next.chapterID, next.page),
    ).pathname.slice(1);
  }
  const hasNextPage = requested.page < totalPages;
  if (hasNextPage !== Boolean(nextPageID)) {
    throw new Error("Missing Baozimh next page.");
  }
  return { imgList, nextPageID, totalPages };
}
