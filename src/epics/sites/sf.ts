import { bindCallback, from, merge, of } from "rxjs";
import { ajax } from "rxjs/ajax";
import { filter as rxFilter, map as rxMap, mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import map from "lodash/map";
import findIndex from "lodash/findIndex";
import filter from "lodash/filter";
import reduce from "lodash/reduce";
import some from "lodash/some";
import {
  FETCH_CHAPTER,
  FETCH_IMAGE_SRC,
  FETCH_IMG_LIST,
  UPDATE_READ,
  fetchImgSrc,
  fetchImgList,
  startScroll,
} from "@domain/actions/reader";
import {
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
import { storageGet, storageSet } from "@infra/services/storage";

const baseURL = "http://comic.sfacg.com";
declare var chrome: any;

function fetchImgs$(chapter: any) {
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

function fetchScript$(scriptURL: any, chapter: any) {
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

export function fetchImgSrcEpic(action$: any, state$: { value: any }) {
  return action$.pipe(
    ofType(FETCH_IMAGE_SRC),
    mergeMap((action: { begin: number; end: number }) => {
      const { result, entity } = state$.value.comics.imageList;
      return from(result).pipe(
        rxFilter((item: any) => {
          return (
            item >= action.begin &&
            item <= action.end &&
            entity[item].loading &&
            entity[item].type !== "end"
          );
        }),
        rxMap((id: any) => {
          return loadImgSrc(entity[id].src, id);
        }),
      );
    }),
  );
}

export function fetchChapterPage$(url: string) {
  return ajax({
    url,
    responseType: "document",
  }).pipe(
    mergeMap(function fetchChapterPageHandler({ response }) {
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

export function fetchImgListEpic(action$: any, state$: { value: any }) {
  return action$.pipe(
    ofType(FETCH_IMG_LIST),
    mergeMap((action: { index: string | number }) => {
      const { chapterList } = state$.value.comics;
      const chapter = chapterList[action.index];
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
}

export function fetchChapterEpic(action$: any) {
  return action$.pipe(
    ofType(FETCH_CHAPTER),
    mergeMap((action: { chapter: any }) =>
      fetchImgs$(action.chapter).pipe(
        mergeMap(({ chapter, scriptURL, comicsID }) => {
          return merge(
            of(updateComicsID(comicsID)),
            fetchScript$(scriptURL, action.chapter).pipe(
              mergeMap(({ imgList }) => [
                concatImageList(imgList),
                updateRenderIndex(0, 6),
                fetchImgSrc(0, 6),
                startScroll(),
              ]),
            ),
            fetchChapterPage$(`${baseURL}/${comicsID}`).pipe(
              mergeMap(({ title, cover, chapterList, chapters }) => {
                const chapterIndex = findIndex(
                  chapterList,
                  (item) => item === chapter,
                );
                return bindCallback(storageGet)().pipe(
                  mergeMap((item: any) => {
                    const newItem = {
                      ...item,
                      update: filter(
                        item.update,
                        (updateItem) =>
                          updateItem.site !== "sf" ||
                          updateItem.chapterID !== chapter,
                      ),
                      history: [
                        {
                          site: "sf",
                          comicsID,
                        },
                        ...filter(
                          item.history,
                          (historyItem) =>
                            historyItem.site !== "sf" ||
                            historyItem.comicsID !== comicsID,
                        ),
                      ],
                      sf: {
                        ...item.sf,
                        [comicsID]: {
                          title,
                          chapters,
                          chapterList,
                          cover,
                          url: `${baseURL}/${comicsID}`,
                          lastRead: chapter,
                          read: [
                            ...(item.sf[comicsID]
                              ? item.sf[comicsID].read
                              : []),
                            chapter,
                          ],
                        },
                      },
                    };
                    const subscribe = some(
                      item.subscribe,
                      (citem) =>
                        citem.site === "sf" && citem.comicsID === comicsID,
                    );
                    chrome.action.setBadgeText({
                      text: `${
                        newItem.update.length === 0 ? "" : newItem.update.length
                      }`,
                    });
                    const save$ = bindCallback((items: any, cb: any) =>
                      storageSet(items, cb),
                    )(newItem);
                    return merge(
                      of(updateSubscribe(subscribe)),
                      save$.pipe(
                        mergeMap(() => {
                          chrome.action.setBadgeText({
                            text: `${
                              newItem.update.length === 0
                                ? ""
                                : newItem.update.length
                            }`,
                          });
                          const result$: any[] = [
                            updateTitle(title || ""),
                            updateReadChapters(newItem.sf[comicsID].read),
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
                            result$.push(
                              updateChapterLatestIndex(chapterIndex - 1),
                            );
                          }
                          return result$;
                        }),
                      ),
                    );
                  }),
                );
              }),
            ),
          );
        }),
      ),
    ),
  );
}

export function updateReadEpic(action$: any, state$: { value: any }) {
  return action$.pipe(
    ofType(UPDATE_READ),
    mergeMap((action: { index: number }) =>
      bindCallback(storageGet)().pipe(
        mergeMap((item: any) => {
          const { comicsID, chapterList } = state$.value.comics;
          const chapterID = chapterList[action.index];
          const newItem = {
            ...item,
            update: filter(
              item.update,
              (uitem) => uitem.site !== "sf" || uitem.chapterID !== chapterID,
            ),
            sf: {
              ...item.sf,
              [comicsID]: {
                ...item.sf[comicsID],
                lastRead: chapterID,
                read: [...item.sf[comicsID].read, chapterID],
              },
            },
          };
          return bindCallback((items: any, cb: any) => storageSet(items, cb))(
            newItem,
          ).pipe(
            mergeMap(() => {
              chrome.action.setBadgeText({
                text: `${newItem.update.length === 0 ? "" : newItem.update.length}`,
              });
              return [
                updateReadChapters(newItem.sf[comicsID].read),
                updateChapterNowIndex(action.index),
              ];
            }),
          );
        }),
      ),
    ),
  );
}
