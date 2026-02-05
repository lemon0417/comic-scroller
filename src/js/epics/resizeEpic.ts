import { fromEvent } from 'rxjs';
import { mergeMap, throttleTime } from 'rxjs/operators';
import { ofType } from 'redux-observable';
import { updateInnerHeight } from '../reducers/comics';

const START_RESIZE_EPIC = 'START_RESIZE_EPIC';

function fromResizeEvent() {
  return fromEvent(window, 'resize').pipe(
    throttleTime(100),
    mergeMap(() => [updateInnerHeight(window.innerHeight)]),
  );
}

export default function resizeEpic(action$: any) {
  return action$.pipe(
    ofType(START_RESIZE_EPIC),
    mergeMap(() => fromResizeEvent()),
  );
}

export function startResize() {
  return { type: START_RESIZE_EPIC };
}
