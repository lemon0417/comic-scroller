import {
  finishReaderSubscription,
  REQUEST_UNSUBSCRIBE_SERIES,
  TOGGLE_SUBSCRIBE,
} from "@domain/actions/reader";
import { updateSubscribe } from "@domain/reducers/comics";
import {
  getReaderSeriesSyncState,
  pushLibrarySyncIfEnabled,
  setSeriesSubscriptionByKey,
  unsubscribeSeriesByKey,
} from "@infra/services/library/reader";
import { devLog } from "@utils/devLog";
import { closeCurrentTab } from "@utils/navigation";
import { ofType } from "redux-observable";
import { defer, from, type Observable } from "rxjs";
import { exhaustMap, mergeMap } from "rxjs/operators";

import type { AppEpic } from "./types";

type SubscriptionAction = {
  type: typeof TOGGLE_SUBSCRIBE | typeof REQUEST_UNSUBSCRIBE_SERIES;
  seriesKey?: string;
  clearSeriesData?: boolean;
};

const subscribeEpic: AppEpic = (action$, state$) =>
  (action$ as Observable<SubscriptionAction>).pipe(
    ofType(TOGGLE_SUBSCRIBE, REQUEST_UNSUBSCRIBE_SERIES),
    exhaustMap((action) =>
      defer(async () => {
        const seriesKey = String(
          action.seriesKey ?? state$.value.comics.seriesKey ?? "",
        );
        const isUnsubscribe = action.type === REQUEST_UNSUBSCRIBE_SERIES;
        if (!seriesKey || seriesKey !== state$.value.comics.seriesKey) {
          return [finishReaderSubscription(state$.value.comics.seriesKey)];
        }

        let subscribed = false;
        let updatesCount: number | undefined;
        try {
          if (isUnsubscribe) {
            updatesCount = await unsubscribeSeriesByKey(seriesKey, {
              clearSeriesData: action.clearSeriesData === true,
            });
          } else {
            subscribed = await setSeriesSubscriptionByKey(seriesKey, true);
          }
        } catch (error) {
          devLog("reader:subscription-failed", error);
          const current = await getReaderSeriesSyncState(seriesKey).catch(
            () => null,
          );
          return [
            finishReaderSubscription(
              seriesKey,
              isUnsubscribe
                ? "取消追蹤失敗，請稍後再試。"
                : "追蹤作品失敗，請稍後再試。",
              Boolean(current?.exists),
            ),
          ];
        }

        let message = "";
        if (typeof updatesCount === "number") {
          try {
            await chrome.action.setBadgeText({
              text: updatesCount ? String(updatesCount) : "",
            });
          } catch (error) {
            devLog("reader:subscription-badge-failed", error);
            message = "本機資料已更新，但無法更新提示數量，請重新開啟書庫。";
          }
        }
        try {
          const syncStatus = await pushLibrarySyncIfEnabled();
          if (syncStatus.lastError)
            message = "本機資料已更新，但同步失敗，請到書庫選項重試。";
        } catch (error) {
          devLog("reader:subscription-sync-failed", error);
          message = "本機資料已更新，但同步失敗，請到書庫選項重試。";
        }

        if (seriesKey !== state$.value.comics.seriesKey) return [];
        try {
          const current = await getReaderSeriesSyncState(seriesKey);
          if (seriesKey !== state$.value.comics.seriesKey) return [];
          subscribed = current.subscribed;
          if (!current.exists) await closeCurrentTab();
        } catch (error) {
          devLog("reader:close-after-subscription-failed", error);
          message = isUnsubscribe
            ? "已取消追蹤，但無法確認或關閉閱讀分頁，請手動關閉。"
            : "本機資料已更新，但無法確認或關閉閱讀分頁，請手動關閉。";
        }
        return [
          updateSubscribe(subscribed),
          finishReaderSubscription(seriesKey, message),
        ];
      }).pipe(mergeMap((actions) => from(actions))),
    ),
  );

export default subscribeEpic;
