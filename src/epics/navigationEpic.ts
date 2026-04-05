import {
  fetchImgList,
  NAVIGATE_CHAPTER,
  stopScroll,
  updateRead,
} from "@domain/actions/reader";
import { resetImg, updateChapterLatestIndex } from "@domain/reducers/comics";
import { ofType } from "redux-observable";
import { mergeMap } from "rxjs/operators";

import type { AppEpic } from "./types";

const navigationEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(NAVIGATE_CHAPTER),
    mergeMap((action) => {
      const { index } = action as { index: number };
      return [
        stopScroll(),
        resetImg(),
        updateRead(index),
        updateChapterLatestIndex(index),
        fetchImgList(index),
      ];
    }),
  );

export default navigationEpic;
