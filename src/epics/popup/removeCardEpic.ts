import { from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import { REQUEST_REMOVE_CARD } from "@domain/actions/popup";
import { hydratePopupFeed } from "@domain/reducers/popupState";
import {
  dismissSeriesUpdate,
  getPopupFeedSnapshot,
  removeSeriesCascade,
  setSeriesSubscription,
} from "@infra/services/library";

declare var chrome: any;

export default function removeCardEpic(action$: any) {
  return action$.pipe(
    ofType(REQUEST_REMOVE_CARD),
    mergeMap((action: any) => {
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
        site?: "dm5" | "sf" | "comicbus";
      } = payload;

      if (!category || !comicsID || !site) {
        return [];
      }

      const operation =
        category === "history"
          ? removeSeriesCascade(site, comicsID)
          : category === "subscribe"
            ? setSeriesSubscription(site, comicsID, false).then(() =>
                dismissSeriesUpdate(site, comicsID),
              )
            : dismissSeriesUpdate(site, comicsID, chapterID);

      return from(operation).pipe(
        mergeMap((updateCount) =>
          from(getPopupFeedSnapshot()).pipe(
            mergeMap((feed) => {
              chrome.action.setBadgeText({
                text: `${updateCount === 0 ? "" : updateCount}`,
              });
              return [hydratePopupFeed(feed, "load")];
            }),
          ),
        ),
      );
    }),
  );
}
