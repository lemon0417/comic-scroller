import {
  REQUEST_BACKGROUND_CHECK,
  REQUEST_INITIALIZE_DEVELOPER_TOOLS,
  REQUEST_SET_DEV_LOG_ENABLED,
} from "@domain/actions/developerTools";
import {
  finishBackgroundCheck,
  finishDevLogSetting,
} from "@domain/reducers/developerTools";
import { runDeveloperBackgroundCheck } from "@infra/services/developerTools";
import { IS_DEVELOPMENT_BUILD } from "@utils/buildMode";
import { isDevLogEnabled, setDevLogEnabled } from "@utils/devLog";
import { ofType } from "redux-observable";
import {
  catchError,
  defer,
  EMPTY,
  exhaustMap,
  merge,
  mergeMap,
  type Observable,
  of,
} from "rxjs";

import type { EpicAction, PopupEpic } from "../types";

type DebugSettingAction = EpicAction & {
  type:
    | typeof REQUEST_INITIALIZE_DEVELOPER_TOOLS
    | typeof REQUEST_SET_DEV_LOG_ENABLED;
  enabled?: boolean;
};

const debugSettingEpic: PopupEpic = (action$) =>
  (action$ as Observable<DebugSettingAction>).pipe(
    ofType(REQUEST_INITIALIZE_DEVELOPER_TOOLS, REQUEST_SET_DEV_LOG_ENABLED),
    mergeMap((action) =>
      defer(() => {
        if (!IS_DEVELOPMENT_BUILD) return EMPTY;
        if (action.type === REQUEST_INITIALIZE_DEVELOPER_TOOLS) {
          return of(finishDevLogSetting(isDevLogEnabled()));
        }
        const enabled = action.enabled === true;
        if (!setDevLogEnabled(enabled))
          throw new Error("目前無法切換除錯記錄。");
        return of(finishDevLogSetting(enabled));
      }).pipe(
        catchError(() =>
          of(
            finishDevLogSetting(
              undefined,
              "目前無法存取除錯設定，請檢查瀏覽器儲存空間後重試。",
            ),
          ),
        ),
      ),
    ),
  );

const backgroundCheckEpic: PopupEpic = (action$, state$) =>
  action$.pipe(
    ofType(REQUEST_BACKGROUND_CHECK),
    exhaustMap(() => {
      if (!IS_DEVELOPMENT_BUILD) return EMPTY;
      return defer(async () => {
        if (state$.value.popup.activeAction !== null) {
          throw new Error("書庫資料正在更新，請稍後再執行背景檢查。");
        }
        return runDeveloperBackgroundCheck();
      }).pipe(
        mergeMap((result) => of(finishBackgroundCheck(result))),
        catchError((error: unknown) =>
          of(
            finishBackgroundCheck(
              undefined,
              error instanceof Error
                ? error.message
                : "背景檢查失敗，請稍後重試。",
            ),
          ),
        ),
      );
    }),
  );

const developerToolsEpic: PopupEpic = IS_DEVELOPMENT_BUILD
  ? (action$, state$) =>
      merge(
        debugSettingEpic(action$, state$),
        backgroundCheckEpic(action$, state$),
      )
  : () => EMPTY;

export default developerToolsEpic;
