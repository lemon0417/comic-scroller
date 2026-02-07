import { map } from "rxjs";
import { fetchText$ } from "./utils";

const baseURL = "http://comic.sfacg.com";

export function fetchChapterPage$(url: string) {
  return fetchText$(url).pipe(
    map((html) => {
      const stripTags = (input: string) =>
        input
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();
      const titleMatch =
        /<h1>\s*<b>([^<]+)<\/b>/i.exec(html) || /<title>([^<]+)</i.exec(html);
      const title = stripTags(titleMatch ? titleMatch[1] : "");
      const coverMatch =
        /class="comic_cover"[\\s\\S]*?<img[^>]+src="([^"]+)"/i.exec(html);
      const cover = coverMatch ? coverMatch[1] : "";
      const anchorRegex =
        /<a[^>]+href="(\/HTML\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
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
      return { title, cover, chapterList, chapters, baseURL };
    }),
  );
}
