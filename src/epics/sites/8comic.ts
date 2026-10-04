import { parseEightComicChapter } from "@sites/8comic/chapter";
import { fetchMeta$ } from "@sites/8comic/meta";
import {
  EIGHT_COMIC_BASE_URL,
  EIGHT_COMIC_READER_URL,
  EIGHT_COMIC_REQUEST_TIMEOUT_MS,
  parseEightComicChapterID,
} from "@sites/8comic/url";
import { fetchText$ } from "@sites/http";
import { defer } from "rxjs";
import { map, timeout } from "rxjs/operators";

import {
  createDirectFetchImgSrcEpic,
  createFetchChapterEpic,
  createFetchImgListEpic,
  createUpdateReadEpic,
} from "./readerFlow";

export function fetchChapterImages$(requestedID: string) {
  return defer(() => {
    const { chapterID } = parseEightComicChapterID(requestedID);
    return fetchText$(
      `${EIGHT_COMIC_READER_URL}/${chapterID}`,
      "8comic chapter",
    ).pipe(
      timeout({ first: EIGHT_COMIC_REQUEST_TIMEOUT_MS }),
      map((html) => parseEightComicChapter(html, chapterID)),
    );
  });
}

export const fetchImgSrcEpic = createDirectFetchImgSrcEpic();
export const fetchImgListEpic = createFetchImgListEpic(fetchChapterImages$);
export const fetchChapterEpic = createFetchChapterEpic({
  site: "8comic",
  baseURL: EIGHT_COMIC_BASE_URL,
  fetchChapterImages$,
  fetchMeta$,
});
export const updateReadEpic = createUpdateReadEpic("8comic");
