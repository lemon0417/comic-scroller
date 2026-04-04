import { fromEvent, type Observable } from "rxjs";
import { mergeMap, takeUntil, throttleTime } from "rxjs/operators";
import { ofType } from "redux-observable";
import findIndex from "lodash/findIndex";
import type { RootState } from "@domain/reducers";
import {
  START_SCROLL_EPIC,
  STOP_SCROLL_EPIC,
  fetchImgSrc,
  fetchImgList,
  updateRead,
} from "@domain/actions/reader";
import {
  updateChapterLatestIndex,
  updateRenderIndex,
} from "@domain/reducers/comics";
import {
  READER_IMAGE_GAP,
  getImageBlockHeight,
} from "@domain/utils/readerLayout";

declare var document: Document;
// function getImageIndexOnScreen(entity, begin, end) {
//   if (end <= begin) {
//     return {
//       begin: begin - 6,
//       end: begin + 6,
//     };
//   }
//   const index = Math.floor((begin + end) / 2);
//   const { bottom, top } = entity[index].node.getBoundingClientRect();
//   const { innerHeight } = window;
//   if ((top <= 0 && bottom >= 0) ||
//     (bottom >= innerHeight && top <= innerHeight) ||
//     (top > 0 && top < innerHeight && bottom > 0 && bottom < innerHeight)) {
//     return {
//       begin: index - 6,
//       end: index + 6,
//     };
//   } else if (top > innerHeight) {
//     return getImageIndexOnScreen(entity, begin, index);
//   } else if (bottom < 0) {
//     return getImageIndexOnScreen(entity, index + 1, end);
//   }
//   return { begin: -1, end: -1 };
// }

function fromScrollEvent(
  state$: { value: RootState },
  cancel$: Observable<{ type: string }>,
) {
  return fromEvent(document, "scroll").pipe(
    throttleTime(100),
    mergeMap(() => {
      const { entity, result } = state$.value.comics.imageList;
      const {
        canPreloadPreviousChapter,
        chapterList,
        chapterLatestIndex,
        chapterNowIndex,
        renderBeginIndex,
        renderEndIndex,
        innerWidth,
        innerHeight,
      } = state$.value.comics;
      let accHeight = READER_IMAGE_GAP;
      let viewIndex = 0;
      // $FlowFixMe
      const scrollTop = window.pageYOffset + 0.75 * innerHeight;
      const len = result.length;
      for (let i = 0; i < len; i += 1) {
        accHeight +=
          getImageBlockHeight(entity[result[i]], innerWidth, innerHeight) +
          2 * READER_IMAGE_GAP;
        if (accHeight > scrollTop) {
          viewIndex = i;
          break;
        }
      }
      const result$ = [];
      if ((renderBeginIndex + renderEndIndex) / 2 !== viewIndex) {
        result$.push(updateRenderIndex(viewIndex - 6, viewIndex + 6));
        result$.push(fetchImgSrc(viewIndex - 6, viewIndex + 6));
      }
      if (chapterList.length > 0) {
        const imgChapter = entity[viewIndex].chapter;
        const imgChapterIndex = findIndex(
          chapterList,
          (item) => item === imgChapter,
        );
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
      }
      return result$;
    }),
    takeUntil(cancel$),
  );
}

export default function scrollEpic(
  action$: Observable<{ type: string }>,
  state$: { value: RootState },
) {
  return action$.pipe(
    ofType(START_SCROLL_EPIC),
    mergeMap(() =>
      fromScrollEvent(state$, action$.pipe(ofType(STOP_SCROLL_EPIC))),
    ),
  );
}

// action creators live in domain/actions/reader
