import { fetchText$ } from "@sites/http";
import { parseManhuaguiChapter } from "@sites/manhuagui/chapter";
import { fetchMeta$ } from "@sites/manhuagui/meta";
import {
  MANHUAGUI_BASE_URL,
  MANHUAGUI_REQUEST_TIMEOUT_MS,
  parseManhuaguiChapterID,
} from "@sites/manhuagui/url";
import { defer } from "rxjs";
import { map, timeout } from "rxjs/operators";

import {
  createDirectFetchImgSrcEpic,
  createFetchChapterEpic,
  createFetchImgListEpic,
  createUpdateReadEpic,
} from "./readerFlow";

export function fetchChapterImages$(chapterID: string) {
  return defer(() => {
    parseManhuaguiChapterID(chapterID);
    return fetchText$(
      `${MANHUAGUI_BASE_URL}/${chapterID}`,
      "Manhuagui chapter",
    ).pipe(
      timeout({ first: MANHUAGUI_REQUEST_TIMEOUT_MS }),
      map((html) => parseManhuaguiChapter(html, chapterID)),
    );
  });
}

export const fetchImgSrcEpic = createDirectFetchImgSrcEpic();
export const fetchImgListEpic = createFetchImgListEpic(fetchChapterImages$);
export const fetchChapterEpic = createFetchChapterEpic({
  site: "manhuagui",
  baseURL: MANHUAGUI_BASE_URL,
  fetchChapterImages$,
  fetchMeta$,
});
export const updateReadEpic = createUpdateReadEpic("manhuagui");
