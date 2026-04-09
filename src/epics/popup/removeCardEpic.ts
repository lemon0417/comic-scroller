import {
  type RemoveCardPayload,
  REQUEST_REMOVE_CARD,
} from "@domain/actions/popup";
import {
  hydratePopupFeed,
  setPopupNotice,
} from "@domain/reducers/popupState";
import { getPopupUpdateCount } from "@infra/services/library/models";
import {
  dismissSeriesUpdate,
  getPopupFeedSnapshot,
  removeSeriesCascade,
  removeSeriesFromHistory,
  setSeriesSubscription,
} from "@infra/services/library/popup";
import type { SiteKey } from "@infra/services/library/schema";
import { ofType } from "redux-observable";
import { from, type Observable,of } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";

import type { PopupEpic } from "../types";

type RemoveCardAction = {
  type: typeof REQUEST_REMOVE_CARD;
  payload?: Partial<RemoveCardPayload> & {
    site?: SiteKey;
  };
};

function getRemoveErrorMessage(
  payload: RemoveCardAction["payload"],
) {
  if (payload?.category === "history") {
    return "移除閱讀紀錄失敗，請稍後再試。";
  }
  if (payload?.category === "subscribe") {
    return payload.clearSeriesData
      ? "清除作品資料失敗，請稍後再試。"
      : "取消追蹤失敗，請稍後再試。";
  }
  return "略過更新失敗，請稍後再試。";
}

const removeCardEpic: PopupEpic = (action$) =>
  (action$ as Observable<RemoveCardAction>).pipe(
    ofType(REQUEST_REMOVE_CARD),
    mergeMap((action) => {
      const {
        category,
        comicsID,
        chapterID,
        clearSeriesData,
        site,
      } = action.payload || {};

      if (!category || !comicsID || !site) {
        return [];
      }

      const operation =
        category === "history"
          ? removeSeriesFromHistory(site, comicsID)
          : category === "subscribe"
            ? clearSeriesData
              ? removeSeriesCascade(site, comicsID)
              : setSeriesSubscription(site, comicsID, false).then(() =>
                  dismissSeriesUpdate(site, comicsID),
                )
            : dismissSeriesUpdate(site, comicsID, chapterID);

      return from(operation).pipe(
        mergeMap(() =>
          from(getPopupFeedSnapshot()).pipe(
            mergeMap((feed) => {
              const count = getPopupUpdateCount(feed);
              chrome.action.setBadgeText({
                text: `${count === 0 ? "" : count}`,
              });
              return [hydratePopupFeed(feed, "load")];
            }),
          ),
        ),
        catchError(() => of(setPopupNotice(getRemoveErrorMessage(action.payload)))),
      );
    }),
  );

export default removeCardEpic;
