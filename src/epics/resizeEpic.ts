import { START_RESIZE_EPIC } from "@domain/actions/reader";
import { updateInnerHeight, updateInnerWidth } from "@domain/reducers/comics";
import { ofType } from "redux-observable";
import { fromEvent } from "rxjs";
import { mergeMap, throttleTime } from "rxjs/operators";

import type { AppEpic } from "./types";

function fromResizeEvent() {
  return fromEvent(window, "resize").pipe(
    throttleTime(100),
    mergeMap(() => [
      updateInnerHeight(window.innerHeight),
      updateInnerWidth(window.innerWidth),
    ]),
  );
}

const resizeEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(START_RESIZE_EPIC),
    mergeMap(() => fromResizeEvent()),
  );

export default resizeEpic;
