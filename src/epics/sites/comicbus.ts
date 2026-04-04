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
import { fetchMeta$ } from "@sites/comicbus/meta";
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

const baseURL = "http://www.comicbus.com";

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
            fetchMeta$(`${baseURL}/html/${comicsID}.html`, comicsID).pipe(
              mergeMap(({ title, cover, chapterList, chapters }) => {
                const chapterIndex = findIndex(
                  chapterList,
                  (item) => item === action.chapter,
                );
                return from(
                  applyReaderSeriesState(
                    "comicbus",
                    comicsID,
                    {
                      title,
                      chapters,
                      chapterList,
                      cover,
                      url: `${baseURL}/html/${comicsID}.html`,
                    },
                    action.chapter,
                  ),
                ).pipe(
                  mergeMap(({ series, subscribed, updatesCount }) => {
                    chrome.action.setBadgeText({
                      text: `${updatesCount === 0 ? "" : updatesCount}`,
                    });
                    const result$: any[] = [
                      updateSiteInfo("comicbus", baseURL),
                      updateComicsID(comicsID),
                      updateSubscribe(subscribed),
                      updateTitle(title),
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
      ),
    ),
  );
}

export function updateReadEpic(action$: any, state$: { value: any }) {
  return action$.pipe(
    ofType(UPDATE_READ),
    mergeMap((action: { index: number }) =>
      from(
        (() => {
          const { comicsID, chapterList } = state$.value.comics;
          return applyReadProgress("comicbus", comicsID, chapterList[action.index]);
        })(),
      ).pipe(
        mergeMap(({ series, updatesCount }) => {
          chrome.action.setBadgeText({
            text: `${updatesCount === 0 ? "" : updatesCount}`,
          });
          return [
            updateReadChapters(series?.read || []),
            updateChapterNowIndex(action.index),
          ];
        }),
      ),
    ),
  );
}
