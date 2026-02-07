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
import { startScroll } from "../scrollEpic";
import { storageGet, storageSet } from "@infra/services/storage";

const baseURL = "http://www.comicbus.com";
const FETCH_CHAPTER = "FETCH_CHAPTER";
const FETCH_IMAGE_SRC = "FETCH_IMAGE_SRC";
const FETCH_IMG_LIST = "FETCH_IMG_LIST";
const UPDATE_READ = "UPDATE_READ";

declare var chrome: any;

function fetchImgs$(chapter: string) {
  return ajax({
    url: `${baseURL}/online/${chapter}`,
    responseType: "document",
  }).pipe(
    mergeMap(function fetchImgPageHandler({ response }) {
      const doc = response as Document;
      /* eslint-disable */
      const scriptText =
        doc.querySelector("#Form1 > script")?.textContent || "";
      const extractVar = (name: string) => {
        const match = new RegExp(`var\\s+${name}\\s*=\\s*([^;]+);`).exec(
          scriptText,
        );
        return match ? match[1].trim() : "";
      };
      const unquote = (value: string) => value.replace(/^['"]|['"]$/g, "");
      const chs = unquote(extractVar("chs"));
      const cs = unquote(extractVar("cs"));
      const ti = unquote(extractVar("ti"));
      let ch: any = /.*ch\=(.*)/.exec(chapter)![1];
      if (ch.indexOf("#") > 0) {
        ch = ch.split("#")[0];
      }
      const f = 50;
      if (ch.indexOf("-") > 0) {
        ch = ch.split("-")[0];
      }
      if (ch === "") {
        ch = 1;
      } else {
        ch = parseInt(ch, 10);
      }
      const ss = (a: string, b: number, c: number, d?: number) => {
        const e = a.substring(b, b + c);
        return d == null ? e.replace(/[a-z]*/gi, "") : e;
      };
      const nn = (n: number) => (n < 10 ? "00" + n : n < 100 ? "0" + n : n);
      const mm = (p: number) =>
        (parseInt(String((p - 1) / 10), 10) % 10) + ((p - 1) % 10) * 3;
      let c = "";
      // $FlowFixMe
      const cc = cs.length;
      for (let j = 0; j < cc / f; j += 1) {
        // $FlowFixMe
        if (ss(cs, j * f, 4) == ch) {
          c = ss(cs, j * f, f, f);
          break;
        }
      }
      if (c == "") {
        c = ss(cs, cc - f, f);
        ch = c;
      }
      const ps = parseInt(ss(c, 7, 3), 10);
      const imgList = [];
      // $FlowFixMe
      for (let i = 0; i < ps; i += 1) {
        let c = "";
        const cc = cs.length;
        for (let j = 0; j < cc / f; j += 1) {
          // $FlowFixMe
          if (ss(cs, j * f, 4) == ch) {
            c = ss(cs, j * f, f, f);
            break;
          }
        }
        if (c == "") {
          c = ss(cs, cc - f, f);
          // $FlowFixMe
          ch = chs;
        }
        // $FlowFixMe
        const src = `http://img${ss(c, 4, 2)}.6comic.com:99/${ss(
          c,
          6,
          1,
        )}/${ti}/${ss(c, 0, 4)}/${nn(i + 1)}_${ss(c, mm(i + 1) + 10, 3, f)}.jpg`;
        imgList.push({
          chapter,
          src,
        });
      }
      // $FlowFixMe
      return of({ imgList, comicsID: ti });
      /* eslint-enable */
    }),
  );
}

export function fetchImgSrcEpic(action$: any, state$: { value: any }) {
  return action$.pipe(
    ofType(FETCH_IMAGE_SRC),
    mergeMap((action: any) => {
      const { result, entity } = state$.value.comics.imageList;
      return from(result as any[]).pipe(
        rxFilter((item: any) => {
          return (
            item >= action.begin &&
            item <= action.end &&
            entity[item].loading &&
            entity[item].type !== "end"
          );
        }),
        rxMap((id: any) => {
          return loadImgSrc(entity[id].src, id as any);
        }),
      );
    }),
  );
}

export function fetchImgSrc(begin: number, end: number) {
  return { type: FETCH_IMAGE_SRC, begin, end };
}

export function fetchChapterPage$(url: string, comicsID: string) {
  return ajax({
    url,
    responseType: "document",
  }).pipe(
    mergeMap(function fetchChapterPageHandler({ response }) {
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
      return of({ title, cover: cover, chapterList, chapters });
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
}

export function fetchImgList(index: number) {
  return { type: FETCH_IMG_LIST, index };
}

export function fetchChapterEpic(action$: any) {
  return action$.pipe(
    ofType(FETCH_CHAPTER),
    mergeMap((action: { chapter: string }) =>
      fetchImgs$(action.chapter).pipe(
        mergeMap(({ imgList, comicsID }) => {
          return merge(
            of(updateComicsID(comicsID)),
            of(concatImageList(imgList)),
            of(updateRenderIndex(0, 6)),
            of(fetchImgSrc(0, 6)),
            of(startScroll()),
            fetchChapterPage$(
              `${baseURL}/html/${comicsID}.html`,
              comicsID,
            ).pipe(
              mergeMap(({ title, cover, chapterList, chapters }) => {
                const chapterIndex = findIndex(
                  chapterList,
                  (item) => item === action.chapter,
                );
                return bindCallback(storageGet)().pipe(
                  mergeMap((item: any) => {
                    const newItem = {
                      ...item,
                      update: filter(
                        item.update,
                        (updateItem) =>
                          updateItem.site !== "comicbus" ||
                          updateItem.chapterID !== action.chapter,
                      ),
                      history: [
                        {
                          site: "comicbus",
                          comicsID,
                        },
                        ...filter(
                          item.history,
                          (historyItem) =>
                            historyItem.site !== "comicbus" ||
                            historyItem.comicsID !== comicsID,
                        ),
                      ],
                      comicbus: {
                        ...item.comicbus,
                        [comicsID]: {
                          title,
                          chapters,
                          chapterList,
                          cover,
                          url: `${baseURL}/html/${comicsID}.html`,
                          lastRead: action.chapter,
                          read: [
                            ...(item.comicbus[comicsID]
                              ? item.comicbus[comicsID].read
                              : []),
                            action.chapter,
                          ],
                        },
                      },
                    };
                    chrome.action.setBadgeText({
                      text: `${
                        newItem.update.length === 0 ? "" : newItem.update.length
                      }`,
                    });
                    const subscribe = some(
                      item.subscribe,
                      (citem) =>
                        citem.site === "comicbus" &&
                        citem.comicsID === comicsID,
                    );
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
                            updateTitle(title),
                            updateReadChapters(newItem.comicbus[comicsID].read),
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

export function fetchChapter(chapter: string) {
  return { type: FETCH_CHAPTER, chapter };
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
              (uitem) =>
                uitem.site !== "comicbus" || uitem.chapterID !== chapterID,
            ),
            comicbus: {
              ...item.comicbus,
              [comicsID]: {
                ...item.comicbus[comicsID],
                lastRead: chapterID,
                read: [...item.comicbus[comicsID].read, chapterID],
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
                updateReadChapters(newItem.comicbus[comicsID].read),
                updateChapterNowIndex(action.index),
              ];
            }),
          );
        }),
      ),
    ),
  );
}

export function updateRead(index: number) {
  return { type: UPDATE_READ, index };
}
