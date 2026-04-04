import { from, merge, of } from "rxjs";
import { ajax } from "rxjs/ajax";
import { filter as rxFilter, map as rxMap, mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import findIndex from "lodash/findIndex";
import {
  FETCH_CHAPTER,
  FETCH_IMAGE_SRC,
  FETCH_IMG_LIST,
  UPDATE_READ,
  fetchImgSrc,
  fetchImgList,
  startScroll,
} from "@domain/actions/reader";
import { fetchMeta$ } from "@sites/dm5/meta";
import {
  updateSiteInfo,
  updateTitle,
  updateComicsID,
  updateChapters,
  updateCanPreloadPreviousChapter,
  updateChapterList,
  concatImageList,
  loadImgSrc,
  updateChapterLatestIndex,
  updateChapterNowIndex,
  updateRenderIndex,
  updateReadChapters,
  updateSubscribe,
} from "@domain/reducers/comics";
import {
  applyReadProgress,
  applyReaderSeriesState,
  getSeriesSnapshot,
} from "@infra/services/library";
import {
  parseDm5ChapterPage,
  resolveDm5ImageUrl,
} from "@sites/dm5/chapter";
import { buildSeriesKey } from "@infra/services/library/schema";
import { devLog } from "@utils/devLog";
import type { AppEpic } from "../types";

type ReaderChapterAction = {
  chapter: string;
};

type ReaderIndexAction = {
  index: number;
};

type ReaderRangeAction = {
  begin: number;
  end: number;
};

type ReaderDispatchAction = {
  type: string;
  [key: string]: unknown;
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

export const fetchImgListEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FETCH_IMG_LIST),
    mergeMap((action) => {
      const { index } = action as ReaderIndexAction;
      const { chapterList } = state$.value.comics;
      return fetchImgs$(chapterList[index]).pipe(
        mergeMap(({ imgList }) => {
          const nowImgList = state$.value.comics.imageList.result;
          const canPreloadPreviousChapter = !isDm5PaywalledImageList(imgList);
          const nextActions: ReaderDispatchAction[] = [
            concatImageList(imgList),
            updateCanPreloadPreviousChapter(canPreloadPreviousChapter),
          ];

          if (nowImgList.length === 0) {
            return [
              ...nextActions,
              updateRenderIndex(0, 6),
              fetchImgSrc(0, 6),
              startScroll(),
            ];
          }
          return nextActions;
        }),
      );
    }),
  );

export const fetchChapterEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FETCH_CHAPTER),
    mergeMap((action) => {
      const { chapter: actionChapterID } = action as ReaderChapterAction;

      return fetchImgs$(actionChapterID).pipe(
        mergeMap(({ chapterID, imgList, seriesSlug }) => {
          const comicUrl = `${baseURL}/${seriesSlug}/`;
          devLog("dm5:fetchChapter:resolvedComic", {
            actionChapterID,
            chapterID,
            seriesSlug,
            comicUrl,
            imgListLength: imgList.length,
          });

          return merge(
            of(updateComicsID(seriesSlug)),
            of(concatImageList(imgList)),
            of(updateRenderIndex(0, 6)),
            of(fetchImgSrc(0, 6)),
            of(startScroll()),
            from(getSeriesSnapshot(buildSeriesKey("dm5", seriesSlug))).pipe(
              mergeMap((series) =>
                fetchMeta$(comicUrl, {
                  includeCover: !series?.cover,
                }),
              ),
              mergeMap(({ title, cover, chapterList, chapters }) => {
                devLog("dm5:fetchChapter:metaLoaded", {
                  seriesSlug,
                  title: title || "",
                  cover,
                  chapterListLength: chapterList.length,
                  currentChapterID: chapterID,
                });
                const chapterIndex = findIndex(
                  chapterList,
                  (item) => item === chapterID,
                );
                return from(
                  applyReaderSeriesState(
                    "dm5",
                    seriesSlug,
                    {
                      title,
                      chapters,
                      chapterList,
                      cover,
                      url: comicUrl,
                    },
                    chapterID,
                  ),
                ).pipe(
                  mergeMap(({ series, subscribed, updatesCount }) => {
                    chrome.action.setBadgeText({
                      text: `${updatesCount === 0 ? "" : updatesCount}`,
                    });
                    const result$: ReaderDispatchAction[] = [
                      updateSiteInfo("dm5", baseURL),
                      updateComicsID(seriesSlug),
                      updateSubscribe(subscribed),
                      updateTitle(title || ""),
                      updateReadChapters(series?.read || []),
                      updateChapters(chapters),
                      updateChapterList(chapterList),
                      updateChapterNowIndex(chapterIndex),
                      updateCanPreloadPreviousChapter(
                        !isDm5PaywalledImageList(imgList),
                      ),
                    ];
                    if (
                      chapterIndex > 0 &&
                      !isDm5PaywalledImageList(imgList)
                    ) {
                      result$.push(
                        fetchImgList(chapterIndex - 1),
                        updateChapterLatestIndex(chapterIndex - 1),
                      );
                    } else {
                      result$.push(updateChapterLatestIndex(chapterIndex - 1));
                    }
                    return result$;
                  }),
                );
              }),
            ),
          );
        }),
      );
    }),
  );

export const updateReadEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(UPDATE_READ),
    mergeMap((action) => {
      const { index } = action as ReaderIndexAction;

      return from(
        (() => {
          const { comicsID: seriesSlug, chapterList } = state$.value.comics;
          return applyReadProgress("dm5", seriesSlug, chapterList[index]);
        })(),
      ).pipe(
        mergeMap(({ series, updatesCount }) => {
          chrome.action.setBadgeText({
            text: `${updatesCount === 0 ? "" : updatesCount}`,
          });
          return [
            updateReadChapters(series?.read || []),
            updateChapterNowIndex(index),
          ];
        }),
      );
    }),
  );
