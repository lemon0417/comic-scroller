import { from } from "rxjs";
import { map as rxMap } from "rxjs/operators";
import type { ChapterRecord } from "@infra/services/library/schema";

const baseURL = "https://www.dm5.com";

const stripTags = (input: string) =>
  input
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const pickBlock = (source: string, marker: string) => {
  const idx = source.indexOf(marker);
  if (idx === -1) return source;
  return source.slice(idx, idx + 20000);
};

const parseFromDocument = (doc: Document) => {
  const chapterNodes = doc.querySelectorAll<HTMLAnchorElement>(
    "#chapterlistload li > a",
  );
  const title = (
    doc.querySelector(".banner_detail .info > .title")?.textContent || ""
  )
    .trim()
    .split(/\s+/)[0];
  const cover =
    (
      doc.querySelector(
        ".banner_detail .cover > img",
      ) as HTMLImageElement | null
    )?.src || "";
  const chapterList = Array.from(chapterNodes)
    .map((n) => {
      const href = n.getAttribute("href") || "";
      return href ? href.replace(/\//g, "") : null;
    })
    .filter(Boolean) as string[];
  const chapters = Array.from(chapterNodes).reduce<Record<string, ChapterRecord>>(
    (acc, n) => {
      const href = n.getAttribute("href") || "";
      if (!href) return acc;
      acc[href.replace(/\//g, "")] = {
        title: n.textContent?.trim().replaceAll(/\s+/g, " ") || "",
        href: n.href,
      };
      return acc;
    },
    {},
  );
  return { title, cover, chapterList, chapters };
};

const parseFromHtml = (html: string) => {
  const block = pickBlock(html, "chapterlistload");
  const anchorRegex = /<a[^>]+href="\/(m\d+\/?)"[^>]*>([\s\S]*?)<\/a>/gi;
  const titleMatch =
    /banner_detail[\s\S]*?class="title"[^>]*>([^<]+)/i.exec(html) ||
    /<title>([^<]+)</i.exec(html);
  const title =
    stripTags(titleMatch ? titleMatch[1] : "").split(/\s+/)[0] || "";
  const coverMatch =
    /banner_detail[\s\S]*?class="cover"[\s\S]*?<img[^>]+src="([^"]+)"/i.exec(
      html,
    );
  const cover = coverMatch ? coverMatch[1] : "";

  const chapterList: string[] = [];
  const chapters: Record<string, ChapterRecord> = {};
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(block))) {
    const href = match[1].replace(/\//g, "");
    const chapterTitle = stripTags(match[2]);
    if (!href) continue;
    chapterList.push(href);
    chapters[href] = {
      title: chapterTitle,
      href: `${baseURL}/${href}/`,
    };
  }
  return { title, cover, chapterList, chapters };
};

export function fetchMeta$(url: string) {
  return from(fetch(url).then((response) => response.text())).pipe(
    rxMap((html) => {
      const Parser = globalThis.DOMParser;
      if (Parser) {
        const doc = new Parser().parseFromString(html, "text/html");
        return parseFromDocument(doc);
      }
      return parseFromHtml(html);
    }),
  );
}
