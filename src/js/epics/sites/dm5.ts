import { from, merge, of } from 'rxjs';
import { ajax } from 'rxjs/ajax';
import { filter as rxFilter, map as rxMap, mergeMap } from 'rxjs/operators';
import { ofType } from 'redux-observable';
import map from 'lodash/map';
import findIndex from 'lodash/findIndex';
import filter from 'lodash/filter';
import reduce from 'lodash/reduce';
import some from 'lodash/some';
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
} from '../../reducers/comics';
import { startScroll } from '../scrollEpic';
import { storageGetAll, storageSet } from '../../services/storage';

const baseURL = 'https://www.dm5.com';
const FETCH_CHAPTER = 'FETCH_CHAPTER';
const FETCH_IMAGE_SRC = 'FETCH_IMAGE_SRC';
const FETCH_IMG_LIST = 'FETCH_IMG_LIST';
const UPDATE_READ = 'UPDATE_READ';

function fetchImgs$(chapter: any) {
  return ajax({
    url: `${baseURL}/${chapter}/`,
    responseType: 'document',
  }).pipe(mergeMap(function fetchImgPageHandler({ response }) {
    const doc = response as Document;
    const node = doc.querySelector('div.title > span:nth-child(2) > a') as
      | HTMLAnchorElement
      | null;
    const script = doc.querySelector('head')?.textContent || '';
    const DM5_IMAGE_COUNT = parseInt(/DM5_IMAGE_COUNT=(\d+);/.exec(script)![1], 10);
    const DM5_CID = /DM5_CID=(\d+);/.exec(script)![1];
    const DM5_CURL = /DM5_CURL\s*=\s*\"\/(m\d+\/)\"/.exec(script)![1];
    const DM5_MID = /DM5_MID\s*=\s*(\d+);/.exec(script)![1];
    const DM5_VIEWSIGN_DT = /DM5_VIEWSIGN_DT\s*=\s*"(.*)";/.exec(script)![1];
    const DM5_VIEWSIGN = /DM5_VIEWSIGN="([^"]*)";/.exec(script)![1];
    const imgList = Array.from({ length: DM5_IMAGE_COUNT }, (_v, k) => ({
      src:
        `${baseURL}/${DM5_CURL}chapterfun.ashx?` +
        `cid=${DM5_CID}` +
        `&page=${k + 1}` +
        `&key=` +
        `&language=1` +
        `&gtk=6` +
        `&_cid=${DM5_CID}` +
        `&_mid=${DM5_MID}` +
        `&_dt=${encodeURIComponent(DM5_VIEWSIGN_DT).replace('%20', '+')}` +
        `&_sign=${DM5_VIEWSIGN}`,
      chapter: `m${DM5_CID}`,
    }));
    return of({
      chapter,
      imgList,
      comicsID: node?.getAttribute('href')?.replace(/\//g, '') || '',
    });
  }));
}

export function fetchImgSrcEpic(action$: any, state$: { value: any }) {
  return action$.pipe(
    ofType(FETCH_IMAGE_SRC),
    mergeMap((action: { begin: number; end: number; }) => {
      const { result, entity } = state$.value.comics.imageList;
      return from(result).pipe(
        rxFilter((item: any) => {
          return (
            item >= action.begin &&
            item <= action.end &&
            entity[item].loading &&
            entity[item].type !== 'end'
          );
        }),
        mergeMap((id: any) => {
          return ajax({
            url: entity[id].src,
            responseType: 'text',
            headers: {
              'Content-Type': 'text/html; charset=utf-8'
            },
          }).pipe(rxMap(function fetchImgSrcHandler({ response }) {
            const responseText =
              typeof response === 'string' ? response : String(response ?? '');
            const parseArrayLiteral = (raw: string) => {
              try {
                return JSON.parse(raw.replace(/'/g, '"'));
              } catch {
                return null;
              }
            };

            const extractArrayVar = (script: string, name: string) => {
              const match = new RegExp(
                `${name}\\s*=\\s*(\\[[\\s\\S]*?\\])`,
              ).exec(script);
              return match ? parseArrayLiteral(match[1]) : null;
            };

            const extractAnyArray = (script: string) => {
              const match = /(\[[\s\S]*?\])/.exec(script);
              return match ? parseArrayLiteral(match[1]) : null;
            };

            const extractFirstUrl = (script: string) => {
              const match =
                /https?:\\\/\\\/[^"'\\s]+/.exec(script) ||
                /https?:\/\/[^"'\s]+/.exec(script);
              return match ? match[0].replace(/\\\//g, '/') : null;
            };

            const hd = extractArrayVar(responseText, 'hd_c');
            const dArr = extractArrayVar(responseText, 'd');
            const arr = extractAnyArray(responseText);
            const candidate =
              (hd && hd[0]) ||
              (dArr && dArr[0]) ||
              (arr && arr[0]) ||
              extractFirstUrl(responseText) ||
              '';
            return loadImgSrc(String(candidate), id);
          }));
        }),
      );
    }),
  );
}

export function fetchImgSrc(begin: any, end: any) {
  return { type: FETCH_IMAGE_SRC, begin, end };
}

export function fetchChapterPage$(url: string) {
  return ajax({
    url,
    responseType: 'document',
  }).pipe(mergeMap(function fetchChapterPageHandler({ response }) {
    const doc = response as Document;
    const chapterNodes = doc.querySelectorAll<HTMLAnchorElement>(
      '#chapterlistload li > a',
    );
    const title = (doc
      .querySelector('.banner_detail .info > .title')
      ?.textContent || '')
      .trim()
      .split(/\s+/)[0];
    const cover =
      (doc.querySelector('.banner_detail .cover > img') as HTMLImageElement | null)
        ?.src || '';
    const chapterList = map(chapterNodes, n =>
      n.getAttribute('href').replace(/\//g, ''),
    );
    const chapters = reduce(
      chapterNodes,
      (acc, n) => ({
        ...acc,
        [n.getAttribute('href').replace(/\//g, '')]: {
          title: n.textContent.trim().replaceAll(/\s+/g, ' '),
          href: n.href,
        },
      }),
      {},
    );
    return of({ title, cover, chapterList, chapters });
  }));
}

export function fetchImgListEpic(action$: any, state$: { value: any }) {
  console.log('fetchImgs$')
  return action$.pipe(
    ofType(FETCH_IMG_LIST),
    mergeMap((action: { index: string | number; }) => {
      const { chapterList } = state$.value.comics;
      return fetchImgs$(chapterList[action.index]).pipe(mergeMap(({ imgList }) => {
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
      }));
    }),
  );
}

export function fetchImgList(index: any) {
  return { type: FETCH_IMG_LIST, index };
}

export function fetchChapterEpic(
  action$: any,
  _state$: { value: any },
  { store }: { store: any },
) {
  return action$.pipe(
    ofType(FETCH_CHAPTER),
    mergeMap((action: { chapter: any; }) =>
      fetchImgs$(action.chapter).pipe(mergeMap(({ chapter, imgList, comicsID }) => {
        const comicUrl = `${baseURL}/${comicsID}/`;

        return merge(
          of(updateComicsID(comicsID)),
          of(concatImageList(imgList)),
          of(updateRenderIndex(0, 6)),
          of(fetchImgSrc(0, 6)),
          of(startScroll()),
          fetchChapterPage$(comicUrl).pipe(mergeMap(
            ({ title, cover, chapterList, chapters }) => {
              const chapterIndex = findIndex(
                chapterList,
                item => item === chapter,
              );
              console.log(chapterIndex)
              storageGetAll((item: any) => {
                const newItem = {
                  ...item,
                  update: filter(
                    item.update,
                    updateItem =>
                      updateItem.site !== 'dm5' ||
                      updateItem.chapterID !== chapter,
                  ),
                  history: [
                    {
                      site: 'dm5',
                      comicsID,
                    },
                    ...filter(
                      item.history.slice(0, 50),
                      historyItem =>
                        historyItem.site !== 'dm5' ||
                        historyItem.comicsID !== comicsID,
                    ),
                  ],
                  dm5: {
                    ...item.dm5,
                    [comicsID]: {
                      title,
                      chapters,
                      chapterList,
                      cover,
                      url: comicUrl,
                      lastRead: chapter,
                      read: [
                        ...(item.dm5[comicsID]
                          ? item.dm5[comicsID].read
                          : []),
                        chapter,
                      ],
                    },
                  },
                };
                const subscribe = some(
                  item.subscribe,
                  citem => citem.site === 'dm5' && citem.comicsID === comicsID,
                );
                store.dispatch(updateSubscribe(subscribe));
                storageSet(newItem, () => {
                chrome.action.setBadgeText({
                    text: `${
                      newItem.update.length === 0 ? '' : newItem.update.length
                      }`,
                  });
                  store.dispatch(updateTitle(title));
                  store.dispatch(updateReadChapters(
                    newItem.dm5[comicsID].read,
                  ));
                  store.dispatch(updateChapters(chapters));
                  store.dispatch(updateChapterList(chapterList));
                  store.dispatch(updateChapterNowIndex(chapterIndex));
                  if (chapterIndex > 0) {
                    store.dispatch(fetchImgList(chapterIndex - 1));
                    store.dispatch(updateChapterLatestIndex(chapterIndex - 1));
                  } else {
                    store.dispatch(updateChapterLatestIndex(chapterIndex - 1));
                  }
                })
              })
              return []
            },
          )),
        );
      })),
    ),
  );
}

export function fetchChapter(chapter: any) {
  return { type: FETCH_CHAPTER, chapter };
}

export function updateReadEpic(
  action$: any,
  state$: { value: any },
  { store }: { store: any },
) {
  return action$.pipe(
    ofType(UPDATE_READ),
    mergeMap((action: { index: number; }) => {
      storageGetAll(item => {
        const { comicsID, chapterList } = state$.value.comics;
        const chapterID = chapterList[action.index];
        const newItem = {
          ...item,
          update: filter(
            item.update,
            uitem => uitem.site !== 'dm5' || uitem.chapterID !== chapterID,
          ),
          dm5: {
            ...item.dm5,
            [comicsID]: {
              ...item.dm5[comicsID],
              lastRead: chapterID,
              read: [
                ...item.dm5[comicsID].read,
                chapterID,
              ],
            },
          },
        };
        storageSet(newItem, () => {
        chrome.action.setBadgeText({
            text: `${newItem.update.length === 0 ? '' : newItem.update.length}`,
          });
          store.dispatch(updateReadChapters(newItem.dm5[comicsID].read))
          store.dispatch(updateChapterNowIndex(action.index))
        });
      })
      return []
    }),
  );
}

export function updateRead(index: any) {
  return { type: UPDATE_READ, index };
}
