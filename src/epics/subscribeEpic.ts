import { bindCallback } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import filter from "lodash/filter";
import some from "lodash/some";
import { TOGGLE_SUBSCRIBE } from "@domain/actions/reader";
import { updateSubscribe } from "@domain/reducers/comics";
import { storageGet, storageSet } from "@infra/services/storage";

const storageGet$ = bindCallback(storageGet);
const storageSet$ = bindCallback(storageSet);

export default function subscribeEpic(action$: any, state$: { value: any }) {
  return action$.pipe(
    ofType(TOGGLE_SUBSCRIBE),
    mergeMap(() =>
      storageGet$().pipe(
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
            const tryKeys = (bucket: any, baseKey: string) => {
              if (!bucket) return null;
              if (baseKey && bucket[baseKey]) return baseKey;
              const withPrefix = baseKey ? `m${baseKey}` : "";
              if (withPrefix && bucket[withPrefix]) return withPrefix;
              if (baseKey.startsWith("m")) {
                const stripped = baseKey.slice(1);
                if (stripped && bucket[stripped]) return stripped;
              }
              return null;
            };

            if (propSite) {
              const resolvedKey = tryKeys(store[propSite], rawKey) || rawKey;
              return { site: propSite, comicsID: resolvedKey };
            }

            const candidates = ["dm5", "sf", "comicbus"];
            for (const candidate of candidates) {
              const resolvedKey = tryKeys(store[candidate], rawKey);
              if (resolvedKey) {
                return { site: candidate, comicsID: resolvedKey };
              }
            }

            const inferred = inferSite();
            if (inferred) {
              return { site: inferred, comicsID: rawKey };
            }
            return { site: "", comicsID: rawKey };
          };

          const { site, comicsID } = resolveSiteAndId(item);
          if (!site || !item?.subscribe) {
            return [];
          }

          let newItem = {};
          let nextSubscribe = false;
          if (
            some(
              item.subscribe,
              (citem: any) =>
                citem.site === site && citem.comicsID === comicsID,
            )
          ) {
            newItem = {
              ...item,
              subscribe: filter(
                item.subscribe,
                (citem: any) =>
                  citem.site !== site || citem.comicsID !== comicsID,
              ),
            };
            nextSubscribe = false;
          } else {
            newItem = {
              ...item,
              subscribe: [
                {
                  site,
                  comicsID,
                },
                ...item.subscribe,
              ],
            };
            nextSubscribe = true;
          }

          return storageSet$(newItem).pipe(
            mergeMap(() => [updateSubscribe(nextSubscribe)]),
          );
        }),
      ),
    ),
  );
}
