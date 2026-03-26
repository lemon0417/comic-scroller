import { from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import { TOGGLE_SUBSCRIBE } from "@domain/actions/reader";
import { updateSubscribe } from "@domain/reducers/comics";
import {
  getSeries,
  isSubscribed,
  loadLibrary,
  saveLibrary,
  setSubscription,
} from "@infra/services/library";

export default function subscribeEpic(action$: any, state$: { value: any }) {
  return action$.pipe(
    ofType(TOGGLE_SUBSCRIBE),
    mergeMap(() =>
      from(loadLibrary()).pipe(
        mergeMap((item: any) => {
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
          const resolveSiteAndId = (store: any) => {
            const rawKey = String(propComicsID ?? "");

            if (propSite) {
              const fromLibrary = getSeries(store, propSite, rawKey);
              return {
                site: propSite,
                comicsID: fromLibrary?.comicsID || rawKey,
              };
            }

            const candidates = ["dm5", "sf", "comicbus"];
            for (const candidate of candidates) {
              const fromLibrary = getSeries(store, candidate, rawKey);
              if (fromLibrary) {
                return { site: candidate, comicsID: fromLibrary.comicsID };
              }
            }

            const inferred = inferSite();
            if (inferred) {
              return { site: inferred, comicsID: rawKey };
            }
            return { site: "", comicsID: rawKey };
          };

          const { site, comicsID } = resolveSiteAndId(item);
          if (!site) {
            return [];
          }

          const nextSubscribe = !isSubscribed(item, site, comicsID);
          const newItem = setSubscription(item, site, comicsID, nextSubscribe);

          return from(saveLibrary(newItem)).pipe(
            mergeMap(() => [updateSubscribe(nextSubscribe)]),
          );
        }),
      ),
    ),
  );
}
