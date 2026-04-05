import { fetchMeta$ } from "@sites/sf/meta";
import { of } from "rxjs";
import { ajax } from "rxjs/ajax";
import { mergeMap } from "rxjs/operators";

import {
  createDirectFetchImgSrcEpic,
  createFetchChapterEpic,
  createFetchImgListEpic,
  createUpdateReadEpic,
} from "./readerFlow";

const baseURL = "http://comic.sfacg.com";

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

function fetchChapterImages$(chapterID: string) {
  return fetchImgs$(chapterID).pipe(
    mergeMap(({ chapter, scriptURL, comicsID }) =>
      fetchScript$(scriptURL, chapter).pipe(
        mergeMap(({ imgList }) =>
          of({
            chapterID: chapter,
            seriesID: comicsID,
            comicUrl: `${baseURL}/${comicsID}`,
            imgList,
          }),
        ),
      ),
    ),
  );
}

export const fetchImgSrcEpic = createDirectFetchImgSrcEpic();

export const fetchImgListEpic = createFetchImgListEpic(fetchChapterImages$);

export const fetchChapterEpic = createFetchChapterEpic({
  site: "sf",
  baseURL,
  fetchChapterImages$,
  fetchMeta$,
});

export const updateReadEpic = createUpdateReadEpic("sf");
