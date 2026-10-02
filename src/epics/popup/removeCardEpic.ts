import {
  type RemoveCardPayload,
  REQUEST_CLEANUP_UNSUBSCRIBED_SERIES,
  REQUEST_REMOVE_CARD,
} from "@domain/actions/popup";
import {
  buildSeriesKey,
  createEmptyLibrarySyncStatus,
  getPopupUpdateCount,
  type SiteKey,
} from "@domain/library";
import {
  finishLibraryRemoval,
  hydratePopupFeed,
  setLibrarySyncStatus,
  setPopupNotice,
} from "@domain/reducers/popupState";
import {
  cleanupUnsubscribedSeries,
  dismissSeriesUpdate,
  getPopupFeedSnapshot,
  pushLibrarySyncIfEnabled,
  removeSeriesFromHistory,
  unsubscribeSeriesByKey,
} from "@infra/services/library/popup";
import { ofType } from "redux-observable";
import { defer, from, type Observable } from "rxjs";
import { catchError, exhaustMap, mergeMap } from "rxjs/operators";

import type { PopupEpic } from "../types";

type RemoveCardAction = {
  type: typeof REQUEST_REMOVE_CARD | typeof REQUEST_CLEANUP_UNSUBSCRIBED_SERIES;
  payload?: Partial<RemoveCardPayload> & {
    site?: SiteKey;
  };
};

function getRemoveErrorMessage(payload: RemoveCardAction["payload"]) {
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

const removeCardEpic: PopupEpic = (action$, state$) =>
  (action$ as Observable<RemoveCardAction>).pipe(
    ofType(REQUEST_REMOVE_CARD, REQUEST_CLEANUP_UNSUBSCRIBED_SERIES),
    exhaustMap((action) => {
      const isCleanup = action.type === REQUEST_CLEANUP_UNSUBSCRIBED_SERIES;
      const { category, comicsID, chapterID, clearSeriesData, site } =
        action.payload || {};

      if (!isCleanup && (!category || !comicsID || !site)) {
        return [finishLibraryRemoval()];
      }

      return defer(async () => {
        let removedSeriesCount: number | null = null;
        if (isCleanup) {
          removedSeriesCount = (await cleanupUnsubscribedSeries())
            .removedSeriesCount;
        } else if (site && comicsID) {
          if (category === "history") {
            await removeSeriesFromHistory(site, comicsID);
          } else if (category === "subscribe") {
            await unsubscribeSeriesByKey(buildSeriesKey(site, comicsID), {
              clearSeriesData: clearSeriesData === true,
            });
          } else {
            await dismissSeriesUpdate(site, comicsID, chapterID);
          }
        }
        const librarySyncStatus = await pushLibrarySyncIfEnabled().catch(() =>
          createEmptyLibrarySyncStatus({
            ...state$?.value?.popup?.librarySyncStatus,
            lastError: "同步失敗，請稍後再試。",
          }),
        );
        const feed = await getPopupFeedSnapshot();
        const count = getPopupUpdateCount(feed);
        await chrome.action.setBadgeText({ text: count ? String(count) : "" });
        return [
          hydratePopupFeed(feed, "load"),
          setLibrarySyncStatus(librarySyncStatus),
          finishLibraryRemoval(),
          ...(removedSeriesCount === null
            ? []
            : [
                setPopupNotice(
                  removedSeriesCount
                    ? `已清理 ${removedSeriesCount} 部未追蹤作品。`
                    : "沒有需要清理的未追蹤作品。",
                  "success",
                ),
              ]),
        ];
      }).pipe(
        mergeMap((actions) => from(actions)),
        catchError(() =>
          from([
            finishLibraryRemoval(),
            setPopupNotice(
              isCleanup
                ? "清理未追蹤作品失敗，請稍後再試。"
                : getRemoveErrorMessage(action.payload),
            ),
          ]),
        ),
      );
    }),
  );

export default removeCardEpic;
