import {
  fetchImgList,
  fetchImgSrc,
  UPDATE_VISIBLE_IMAGE_RANGE,
  updateRead,
} from "@domain/actions/reader";
import type { RootState } from "@domain/reducers";
import { evictLeadingImageChapters } from "@domain/reducers/comics";
import findIndex from "lodash/findIndex";
import { ofType } from "redux-observable";
import { merge, type Observable, timer } from "rxjs";
import { map, mergeMap, share, switchMap } from "rxjs/operators";

type VisibleImageRangeAction = {
  begin: number;
  end: number;
};

export const READER_CHAPTER_EVICTION_BUFFER = 2;
export const READER_CHAPTER_STABILIZE_MS = 120;

function getFocusedImageIndex(
  begin: number,
  end: number,
  imageCount: number,
) {
  return Math.max(0, Math.min(imageCount - 1, end >= 0 ? end : begin));
}

function getImageIdAtRowIndex(result: number[], rowIndex: number) {
  if (rowIndex < 0 || rowIndex >= result.length) {
    return undefined;
  }
  return result[rowIndex];
}

function resolveChapterIndex(chapterList: string[], chapter?: string) {
  if (!chapter) {
    return -1;
  }
  return findIndex(chapterList, (item) => item === chapter);
}

function isSettledChapterAnchor(input: {
  entity: RootState["comics"]["imageList"]["entity"];
  imageID?: number;
}) {
  const imageRecord =
    typeof input.imageID === "number"
      ? input.entity[input.imageID]
      : undefined;
  if (!imageRecord) {
    return false;
  }
  return (
    imageRecord.type === "end" ||
    imageRecord.type === "paywall" ||
    imageRecord.naturalHeight > 0
  );
}

function buildVisibleRangeContext(input: {
  begin: number;
  end: number;
  comics: RootState["comics"];
}) {
  const { begin, comics, end } = input;
  const { chapterList, imageList } = comics;
  const { entity, result } = imageList;
  if (result.length === 0) {
    return null;
  }

  const focusedImageRowIndex = getFocusedImageIndex(begin, end, result.length);
  const focusedImageID = getImageIdAtRowIndex(result, focusedImageRowIndex);
  const topVisibleImageID = getImageIdAtRowIndex(result, Math.max(0, begin));
  const imgChapter =
    typeof focusedImageID === "number"
      ? entity[focusedImageID]?.chapter
      : undefined;
  const topVisibleChapter =
    typeof topVisibleImageID === "number"
      ? entity[topVisibleImageID]?.chapter
      : undefined;
  const headChapter = entity[result[0]]?.chapter;
  const imgChapterIndex = resolveChapterIndex(chapterList, imgChapter);
  const topVisibleChapterIndex = resolveChapterIndex(
    chapterList,
    topVisibleChapter,
  );
  const headChapterIndex = resolveChapterIndex(chapterList, headChapter);

  return {
    focusedImageID,
    imgChapterIndex,
    headChapterIndex,
    result,
    topVisibleChapterIndex,
    topVisibleImageID,
  };
}

export default function scrollEpic(
  action$: Observable<{ type: string }>,
  state$: { value: RootState },
) {
  let committedChapterIndex: number | null = null;
  const visibleRange$ = action$.pipe(ofType(UPDATE_VISIBLE_IMAGE_RANGE), share());

  const immediate$ = visibleRange$.pipe(
    mergeMap((action) => {
      const { begin, end } = action as VisibleImageRangeAction;
      const { comics } = state$.value;
      const context = buildVisibleRangeContext({
        begin,
        end,
        comics,
      });

      if (!context) {
        return [];
      }

      const fetchBegin = begin - 6;
      const fetchEnd = end + 6;
      const result$: Array<{ type: string }> = [
        fetchImgSrc(fetchBegin, fetchEnd),
      ];

      if (context.imgChapterIndex < 0) {
        return result$;
      }

      return result$;
    }),
  );

  const stabilized$ = visibleRange$.pipe(
    map((action) => ({
      action: action as VisibleImageRangeAction,
      readerGeneration: state$.value.comics.readerGeneration || 0,
    })),
    switchMap(({ action, readerGeneration }) =>
      timer(READER_CHAPTER_STABILIZE_MS).pipe(
        mergeMap(() => {
          const { comics } = state$.value;
          if ((comics.readerGeneration || 0) !== readerGeneration) {
            return [];
          }
          const context = buildVisibleRangeContext({
            begin: action.begin,
            end: action.end,
            comics,
          });
          if (!context) {
            return [];
          }

          if (committedChapterIndex !== comics.chapterNowIndex) {
            committedChapterIndex = comics.chapterNowIndex;
          }

          if (
            context.topVisibleChapterIndex < 0 ||
            !isSettledChapterAnchor({
              entity: comics.imageList.entity,
              imageID: context.topVisibleImageID,
            })
          ) {
            return [];
          }

          const nextActions: Array<{ type: string }> = [];
          if (context.topVisibleChapterIndex !== committedChapterIndex) {
            committedChapterIndex = context.topVisibleChapterIndex;
            nextActions.push(updateRead(context.topVisibleChapterIndex));
          }

          if (
            !comics.pendingChapterGate &&
            comics.canPreloadPreviousChapter &&
            comics.chapterLatestIndex === context.topVisibleChapterIndex &&
            comics.chapterLatestIndex > 0
          ) {
            nextActions.push(fetchImgList(comics.chapterLatestIndex - 1));
          }

          const effectiveCommittedChapterIndex =
            typeof committedChapterIndex === "number"
              ? committedChapterIndex
              : comics.chapterNowIndex;
          const maxChapterIndexToKeep =
            effectiveCommittedChapterIndex + READER_CHAPTER_EVICTION_BUFFER;
          if (context.headChapterIndex > maxChapterIndexToKeep) {
            nextActions.push(evictLeadingImageChapters(maxChapterIndexToKeep));
          }

          return nextActions;
        }),
      ),
    ),
  );

  return merge(immediate$, stabilized$);
}

// action creators live in domain/actions/reader
