import {
  REQUEST_EXPORT_CONFIG,
  REQUEST_IMPORT_CONFIG,
  REQUEST_POPUP_DATA,
  REQUEST_RESET_CONFIG,
} from "@domain/actions/popup";
import {
  hydratePopupFeed,
  setExportConfig,
} from "@domain/reducers/popupState";
import type { PopupFeedEntry } from "@infra/services/library/models";
import {
  exportLibraryDump,
  getPopupFeedSnapshot,
  importLibraryDump,
  resetLibrary,
} from "@infra/services/library/popup";
import { ofType } from "redux-observable";
import { from, type Observable } from "rxjs";
import { mergeMap } from "rxjs/operators";

import type { PopupEpic } from "../types";

type PopupConfigAction = {
  type:
    | typeof REQUEST_POPUP_DATA
    | typeof REQUEST_IMPORT_CONFIG
    | typeof REQUEST_RESET_CONFIG
    | typeof REQUEST_EXPORT_CONFIG;
  payload?: unknown;
};

function updateBadge(update: PopupFeedEntry[] | undefined) {
  const count = Array.isArray(update) ? update.length : 0;
  chrome.action.setBadgeText({ text: `${count === 0 ? "" : count}` });
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
        return from(getPopupFeedSnapshot()).pipe(
          mergeMap((feed) => [hydratePopupFeed(feed, "load")]),
        );
      }

      if (action.type === REQUEST_IMPORT_CONFIG) {
        return from(importLibraryDump(action.payload || {})).pipe(
          mergeMap(() =>
            from(getPopupFeedSnapshot()).pipe(
              mergeMap((feed) => {
                updateBadge(feed.update);
                return [hydratePopupFeed(feed, "import")];
              }),
            ),
          ),
        );
      }

      if (action.type === REQUEST_RESET_CONFIG) {
        return from(resetLibrary()).pipe(
          mergeMap(() =>
            from(getPopupFeedSnapshot()).pipe(
              mergeMap((feed) => {
                updateBadge(feed.update);
                return [hydratePopupFeed(feed, "reset")];
              }),
            ),
          ),
        );
      }

      if (action.type === REQUEST_EXPORT_CONFIG) {
        return from(exportLibraryDump()).pipe(
          mergeMap((dump) => {
            const json = JSON.stringify(dump);
            const blob = new Blob([json], { type: "octet/stream" });
            const url = window.URL.createObjectURL(blob);
            return [setExportConfig(url, "comic-scroller-library.json")];
          }),
        );
      }

      return [];
    }),
  );

export default popupConfigEpic;
