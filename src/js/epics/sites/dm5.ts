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
const PACKER_REGEX = /eval\(function\(p,a,c,k,e,(?:r|d)\)\{[\s\S]+?\}\(([\s\S]+)\)\)/;

const splitArgs = (raw: string) => {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let escape = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escape = true;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1);
    }
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
};

const unquote = (value: string) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const inner = trimmed.slice(1, -1);
    return inner
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
  }
  return trimmed;
};

const encodeBase = (num: number, base: number) => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (num === 0) return '0';
  let n = num;
  let out = '';
  while (n > 0) {
    out = chars[n % base] + out;
    n = Math.floor(n / base);
  }
  return out;
};

const extractDictSource = (arg: string) => {
  const match = /(['"])([\s\S]*?)\1\s*\.split\(/.exec(arg);
  return match ? match[2] : null;
};

export const unpackPacker = (source: string) => {
  const match = PACKER_REGEX.exec(source);
  if (!match) return source;
  const args = splitArgs(match[1]);
  if (args.length < 4) return source;
  const payload = unquote(args[0]);
  const base = parseInt(args[1], 10);
  const count = parseInt(args[2], 10);
  const dictSource = extractDictSource(args[3]);
  if (!payload || Number.isNaN(base) || Number.isNaN(count) || !dictSource) {
    return source;
  }
  const dict = dictSource.split('|');
  let unpacked = payload;
  for (let i = count - 1; i >= 0; i -= 1) {
    if (dict[i]) {
      const key = encodeBase(i, base);
      const re = new RegExp(`\\b${key}\\b`, 'g');
      unpacked = unpacked.replace(re, dict[i]);
    }
  }
  return unpacked;
};

export function resolveDm5ImageUrl(
  responseText: string,
  entityItem?: { cid?: string; key?: string },
) {
  const unpacked = unpackPacker(responseText);
  const scriptText = unpacked || responseText;
  const parseArrayLiteral = (raw: string) => {
    try {
      return JSON.parse(raw.replace(/'/g, '"'));
    } catch {
      return null;
    }
  };

  const extractArrayVar = (script: string, name: string) => {
    const match = new RegExp(`${name}\\s*=\\s*(\\[[\\s\\S]*?\\])`).exec(script);
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

  const hd = extractArrayVar(scriptText, 'hd_c');
  const dArr = extractArrayVar(scriptText, 'd');
  const pvalue = extractArrayVar(scriptText, 'pvalue');
  const arr = extractAnyArray(scriptText);
  const candidate =
    (hd && hd[0]) ||
    (dArr && dArr[0]) ||
    (pvalue && pvalue[0]) ||
    (arr && arr[0]) ||
    extractFirstUrl(scriptText) ||
    '';
  const baseUrl = extractFirstUrl(scriptText);
  const queryMatch = /\\?cid=\\d+&key=[0-9a-z]+/i.exec(scriptText);
  const cidMatch = /cid\\s*=\\s*(\\d+)/.exec(scriptText);
  const keyMatch = /key\\s*=\\s*['"]?([^'"]+)['"]?/i.exec(scriptText);
  const cidFromQuery = /cid=(\\d+)/i.exec(scriptText);
  const keyFromQuery = /key=([0-9a-zA-Z]+)/i.exec(scriptText);
  const keyFromHex = /[0-9a-f]{32}/i.exec(scriptText);
  const derivedQuery =
    (cidMatch && keyMatch && keyMatch[1])
      ? `cid=${cidMatch[1]}&key=${keyMatch[1]}`
      : (cidFromQuery && keyFromQuery
          ? `cid=${cidFromQuery[1]}&key=${keyFromQuery[1]}`
          : '');
  const entityKey = entityItem && (entityItem.key || (keyFromHex && keyFromHex[0]));
  const entityFallback =
    !derivedQuery && entityItem && entityItem.cid && entityKey
      ? `cid=${entityItem.cid}&key=${entityKey}`
      : '';
  let resolved = String(candidate || '');
  if (resolved && !resolved.startsWith('http') && baseUrl) {
    resolved = resolved.startsWith('/')
      ? `${baseUrl}${resolved}`
      : `${baseUrl}/${resolved}`;
  }
  if (resolved && !resolved.includes('?') && (queryMatch || derivedQuery || entityFallback)) {
    const rawQuery = queryMatch ? queryMatch[0] : derivedQuery || entityFallback;
    const query = rawQuery.startsWith('?') ? rawQuery : `?${rawQuery}`;
    resolved += query;
  }
  return resolved;
}
const FETCH_CHAPTER = 'FETCH_CHAPTER';
const FETCH_IMAGE_SRC = 'FETCH_IMAGE_SRC';
const FETCH_IMG_LIST = 'FETCH_IMG_LIST';
const UPDATE_READ = 'UPDATE_READ';

function fetchImgs$(chapter: any) {
  return ajax({
    url: `${baseURL}/${chapter}/`,
    responseType: 'text',
  }).pipe(mergeMap(function fetchImgPageHandler({ response }) {
    const html = typeof response === 'string' ? response : String(response ?? '');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const node = doc.querySelector('div.title > span:nth-child(2) > a') as
      | HTMLAnchorElement
      | null;
    const script = doc.documentElement?.textContent || html;
    const extractVar = (name: string) => {
      const match = new RegExp(
        `${name}\\s*=\\s*(?:\\"([^\\"]*)\\"|'([^']*)'|([^;\\n]*))`,
      ).exec(script);
      const value = match ? (match[1] ?? match[2] ?? match[3]) : '';
      return (value || '').trim();
    };
    const DM5_IMAGE_COUNT = parseInt(extractVar('DM5_IMAGE_COUNT'), 10) || 0;
    const DM5_CID = extractVar('DM5_CID');
    const DM5_CURL_RAW = extractVar('DM5_CURL');
    const DM5_CURL = `${DM5_CURL_RAW.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
    const DM5_MID = extractVar('DM5_MID');
    const DM5_VIEWSIGN_DT = extractVar('DM5_VIEWSIGN_DT');
    const DM5_VIEWSIGN = extractVar('DM5_VIEWSIGN');
    const DM5_KEY =
      extractVar('DM5_KEY') ||
      (doc.querySelector('#dm5_key') as HTMLInputElement | null)?.value ||
      '';
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
        `&_dt=${encodeURIComponent(DM5_VIEWSIGN_DT).replace(/%20/g, '+')}` +
        `&_sign=${DM5_VIEWSIGN}`,
      chapter: `m${DM5_CID}`,
      cid: DM5_CID,
      key: DM5_KEY,
    }));
    return of({
      chapter,
      imgList,
      comicsID:
        node?.getAttribute('href')?.replace(/\//g, '') ||
        DM5_CURL_RAW.replace(/\//g, ''),
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
            const resolved = resolveDm5ImageUrl(responseText, entity[id]);
            return loadImgSrc(resolved, id);
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
    const chapterList = map(chapterNodes, n => {
      const href = n.getAttribute('href') || '';
      return href ? href.replace(/\//g, '') : null;
    }).filter(Boolean);
    const chapters = reduce(
      chapterNodes,
      (acc, n) => {
        const href = n.getAttribute('href') || '';
        if (!href) return acc;
        return {
          ...acc,
          [href.replace(/\//g, '')]: {
            title: n.textContent.trim().replaceAll(/\s+/g, ' '),
            href: n.href,
          },
        };
      },
      {},
    );
    return of({ title, cover, chapterList, chapters });
  }));
}

export function fetchImgListEpic(action$: any, state$: { value: any }) {
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
