import { from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import { TOGGLE_SUBSCRIBE } from "@domain/actions/reader";
import { updateSubscribe } from "@domain/reducers/comics";
import {
  findExistingSeriesKey,
  isSeriesSubscribedByKey,
  setSeriesSubscriptionByKey,
} from "@infra/services/library";

export default function subscribeEpic(action$: any, state$: { value: any }) {
  return action$.pipe(
    ofType(TOGGLE_SUBSCRIBE),
    mergeMap(() =>
      from(
        (async () => {
          const { site: propSite, comicsID: propComicsID } =
            state$?.value?.comics || {};
          const params = new URLSearchParams(window.location.search);
          const chapterParam = params.get("chapter") || "";
          const inferSite = () => {
            if (/^m\d+$/i.test(chapterParam)) return "dm5";
            if (/^comic-\d+\.html\?ch=/i.test(chapterParam)) return "comicbus";
            if (chapterParam.startsWith("HTML/")) return "sf";
            return "";
          };
          const rawKey = String(propComicsID ?? "");
          const existingSeriesKey = await findExistingSeriesKey(rawKey, propSite);
          const resolvedSeriesKey =
            existingSeriesKey || (inferSite() ? `${inferSite()}:${rawKey}` : "");
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
