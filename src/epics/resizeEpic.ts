import { fromEvent } from "rxjs";
import { mergeMap, throttleTime } from "rxjs/operators";
import { ofType } from "redux-observable";
import { START_RESIZE_EPIC } from "@domain/actions/reader";
import { updateInnerHeight, updateInnerWidth } from "@domain/reducers/comics";

function fromResizeEvent() {
  return fromEvent(window, "resize").pipe(
    throttleTime(100),
    mergeMap(() => [
      updateInnerHeight(window.innerHeight),
      updateInnerWidth(window.innerWidth),
    ]),
  );
}

export default function resizeEpic(action$: any) {
  return action$.pipe(
    ofType(START_RESIZE_EPIC),
    mergeMap(() => fromResizeEvent()),
  );
}
