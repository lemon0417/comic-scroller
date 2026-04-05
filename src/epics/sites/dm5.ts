import { from, of } from "rxjs";
import { ajax } from "rxjs/ajax";
import { filter as rxFilter, map as rxMap, mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import { FETCH_IMAGE_SRC } from "@domain/actions/reader";
import { fetchMeta$ } from "@sites/dm5/meta";
import { loadImgSrc } from "@domain/reducers/comics";
import { getSeriesSnapshot } from "@infra/services/library/reader";
import {
  parseDm5ChapterPage,
  resolveDm5ImageUrl,
} from "@sites/dm5/chapter";
import { buildSeriesKey } from "@infra/services/library/schema";
import { devLog } from "@utils/devLog";
import type { AppEpic } from "../types";
import {
  createFetchChapterEpic,
  createFetchImgListEpic,
  createUpdateReadEpic,
} from "./readerFlow";

type ReaderRangeAction = {
  begin: number;
  end: number;
};

const baseURL = "https://www.dm5.com";
const isDm5PaywalledImageList = (imgList: Array<{ type?: string }>) =>
  imgList[0]?.type === "paywall";

function fetchImgs$(chapterID: string) {
  devLog("dm5:fetchImgs:start", {
    chapterID,
    url: `${baseURL}/${chapterID}/`,
  });

  return ajax({
    url: `${baseURL}/${chapterID}/`,
    responseType: "text",
  }).pipe(
    mergeMap(function fetchImgPageHandler({ response }) {
      const html =
        typeof response === "string" ? response : String(response ?? "");
      const parsedChapter = parseDm5ChapterPage(html, chapterID);
      devLog("dm5:fetchImgs:parsed", {
        chapterID: parsedChapter.chapterID,
        seriesSlug: parsedChapter.seriesSlug,
        imgListLength: parsedChapter.imgList.length,
        firstSrc: parsedChapter.imgList[0]?.src || "",
        firstCID: parsedChapter.imgList[0]?.cid || "",
        hasFirstKey: Boolean(parsedChapter.imgList[0]?.key),
      });
      return of(parsedChapter);
    }),
  );
}

function fetchChapterImages$(chapterID: string) {
  return fetchImgs$(chapterID).pipe(
    mergeMap((payload) => {
      const canPreloadPreviousChapter = !isDm5PaywalledImageList(payload.imgList);
      const comicUrl = `${baseURL}/${payload.seriesSlug}/`;
      devLog("dm5:fetchChapter:resolvedComic", {
        actionChapterID: chapterID,
        chapterID: payload.chapterID,
        seriesSlug: payload.seriesSlug,
        comicUrl,
        imgListLength: payload.imgList.length,
      });
      return of({
        chapterID: payload.chapterID,
        seriesID: payload.seriesSlug,
        comicUrl,
        imgList: payload.imgList,
        canPreloadPreviousChapter,
      });
    }),
  );
}

export const fetchImgSrcEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FETCH_IMAGE_SRC),
    mergeMap((action) => {
      const { begin, end } = action as ReaderRangeAction;
      const { result, entity } = state$.value.comics.imageList;
      return from(result).pipe(
        rxFilter((item: number) => {
          return (
            item >= begin &&
            item <= end &&
            entity[item].loading &&
            entity[item].type !== "end"
          );
        }),
        mergeMap((id: number) => {
          return ajax({
            url: entity[id].src,
            responseType: "text",
            headers: {
              "Content-Type": "text/html; charset=utf-8",
            },
          }).pipe(
            rxMap(function fetchImgSrcHandler({ response }) {
              const responseText =
                typeof response === "string"
                  ? response
                  : String(response ?? "");
              const resolved = resolveDm5ImageUrl(responseText, entity[id]);
              return loadImgSrc(resolved, id);
            }),
          );
        }),
      );
    }),
  );

export const fetchImgListEpic = createFetchImgListEpic(fetchChapterImages$);

export const fetchChapterEpic = createFetchChapterEpic({
  site: "dm5",
  baseURL,
  fetchChapterImages$,
  fetchMeta$,
  onMetaLoaded: (payload, meta) => {
    devLog("dm5:fetchChapter:metaLoaded", {
      seriesSlug: payload.seriesID,
      title: meta.title || "",
      cover: meta.cover,
      chapterListLength: meta.chapterList.length,
      currentChapterID: payload.chapterID,
    });
  },
  resolveFetchMetaOptions$: (payload) =>
    from(getSeriesSnapshot(buildSeriesKey("dm5", payload.seriesID))).pipe(
      rxMap((series) => ({
        includeCover: !series?.cover,
      })),
    ),
});

export const updateReadEpic = createUpdateReadEpic("dm5");
