import { from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import { REQUEST_REMOVE_CARD } from "@domain/actions/popup";
import { hydratePopupLibrary } from "@domain/reducers/popupState";
import {
  dismissUpdate,
  loadLibrary,
  removeSeries,
  saveLibrary,
  setSubscription,
} from "@infra/services/library";

declare var chrome: any;

export default function removeCardEpic(action$: any) {
  return action$.pipe(
    ofType(REQUEST_REMOVE_CARD),
    mergeMap((action: any) =>
      from(loadLibrary()).pipe(
        mergeMap((store: any) => {
          const payload = action?.payload || {};
          const {
            category,
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

          let newStore: any = store;
          if (category === "history") {
            newStore = site ? removeSeries(store, site, comicsID) : store;
          } else if (category === "subscribe") {
            newStore = site
              ? dismissUpdate(
                  setSubscription(store, site, comicsID, false),
                  site,
                  comicsID,
                )
              : store;
          } else if (category === "update") {
            newStore = site
              ? dismissUpdate(store, site, comicsID, chapterID)
              : store;
          }

          return from(saveLibrary(newStore)).pipe(
            mergeMap((library) => {
              chrome.action.setBadgeText({
                text: `${library.updates.length === 0 ? "" : library.updates.length}`,
              });
              return [hydratePopupLibrary(library, "load")];
            }),
          );
        }),
      ),
    ),
  );
}
