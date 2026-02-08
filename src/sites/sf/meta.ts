import { from } from "rxjs";
import { map as rxMap } from "rxjs/operators";

const baseURL = "http://comic.sfacg.com";

const stripTags = (input: string) =>
  input
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const parseFromDocument = (doc: Document) => {
  const chapterNode = doc.querySelectorAll<HTMLAnchorElement>(
    ".serialise_list.Blue_link2 > li > a",
  );
  const title = doc.querySelector(
    "body > table > tbody > tr > td:nth-child(1) > table:nth-child(2) > tbody > tr > td > h1 > b",
  )?.textContent;
  const cover =
    (doc.querySelector(".comic_cover > img") as HTMLImageElement | null)?.src ||
    "";
  const chapterList = Array.from(chapterNode)
    .map((n) => {
      const href = n.getAttribute("href") || "";
      return href ? href.replace(/^(\/)/g, "") : null;
    })
    .filter(Boolean) as string[];
  const chapters = Array.from(chapterNode).reduce<Record<string, any>>(
    (acc, n) => {
      const href = n.getAttribute("href") || "";
      if (!href) return acc;
      acc[href.replace(/^(\/)/g, "")] = {
        title: n.textContent || "",
        href: n.href,
      };
      return acc;
    },
    {},
  );
  return { title, cover, chapterList, chapters };
};

const parseFromHtml = (html: string) => {
  const titleMatch =
    /<h1>\s*<b>([^<]+)<\/b>/i.exec(html) || /<title>([^<]+)</i.exec(html);
  const title = stripTags(titleMatch ? titleMatch[1] : "");
  const coverMatch = /class="comic_cover"[\s\S]*?<img[^>]+src="([^"]+)"/i.exec(
    html,
  );
  const cover = coverMatch ? coverMatch[1] : "";
  const anchorRegex = /<a[^>]+href="(\/HTML\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const chapterList: string[] = [];
  const chapters: Record<string, any> = {};
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html))) {
    const href = match[1].replace(/^(\/)/g, "");
    const chapterTitle = stripTags(match[2]);
    if (!href) continue;
    chapterList.push(href);
    chapters[href] = {
      title: chapterTitle,
      href: `${baseURL}/${href}`,
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
