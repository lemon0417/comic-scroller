import { map } from "rxjs";
import { fetchText$ } from "./utils";

const baseURL = "https://www.dm5.com";

export function fetchChapterPage$(url: string) {
  return fetchText$(url).pipe(
    map((html) => {
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
      const block = pickBlock(html, "chapterlistload");
      const anchorRegex = /<a[^>]+href="\/(m\d+\/?)"[^>]*>([\s\S]*?)<\/a>/gi;
      const titleMatch =
        /banner_detail[\\s\\S]*?class="title"[^>]*>([^<]+)/i.exec(html) ||
        /<title>([^<]+)</i.exec(html);
      const title =
        stripTags(titleMatch ? titleMatch[1] : "").split(/\s+/)[0] || "";
      const coverMatch =
        /banner_detail[\\s\\S]*?class="cover"[\\s\\S]*?<img[^>]+src="([^"]+)"/i.exec(
          html,
        );
      const cover = coverMatch ? coverMatch[1] : "";

      const chapterList: string[] = [];
      const chapters: Record<string, any> = {};
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
      return { title, cover, chapterList, chapters, baseURL };
    }),
  );
}
