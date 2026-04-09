import {
  POPUP_UPDATE_LIMIT,
  type PopupDataView,
  REQUEST_EXPORT_CONFIG,
  REQUEST_IMPORT_CONFIG,
  REQUEST_POPUP_DATA,
  REQUEST_RESET_CONFIG,
} from "@domain/actions/popup";
import {
  hydratePopupFeed,
  setExportConfig,
  setExtensionReleaseNotice,
  setPopupNotice,
} from "@domain/reducers/popupState";
import { getExtensionReleaseNotice } from "@infra/services/extensionRelease";
import {
  getPopupUpdateCount,
  type PopupFeedSnapshot,
} from "@infra/services/library/models";
import {
  exportLibraryArchive,
  getPopupFeedSnapshot,
  importLibraryDump,
  resetLibrary,
} from "@infra/services/library/popup";
import { ofType } from "redux-observable";
import { from, type Observable,of } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";

import type { PopupEpic } from "../types";

type PopupConfigAction = {
  type:
    | typeof REQUEST_POPUP_DATA
    | typeof REQUEST_IMPORT_CONFIG
    | typeof REQUEST_RESET_CONFIG
    | typeof REQUEST_EXPORT_CONFIG;
  payload?: unknown;
};

function resolvePopupView(action: PopupConfigAction): PopupDataView | undefined {
  if (action.type !== REQUEST_POPUP_DATA) {
    return undefined;
  }
  if (!action.payload || typeof action.payload !== "object") {
    return undefined;
  }
  const view = (action.payload as { view?: PopupDataView }).view;
  return view === "popup" || view === "manage" ? view : undefined;
}

function updateBadge(feed: PopupFeedSnapshot | undefined) {
  const count = getPopupUpdateCount(feed);
  chrome.action.setBadgeText({ text: `${count === 0 ? "" : count}` });
}

function getPopupConfigErrorMessage(actionType: PopupConfigAction["type"]) {
  if (actionType === REQUEST_IMPORT_CONFIG) {
    return "匯入失敗，請確認設定檔格式後再試。";
  }
  if (actionType === REQUEST_RESET_CONFIG) {
    return "重置資料失敗，請稍後再試。";
  }
  if (actionType === REQUEST_EXPORT_CONFIG) {
    return "匯出失敗，請稍後再試。";
  }
  return "目前無法載入書庫資料，請稍後再試。";
}

async function loadPopupViewData(view?: PopupDataView) {
  const [feed, extensionReleaseNotice] = await Promise.all([
    getPopupFeedSnapshot(
      view === "popup" ? { updateLimit: POPUP_UPDATE_LIMIT } : {},
    ),
    getExtensionReleaseNotice().catch(() => null),
  ]);

  return {
    feed,
    extensionReleaseNotice,
  };
}

const popupConfigEpic: PopupEpic = (action$) =>
  (action$ as Observable<PopupConfigAction>).pipe(
    ofType(
      REQUEST_POPUP_DATA,
      REQUEST_IMPORT_CONFIG,
      REQUEST_RESET_CONFIG,
      REQUEST_EXPORT_CONFIG,
    ),
    mergeMap((action) => {
      if (action.type === REQUEST_POPUP_DATA) {
        const view = resolvePopupView(action);
        return from(loadPopupViewData(view)).pipe(
          mergeMap(({ feed, extensionReleaseNotice }) => [
            hydratePopupFeed(feed, "load"),
            setExtensionReleaseNotice(extensionReleaseNotice),
          ]),
          catchError(() =>
            of(setPopupNotice(getPopupConfigErrorMessage(action.type))),
          ),
        );
      }

      if (action.type === REQUEST_IMPORT_CONFIG) {
        return from(importLibraryDump(action.payload || {})).pipe(
          mergeMap(() =>
            from(loadPopupViewData()).pipe(
              mergeMap(({ feed, extensionReleaseNotice }) => {
                updateBadge(feed);
                return [
                  hydratePopupFeed(feed, "import"),
                  setExtensionReleaseNotice(extensionReleaseNotice),
                ];
              }),
            ),
          ),
          catchError(() =>
            of(setPopupNotice(getPopupConfigErrorMessage(action.type))),
          ),
        );
      }

      if (action.type === REQUEST_RESET_CONFIG) {
        return from(resetLibrary()).pipe(
          mergeMap(() =>
            from(loadPopupViewData()).pipe(
              mergeMap(({ feed, extensionReleaseNotice }) => {
                updateBadge(feed);
                return [
                  hydratePopupFeed(feed, "reset"),
                  setExtensionReleaseNotice(extensionReleaseNotice),
                ];
              }),
            ),
          ),
          catchError(() =>
            of(setPopupNotice(getPopupConfigErrorMessage(action.type))),
          ),
        );
      }

      if (action.type === REQUEST_EXPORT_CONFIG) {
        return from(exportLibraryArchive()).pipe(
          mergeMap(({ blob, filename }) => {
            const url = window.URL.createObjectURL(blob);
            return [setExportConfig(url, filename)];
          }),
          catchError(() =>
            of(setPopupNotice(getPopupConfigErrorMessage(action.type))),
          ),
        );
      }

      return [];
    }),
  );

export default popupConfigEpic;
