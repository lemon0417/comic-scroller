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

function fetchImgs$(chapter: string) {
  devLog("dm5:fetchImgs:start", {
    chapter,
    url: `${baseURL}/${chapter}/`,
  });

  return ajax({
    url: `${baseURL}/${chapter}/`,
    responseType: "text",
  }).pipe(
    mergeMap(function fetchImgPageHandler({ response }) {
      const html =
        typeof response === "string" ? response : String(response ?? "");
      const parsedChapter = parseDm5ChapterPage(html, chapter);
      devLog("dm5:fetchImgs:parsed", {
        chapter,
        comicsID: parsedChapter.comicsID,
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
          const nextActions: ReaderDispatchAction[] = [concatImageList(imgList)];
          if (isDm5PaywalledImageList(imgList)) {
            nextActions.push(updateChapterLatestIndex(-1));
          }

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
      const { chapter: actionChapter } = action as ReaderChapterAction;

      return fetchImgs$(actionChapter).pipe(
        mergeMap(({ chapter, imgList, comicsID }) => {
          const comicUrl = `${baseURL}/${comicsID}/`;
          devLog("dm5:fetchChapter:resolvedComic", {
            actionChapter,
            chapter,
            comicsID,
            comicUrl,
            imgListLength: imgList.length,
          });

          return merge(
            of(updateComicsID(comicsID)),
            of(concatImageList(imgList)),
            of(updateRenderIndex(0, 6)),
            of(fetchImgSrc(0, 6)),
            of(startScroll()),
            from(getSeriesSnapshot(buildSeriesKey("dm5", comicsID))).pipe(
              mergeMap((series) =>
                fetchMeta$(comicUrl, {
                  includeCover: !series?.cover,
                }),
              ),
              mergeMap(({ title, cover, chapterList, chapters }) => {
                devLog("dm5:fetchChapter:metaLoaded", {
                  comicsID,
                  title: title || "",
                  cover,
                  chapterListLength: chapterList.length,
                  currentChapter: chapter,
                });
                const chapterIndex = findIndex(
                  chapterList,
                  (item) => item === chapter,
                );
                return from(
                  applyReaderSeriesState(
                    "dm5",
                    comicsID,
                    {
                      title,
                      chapters,
                      chapterList,
                      cover,
                      url: comicUrl,
                    },
                    chapter,
                  ),
                ).pipe(
                  mergeMap(({ series, subscribed, updatesCount }) => {
                    chrome.action.setBadgeText({
                      text: `${updatesCount === 0 ? "" : updatesCount}`,
                    });
                    const result$: ReaderDispatchAction[] = [
                      updateSiteInfo("dm5", baseURL),
                      updateComicsID(comicsID),
                      updateSubscribe(subscribed),
                      updateTitle(title || ""),
                      updateReadChapters(series?.read || []),
                      updateChapters(chapters),
                      updateChapterList(chapterList),
                      updateChapterNowIndex(chapterIndex),
                    ];
                    if (
                      chapterIndex > 0 &&
                      !isDm5PaywalledImageList(imgList)
                    ) {
                      result$.push(
                        fetchImgList(chapterIndex - 1),
                        updateChapterLatestIndex(chapterIndex - 1),
                      );
                    } else if (isDm5PaywalledImageList(imgList)) {
                      result$.push(updateChapterLatestIndex(-1));
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
          const { comicsID, chapterList } = state$.value.comics;
          return applyReadProgress("dm5", comicsID, chapterList[index]);
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
