import { of } from "rxjs";
import { ajax } from "rxjs/ajax";
import { mergeMap } from "rxjs/operators";
import map from "lodash/map";
import reduce from "lodash/reduce";

export function fetchMeta$(url: string) {
  return ajax({
    url,
    responseType: "document",
  }).pipe(
    mergeMap(function fetchMetaHandler({ response }) {
      const doc = response as Document;
      const chapterNode = doc.querySelectorAll<HTMLAnchorElement>(
        ".serialise_list.Blue_link2 > li > a",
      );
      const title = doc.querySelector(
        "body > table > tbody > tr > td:nth-child(1) > table:nth-child(2) > tbody > tr > td > h1 > b",
      )?.textContent;
      const cover =
        (doc.querySelector(".comic_cover > img") as HTMLImageElement | null)
          ?.src || "";
      const chapterList = map(chapterNode, (n) => {
        const href = n.getAttribute("href") || "";
        return href ? href.replace(/^(\/)/g, "") : null;
      }).filter(Boolean);
      const chapters = reduce(
        chapterNode,
        (acc, n) => {
          const href = n.getAttribute("href") || "";
          if (!href) return acc;
          return {
            ...acc,
            [href.replace(/^(\/)/g, "")]: {
              title: n.textContent,
              href: n.href,
            },
          };
        },
        {},
      );
      return of({ title, cover, chapterList, chapters });
    }),
  );
}
