import { bindCallback } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import filter from "lodash/filter";
import pickBy from "lodash/pickBy";
import { REQUEST_REMOVE_CARD } from "@domain/actions/popup";
import { moveCard } from "@containers/PopupApp/reducers/popup";
import { storageGet, storageSet } from "@infra/services/storage";

declare var chrome: any;

const storageGet$ = bindCallback(storageGet);
const storageSet$ = bindCallback(storageSet);

export default function removeCardEpic(action$: any) {
  return action$.pipe(
    ofType(REQUEST_REMOVE_CARD),
    mergeMap((action: any) =>
      storageGet$().pipe(
        mergeMap((store: any) => {
          const payload = action?.payload || {};
          const {
            category,
            index,
            comicsID,
            chapterID,
            site,
          }: {
            category?: "update" | "subscribe" | "history";
            index?: number | string;
            comicsID?: string;
            chapterID?: string;
            site?: string;
          } = payload;

          if (!category || !comicsID) {
            return [];
          }

          let newStore: any = { update: [] };
          if (category === "history") {
            newStore = {
              history: filter(
                store.history,
                (item) => item.comicsID !== comicsID,
              ),
              subscribe: filter(
                store.subscribe,
                (item) => item.comicsID !== comicsID,
              ),
              update: filter(
                store.update,
                (item) => item.comicsID !== comicsID,
              ),
              ...(site
                ? {
                    [site]: pickBy(
                      store[site],
                      (_item, key) => key !== comicsID,
                    ),
                  }
                : {}),
            };
          } else if (category === "subscribe") {
            const indexKey = String(index ?? "");
            newStore = {
              subscribe: filter(
                store.subscribe,
                (_item, i) => String(i) !== indexKey,
              ),
              update: filter(
                store.update,
                (item) => item.comicsID !== comicsID,
              ),
            };
          } else if (category === "update") {
            newStore = {
              update: filter(
                store.update,
                (item) =>
                  item.comicsID !== comicsID || item.chapterID !== chapterID,
              ),
            };
          }

          return storageSet$(newStore).pipe(
            mergeMap(() => {
              const parsedIndex =
                typeof index === "number"
                  ? index
                  : parseInt(String(index ?? ""), 10);
              const moveIndex = Number.isFinite(parsedIndex) ? parsedIndex : -1;
              chrome.action.setBadgeText({
                text: `${
                  newStore.update.length === 0 ? "" : newStore.update.length
                }`,
              });
              chrome.runtime.sendMessage({ msg: "UPDATE" });
              return [moveCard(category, moveIndex)];
            }),
          );
        }),
      ),
    ),
  );
}
