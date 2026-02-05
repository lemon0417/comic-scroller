import { fromEvent } from 'rxjs';
import { mergeMap, takeUntil, throttleTime } from 'rxjs/operators';
import { ofType } from 'redux-observable';
import findIndex from 'lodash/findIndex';
import { fetchImgSrc, fetchImgList, updateRead } from './getAction';
import { updateChapterLatestIndex, updateRenderIndex } from '../reducers/comics';

const START_SCROLL_EPIC = 'START_SCROLL_EPIC';
const STOP_SCROLL_EPIC = 'STOP_SCROLL_EPIC';
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

const margin = 20;

function fromScrollEvent(state$: { value: any }, cancel$: any) {
  return fromEvent(document, 'scroll').pipe(
    throttleTime(100),
    mergeMap(() => {
      const { entity, result } = state$.value.comics.imageList;
      const {
        chapterList,
        chapterLatestIndex,
        chapterNowIndex,
        renderBeginIndex,
        renderEndIndex,
        innerHeight,
      } = state$.value.comics;
      let accHeight = margin;
      let viewIndex = 0;
      // $FlowFixMe
      const scrollTop = window.pageYOffset + 0.75 * innerHeight;
      const len = result.length;
      for (let i = 0; i < len; i += 1) {
        if (entity[result[i]].type === 'wide') {
          accHeight += innerHeight - 68 + 2 * margin;
        } else {
          accHeight += entity[result[i]].height + 2 * margin;
        }
        if (accHeight > scrollTop) {
          viewIndex = i;
          break;
        }
      }
      const result$ = [];
      const fetchImgSrcSafe = fetchImgSrc as any;
      const fetchImgListSafe = fetchImgList as any;
      const updateReadSafe = updateRead as any;
      if ((renderBeginIndex + renderEndIndex) / 2 !== viewIndex) {
        result$.push(
          updateRenderIndex(viewIndex - 6, viewIndex + 6),
          fetchImgSrcSafe(viewIndex - 6, viewIndex + 6),
        );
      }
      if (chapterList.length > 0) {
        const imgChapter = entity[viewIndex].chapter;
        const imgChapterIndex = findIndex(
          chapterList,
          item => item === imgChapter,
        );
        if (chapterLatestIndex === imgChapterIndex && chapterLatestIndex > 0) {
          result$.push(
            fetchImgListSafe(chapterLatestIndex - 1),
            updateChapterLatestIndex(chapterLatestIndex - 1),
          );
        }
        if (chapterNowIndex !== imgChapterIndex) {
          result$.push(updateReadSafe(imgChapterIndex));
        }
      }
      return result$;
    }),
    takeUntil(cancel$),
  );
}

export default function scrollEpic(
  action$: any,
  state$: { value: any },
) {
  return action$.pipe(
    ofType(START_SCROLL_EPIC),
    mergeMap(() => fromScrollEvent(state$, action$.pipe(ofType(STOP_SCROLL_EPIC)))),
  );
}

export function startScroll() {
  return { type: START_SCROLL_EPIC };
}

export function stopScroll() {
  return { type: STOP_SCROLL_EPIC };
}
