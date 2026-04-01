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
} from "@infra/services/library";

const baseURL = "https://www.dm5.com";
const PACKER_REGEX =
  /eval\(function\(p,a,c,k,e,(?:r|d)\)\{[\s\S]+?\}\(([\s\S]+)\)\)/;

const splitArgs = (raw: string) => {
  const args: string[] = [];
  let current = "";
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
    if (ch === "\\") {
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
    if (ch === "(" || ch === "[" || ch === "{") {
      depth += 1;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth = Math.max(0, depth - 1);
    }
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
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
      .replace(/\\\\/g, "\\")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t");
  }
  return trimmed;
};

const encodeBase = (num: number, base: number) => {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (num === 0) return "0";
  let n = num;
  let out = "";
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
  const dict = dictSource.split("|");
  let unpacked = payload;
  for (let i = count - 1; i >= 0; i -= 1) {
    if (dict[i]) {
      const key = encodeBase(i, base);
      const re = new RegExp(`\\b${key}\\b`, "g");
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
    return match ? match[0].replace(/\\\//g, "/") : null;
  };

  const hd = extractArrayVar(scriptText, "hd_c");
  const dArr = extractArrayVar(scriptText, "d");
  const pvalue = extractArrayVar(scriptText, "pvalue");
  const arr = extractAnyArray(scriptText);
  const candidate =
    (hd && hd[0]) ||
    (dArr && dArr[0]) ||
    (pvalue && pvalue[0]) ||
    (arr && arr[0]) ||
    extractFirstUrl(scriptText) ||
    "";
  const baseUrl = extractFirstUrl(scriptText);
  const queryMatch = /\\?cid=\\d+&key=[0-9a-z]+/i.exec(scriptText);
  const cidMatch = /cid\\s*=\\s*(\\d+)/.exec(scriptText);
  const keyMatch = /key\\s*=\\s*['"]?([^'"]+)['"]?/i.exec(scriptText);
  const cidFromQuery = /cid=(\\d+)/i.exec(scriptText);
  const keyFromQuery = /key=([0-9a-zA-Z]+)/i.exec(scriptText);
  const keyFromHex = /[0-9a-f]{32}/i.exec(scriptText);
  const derivedQuery =
    cidMatch && keyMatch && keyMatch[1]
      ? `cid=${cidMatch[1]}&key=${keyMatch[1]}`
      : cidFromQuery && keyFromQuery
        ? `cid=${cidFromQuery[1]}&key=${keyFromQuery[1]}`
        : "";
  const entityKey =
    entityItem && (entityItem.key || (keyFromHex && keyFromHex[0]));
  const entityFallback =
    !derivedQuery && entityItem && entityItem.cid && entityKey
      ? `cid=${entityItem.cid}&key=${entityKey}`
      : "";
  let resolved = String(candidate || "");
  if (resolved && !resolved.startsWith("http") && baseUrl) {
    resolved = resolved.startsWith("/")
      ? `${baseUrl}${resolved}`
      : `${baseUrl}/${resolved}`;
  }
  if (
    resolved &&
    !resolved.includes("?") &&
    (queryMatch || derivedQuery || entityFallback)
  ) {
    const rawQuery = queryMatch
      ? queryMatch[0]
      : derivedQuery || entityFallback;
    const query = rawQuery.startsWith("?") ? rawQuery : `?${rawQuery}`;
    resolved += query;
  }
  return resolved;
}
function fetchImgs$(chapter: any) {
  return ajax({
    url: `${baseURL}/${chapter}/`,
    responseType: "text",
  }).pipe(
    mergeMap(function fetchImgPageHandler({ response }) {
      const html =
        typeof response === "string" ? response : String(response ?? "");
      const doc = new DOMParser().parseFromString(html, "text/html");
      const node = doc.querySelector(
        "div.title > span:nth-child(2) > a",
      ) as HTMLAnchorElement | null;
      const script = doc.documentElement?.textContent || html;
      const extractVar = (name: string) => {
        const match = new RegExp(
          `${name}\\s*=\\s*(?:\\"([^\\"]*)\\"|'([^']*)'|([^;\\n]*))`,
        ).exec(script);
        const value = match ? (match[1] ?? match[2] ?? match[3]) : "";
        return (value || "").trim();
      };
      const DM5_IMAGE_COUNT = parseInt(extractVar("DM5_IMAGE_COUNT"), 10) || 0;
      const DM5_CID = extractVar("DM5_CID");
      const DM5_CURL_RAW = extractVar("DM5_CURL");
      const DM5_CURL = `${DM5_CURL_RAW.replace(/^\/+/, "").replace(/\/+$/, "")}/`;
      const DM5_MID = extractVar("DM5_MID");
      const DM5_VIEWSIGN_DT = extractVar("DM5_VIEWSIGN_DT");
      const DM5_VIEWSIGN = extractVar("DM5_VIEWSIGN");
      const DM5_KEY =
        extractVar("DM5_KEY") ||
        (doc.querySelector("#dm5_key") as HTMLInputElement | null)?.value ||
        "";
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
          `&_dt=${encodeURIComponent(DM5_VIEWSIGN_DT).replace(/%20/g, "+")}` +
          `&_sign=${DM5_VIEWSIGN}`,
        chapter: `m${DM5_CID}`,
        cid: DM5_CID,
        key: DM5_KEY,
      }));
      return of({
        chapter,
        imgList,
        comicsID:
          node?.getAttribute("href")?.replace(/\//g, "") ||
          DM5_CURL_RAW.replace(/\//g, ""),
      });
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
        mergeMap((id: any) => {
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
}

export function fetchImgListEpic(action$: any, state$: { value: any }) {
  return action$.pipe(
    ofType(FETCH_IMG_LIST),
    mergeMap((action: { index: string | number }) => {
      const { chapterList } = state$.value.comics;
      return fetchImgs$(chapterList[action.index]).pipe(
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
    mergeMap((action: { chapter: any }) =>
      fetchImgs$(action.chapter).pipe(
        mergeMap(({ chapter, imgList, comicsID }) => {
          const comicUrl = `${baseURL}/${comicsID}/`;

          return merge(
            of(updateComicsID(comicsID)),
            of(concatImageList(imgList)),
            of(updateRenderIndex(0, 6)),
            of(fetchImgSrc(0, 6)),
            of(startScroll()),
            fetchMeta$(comicUrl).pipe(
              mergeMap(({ title, cover, chapterList, chapters }) => {
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
                    const result$: any[] = [
                      updateSiteInfo("dm5", baseURL),
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
          return applyReadProgress("dm5", comicsID, chapterList[action.index]);
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
