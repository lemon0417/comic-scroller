import { UPDATE_CHAPTER_NOW_INDEX } from "@domain/reducers/comics";
import { ofType } from "redux-observable";
import { EMPTY } from "rxjs";
import { mergeMap } from "rxjs/operators";

import type { AppEpic } from "./types";

const readerLocationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(UPDATE_CHAPTER_NOW_INDEX),
    mergeMap(() => {
      const comics = state$?.value?.comics;
      const chapter = comics?.chapterList?.[comics?.chapterNowIndex];
      const chapterTitle = comics?.currentChapterTitle || "";
      if (!chapter || !comics?.site) {
        return EMPTY;
      }
      const nextTitle = [comics?.title || "", chapterTitle].filter(Boolean).join(" ");
      if (typeof document !== "undefined" && nextTitle) {
        document.title = nextTitle;
      }
      if (typeof window !== "undefined") {
        const params = new URLSearchParams({
          site: comics.site,
          chapter,
        });
        window.history.replaceState({}, nextTitle || document.title, `?${params.toString()}`);
      }
      return EMPTY;
    }),
  );

export default readerLocationEpic;
