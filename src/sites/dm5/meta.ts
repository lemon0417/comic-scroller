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
      const chapterList = map(chapterNodes, (n) => {
        const href = n.getAttribute("href") || "";
        return href ? href.replace(/\//g, "") : null;
      }).filter(Boolean);
      const chapters = reduce(
        chapterNodes,
        (acc, n) => {
          const href = n.getAttribute("href") || "";
          if (!href) return acc;
          return {
            ...acc,
            [href.replace(/\//g, "")]: {
              title: n.textContent.trim().replaceAll(/\s+/g, " "),
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
