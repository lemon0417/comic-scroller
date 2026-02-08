import { of } from "rxjs";
import { ajax } from "rxjs/ajax";
import { mergeMap } from "rxjs/operators";
import map from "lodash/map";
import reduce from "lodash/reduce";

const baseURL = "http://www.comicbus.com";

export function fetchMeta$(url: string, comicsID: string) {
  return ajax({
    url,
    responseType: "document",
  }).pipe(
    mergeMap(function fetchMetaHandler({ response }) {
      const doc = response as Document;
      const chapterNodes = doc.querySelectorAll(".ch");
      const volNodes = doc.querySelectorAll(".vol");
      const title = doc.title.split(",")[0];
      const cover = `${baseURL}/pics/0/${comicsID}.jpg`;
      const parseOnclick = (node: Element) => {
        const onclick = node.getAttribute("onclick") || "";
        const arr = /\'(.*)-(.*)\.html/.exec(onclick);
        if (!arr) return null;
        return { comic: arr[1], chapter: arr[2] };
      };
      const chapterList = [
        ...map(chapterNodes, (n) => {
          const parsed = parseOnclick(n);
          return parsed
            ? `comic-${parsed.comic}.html?ch=${parsed.chapter}`
            : null;
        })
          .filter(Boolean)
          .reverse(),
        ...map(volNodes, (n) => {
          const parsed = parseOnclick(n);
          return parsed
            ? `comic-${parsed.comic}.html?ch=${parsed.chapter}`
            : null;
        })
          .filter(Boolean)
          .reverse(),
      ];
      const chapters = {
        ...reduce(
          chapterNodes,
          (acc, n) => {
            const parsed = parseOnclick(n);
            if (!parsed) return acc;
            return {
              ...acc,
              [`comic-${parsed.comic}.html?ch=${parsed.chapter}`]: {
                title:
                  n.children.length > 0
                    ? n.children[0].textContent
                    : n.textContent,
                href: `${baseURL}/online/comic-${parsed.comic}.html?ch=${parsed.chapter}`,
              },
            };
          },
          {},
        ),
        ...reduce(
          volNodes,
          (acc, n) => {
            const parsed = parseOnclick(n);
            if (!parsed) return acc;
            return {
              ...acc,
              [`comic-${parsed.comic}.html?ch=${parsed.chapter}`]: {
                title:
                  n.children.length > 0
                    ? n.children[0].textContent
                    : n.textContent,
                href: `${baseURL}/online/comic-${parsed.comic}.html?ch=${parsed.chapter}`,
              },
            };
          },
          {},
        ),
      };
      return of({ title, cover, chapterList, chapters });
    }),
  );
}
