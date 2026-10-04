import { parseBaozimhChapterPage } from "@sites/baozimh/chapter";
import { fetchMeta$ } from "@sites/baozimh/meta";
import {
  BAOZIMH_BASE_URL,
  BAOZIMH_REQUEST_TIMEOUT_MS,
  baozimhChapterURL,
  baozimhSeriesURL,
  parseBaozimhChapterID,
} from "@sites/baozimh/url";
import { fetchText$ } from "@sites/http";
import { defer, EMPTY } from "rxjs";
import { expand, map, reduce, timeout } from "rxjs/operators";

import {
  createDirectFetchImgSrcEpic,
  createFetchChapterEpic,
  createFetchImgListEpic,
  createUpdateReadEpic,
} from "./readerFlow";

export function fetchChapterImages$(requestedID: string) {
  return defer(() => {
    const { chapterID, seriesID } = parseBaozimhChapterID(requestedID);
    const fetchPage$ = (pageID: string) => {
      const page = parseBaozimhChapterID(pageID).page;
      return fetchText$(baozimhChapterURL(chapterID, page), "Baozimh chapter", {
        redirect: "error",
      }).pipe(map((html) => parseBaozimhChapterPage(html, pageID)));
    };
    return fetchPage$(chapterID).pipe(
      expand(
        (page) =>
          page.nextPageID
            ? fetchPage$(page.nextPageID).pipe(
                map((next) => {
                  if (next.totalPages !== page.totalPages)
                    throw new Error("Inconsistent Baozimh chapter pagination.");
                  return next;
                }),
              )
            : EMPTY,
        1,
      ),
      reduce((images, page) => {
        for (const image of page.imgList)
          if (!images.has(image.src)) images.set(image.src, image);
        return images;
      }, new Map<string, { chapter: string; src: string }>()),
      timeout({ first: BAOZIMH_REQUEST_TIMEOUT_MS }),
      map((images) => ({
        chapterID,
        seriesID,
        comicUrl: baozimhSeriesURL(seriesID),
        imgList: Array.from(images.values()),
      })),
    );
  });
}

export const fetchImgSrcEpic = createDirectFetchImgSrcEpic();
export const fetchImgListEpic = createFetchImgListEpic(fetchChapterImages$);
export const fetchChapterEpic = createFetchChapterEpic({
  site: "baozimh",
  baseURL: BAOZIMH_BASE_URL,
  fetchChapterImages$,
  fetchMeta$,
});
export const updateReadEpic = createUpdateReadEpic("baozimh");
