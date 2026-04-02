import { from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import { TOGGLE_SUBSCRIBE } from "@domain/actions/reader";
import { updateSubscribe } from "@domain/reducers/comics";
import {
  isSeriesSubscribedByKey,
  setSeriesSubscriptionByKey,
} from "@infra/services/library";

export default function subscribeEpic(action$: any, state$: { value: any }) {
  return action$.pipe(
    ofType(TOGGLE_SUBSCRIBE),
    mergeMap(() =>
      from(
        (async () => {
          const resolvedSeriesKey = String(state$?.value?.comics?.seriesKey || "");
          if (!resolvedSeriesKey) {
            return null;
          }

          const nextSubscribe = !(await isSeriesSubscribedByKey(resolvedSeriesKey));
          await setSeriesSubscriptionByKey(resolvedSeriesKey, nextSubscribe);
          return nextSubscribe;
        })(),
      ).pipe(
        mergeMap((nextSubscribe) =>
          typeof nextSubscribe === "boolean" ? [updateSubscribe(nextSubscribe)] : [],
        ),
      ),
    ),
  );
}
