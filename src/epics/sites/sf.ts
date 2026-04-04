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
import { fetchMeta$ } from "@sites/sf/meta";
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
} from "@infra/services/library";
import type { AppEpic } from "../types";

const baseURL = "http://comic.sfacg.com";

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

function fetchImgs$(chapter: string) {
  return ajax({
    url: `${baseURL}/${chapter}`,
    responseType: "document",
  }).pipe(
    mergeMap(function fetchImgPageHandler({ response }) {
      const doc = response as Document;
      const comicsID = /\.sfacg\.com\/(.*\/)$/.exec(
        (
          doc.querySelector(
            ".AD_D2 > a:nth-child(1)",
          ) as HTMLAnchorElement | null
        )?.href || "",
      )![1];
      const scriptURL = /src=\"\/(Utility\/\d+.*\.js)\">/.exec(
        doc.head?.innerHTML || "",
      )![1];
      return of({ chapter, scriptURL, comicsID });
    }),
  );
}

function fetchScript$(scriptURL: string, chapter: string) {
  return ajax({
    url: `${baseURL}/${scriptURL}`,
    responseType: "text",
  }).pipe(
    mergeMap(function scriptURLHandler({ response }) {
      const responseText =
        typeof response === "string" ? response : String(response ?? "");
      const extractArray = (script: string, name: string) => {
        const arrayMatch = new RegExp(
          `${name}\\s*=\\s*(\\[[\\s\\S]*?\\]|new Array\\([^)]*\\))`,
        ).exec(script);
        if (!arrayMatch) return [];
        const raw = arrayMatch[1].trim();
        const normalized = raw.startsWith("new Array(")
          ? `[${raw.slice("new Array(".length, -1)}]`
          : raw;
        try {
          return JSON.parse(normalized.replace(/'/g, '"'));
        } catch {
          return [];
        }
      };

      const extractNumber = (script: string, name: string) => {
        const match = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(script);
        return match ? Number(match[1]) : 0;
      };

      const picCount = extractNumber(responseText, "picCount");
      const hosts = extractArray(responseText, "hosts");
      const picAy = extractArray(responseText, "picAy");
      // $FlowFixMe
      const imgList = Array.from(
        { length: Number(picCount) || 0 },
        (_v, k) => ({
          src: `${hosts[1] || ""}${picAy[k] || ""}`,
          chapter,
        }),
      );
      return of({ imgList });
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
        rxMap((id: number) => {
          return loadImgSrc(entity[id].src, id);
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
      const chapter = chapterList[index];
      return fetchImgs$(chapter).pipe(
        mergeMap(({ scriptURL }) => {
          return fetchScript$(scriptURL, chapter).pipe(
            mergeMap(({ imgList }) => {
              const nowImgList = state$.value.comics.imageList.result;
              if (nowImgList.length === 0) {
                return [
                  concatImageList(imgList),
                  updateRenderIndex(0, 6),
                  fetchImgSrc(0, 6),
                  startScroll(),
                ];
              }
              return [concatImageList(imgList)];
            }),
          );
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
        mergeMap(({ chapter, scriptURL, comicsID }) => {
          return merge(
            of(updateComicsID(comicsID)),
            fetchScript$(scriptURL, actionChapter).pipe(
              mergeMap(({ imgList }) => [
                concatImageList(imgList),
                updateRenderIndex(0, 6),
                fetchImgSrc(0, 6),
                startScroll(),
              ]),
            ),
            fetchMeta$(`${baseURL}/${comicsID}`).pipe(
              mergeMap(({ title, cover, chapterList, chapters }) => {
                const chapterIndex = findIndex(
                  chapterList,
                  (item) => item === chapter,
                );
                return from(
                  applyReaderSeriesState(
                    "sf",
                    comicsID,
                    {
                      title: title || "",
                      chapters,
                      chapterList,
                      cover,
                      url: `${baseURL}/${comicsID}`,
                    },
                    chapter,
                  ),
                ).pipe(
                  mergeMap(({ series, subscribed, updatesCount }) => {
                    chrome.action.setBadgeText({
                      text: `${updatesCount === 0 ? "" : updatesCount}`,
                    });
                    const result$: ReaderDispatchAction[] = [
                      updateSiteInfo("sf", baseURL),
                      updateComicsID(comicsID),
                      updateSubscribe(subscribed),
                      updateTitle(title || ""),
                      updateReadChapters(series?.read || []),
                      updateChapters(chapters),
                      updateChapterList(chapterList),
                      updateChapterNowIndex(chapterIndex),
                    ];
                    if (chapterIndex > 0) {
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
          const { comicsID, chapterList } = state$.value.comics;
          return applyReadProgress("sf", comicsID, chapterList[index]);
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
