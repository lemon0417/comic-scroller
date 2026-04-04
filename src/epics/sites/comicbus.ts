import { of } from "rxjs";
import { ajax } from "rxjs/ajax";
import { mergeMap } from "rxjs/operators";
import { fetchMeta$ } from "@sites/comicbus/meta";
import {
  createDirectFetchImgSrcEpic,
  createFetchChapterEpic,
  createFetchImgListEpic,
  createUpdateReadEpic,
} from "./readerFlow";

const baseURL = "http://www.comicbus.com";

function fetchImgs$(chapter: string) {
  return ajax({
    url: `${baseURL}/online/${chapter}`,
    responseType: "document",
  }).pipe(
    mergeMap(function fetchImgPageHandler({ response }) {
      const doc = response as Document;
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
      let ch = /.*ch\=(.*)/.exec(chapter)![1];
      if (ch.indexOf("#") > 0) {
        ch = ch.split("#")[0];
      }
      const f = 50;
      if (ch.indexOf("-") > 0) {
        ch = ch.split("-")[0];
      }
      if (ch === "") {
        ch = "1";
      } else {
        ch = String(parseInt(ch, 10));
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
    }),
  );
}

function fetchChapterImages$(chapterID: string) {
  return fetchImgs$(chapterID).pipe(
    mergeMap(({ imgList, comicsID }) =>
      of({
        chapterID,
        seriesID: comicsID,
        comicUrl: `${baseURL}/html/${comicsID}.html`,
        imgList,
      }),
    ),
  );
}

export const fetchImgSrcEpic = createDirectFetchImgSrcEpic();

export const fetchImgListEpic = createFetchImgListEpic(fetchChapterImages$);

export const fetchChapterEpic = createFetchChapterEpic({
  site: "comicbus",
  baseURL,
  fetchChapterImages$,
  fetchMeta$,
});

export const updateReadEpic = createUpdateReadEpic("comicbus");
