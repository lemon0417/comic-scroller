import { mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import {
  NAVIGATE_CHAPTER,
  fetchImgList,
  stopScroll,
  updateRead,
} from "@domain/actions/reader";
import { resetImg, updateChapterLatestIndex } from "@domain/reducers/comics";

export default function navigationEpic(action$: any) {
  return action$.pipe(
    ofType(NAVIGATE_CHAPTER),
    mergeMap((action: { index: number }) => [
      stopScroll(),
      resetImg(),
      updateRead(action.index),
      updateChapterLatestIndex(action.index),
      fetchImgList(action.index),
    ]),
  );
}
