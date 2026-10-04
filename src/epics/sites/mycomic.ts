import { fetchText$ } from "@sites/http";
import { parseMyComicChapterPage } from "@sites/mycomic/chapter";
import { fetchMeta$ } from "@sites/mycomic/meta";
import {
  MYCOMIC_BASE_URL,
  MYCOMIC_REQUEST_OPTIONS,
  MYCOMIC_REQUEST_TIMEOUT_MS,
  myComicChapterURL,
} from "@sites/mycomic/url";
import { defer } from "rxjs";
import { map, timeout } from "rxjs/operators";

import {
  createDirectFetchImgSrcEpic,
  createFetchChapterEpic,
  createFetchImgListEpic,
  createUpdateReadEpic,
} from "./readerFlow";

export function fetchChapterImages$(chapterID: string) {
  return defer(() =>
    fetchText$(
      myComicChapterURL(chapterID),
      "MyComic chapter",
      MYCOMIC_REQUEST_OPTIONS,
    ),
  ).pipe(
    timeout({ first: MYCOMIC_REQUEST_TIMEOUT_MS }),
    map((html) => parseMyComicChapterPage(html, chapterID)),
  );
}

export const fetchImgSrcEpic = createDirectFetchImgSrcEpic();
export const fetchImgListEpic = createFetchImgListEpic(fetchChapterImages$);
export const fetchChapterEpic = createFetchChapterEpic({
  site: "mycomic",
  baseURL: MYCOMIC_BASE_URL,
  fetchChapterImages$,
  fetchMeta$,
});
export const updateReadEpic = createUpdateReadEpic("mycomic");
