import { from, type Observable } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import {
  REQUEST_REMOVE_CARD,
  type RemoveCardPayload,
} from "@domain/actions/popup";
import { hydratePopupFeed } from "@domain/reducers/popupState";
import type { SiteKey } from "@infra/services/library/schema";
import {
  dismissSeriesUpdate,
  getPopupFeedSnapshot,
  removeSeriesCascade,
  setSeriesSubscription,
} from "@infra/services/library";
import type { PopupEpic } from "../types";

type RemoveCardAction = {
  type: typeof REQUEST_REMOVE_CARD;
  payload?: Partial<RemoveCardPayload> & {
    site?: SiteKey;
  };
};

const removeCardEpic: PopupEpic = (action$) =>
  (action$ as Observable<RemoveCardAction>).pipe(
    ofType(REQUEST_REMOVE_CARD),
    mergeMap((action) => {
      const {
        category,
        comicsID,
        chapterID,
        site,
      } = action.payload || {};

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

export default removeCardEpic;
