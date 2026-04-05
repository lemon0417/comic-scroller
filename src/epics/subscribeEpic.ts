import { TOGGLE_SUBSCRIBE } from "@domain/actions/reader";
import { updateSubscribe } from "@domain/reducers/comics";
import {
  isSeriesSubscribedByKey,
  setSeriesSubscriptionByKey,
} from "@infra/services/library/reader";
import { ofType } from "redux-observable";
import { from } from "rxjs";
import { mergeMap } from "rxjs/operators";

import type { AppEpic } from "./types";

const subscribeEpic: AppEpic = (action$, state$) =>
  action$.pipe(
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

export default subscribeEpic;
