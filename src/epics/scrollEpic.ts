import {
  fetchImgList,
  fetchImgSrc,
  UPDATE_VISIBLE_IMAGE_RANGE,
  updateRead,
} from "@domain/actions/reader";
import type { RootState } from "@domain/reducers";
import {
  updateChapterLatestIndex,
} from "@domain/reducers/comics";
import findIndex from "lodash/findIndex";
import { ofType } from "redux-observable";
import { type Observable } from "rxjs";
import { mergeMap } from "rxjs/operators";

type VisibleImageRangeAction = {
  begin: number;
  end: number;
};

function getFocusedImageIndex(
  begin: number,
  end: number,
  imageCount: number,
) {
  return Math.max(0, Math.min(imageCount - 1, end >= 0 ? end : begin));
}

export default function scrollEpic(
  action$: Observable<{ type: string }>,
  state$: { value: RootState },
) {
  return action$.pipe(
    ofType(UPDATE_VISIBLE_IMAGE_RANGE),
    mergeMap((action) => {
      const { begin, end } = action as VisibleImageRangeAction;
      const { entity, result } = state$.value.comics.imageList;
      const {
        canPreloadPreviousChapter,
        chapterList,
        chapterLatestIndex,
        chapterNowIndex,
      } = state$.value.comics;

      if (result.length === 0) {
        return [];
      }

      const fetchBegin = begin - 6;
      const fetchEnd = end + 6;
      const focusedImageIndex = getFocusedImageIndex(begin, end, result.length);
      const imgChapter = entity[focusedImageIndex]?.chapter;
      const result$: Array<{ type: string }> = [
        fetchImgSrc(fetchBegin, fetchEnd),
      ];

      if (!imgChapter || chapterList.length === 0) {
        return result$;
      }

      const imgChapterIndex = findIndex(
        chapterList,
        (item) => item === imgChapter,
      );
      if (imgChapterIndex < 0) {
        return result$;
      }

      if (
        canPreloadPreviousChapter &&
        chapterLatestIndex === imgChapterIndex &&
        chapterLatestIndex > 0
      ) {
        result$.push(fetchImgList(chapterLatestIndex - 1));
        result$.push(updateChapterLatestIndex(chapterLatestIndex - 1));
      }

      if (chapterNowIndex !== imgChapterIndex) {
        result$.push(updateRead(imgChapterIndex));
      }

      return result$;
    }),
  );
}

// action creators live in domain/actions/reader
