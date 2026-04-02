import { from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
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
import {
  exportLibraryDump,
  getPopupFeedSnapshot,
  importLibraryDump,
  resetLibrary,
} from "@infra/services/library";

declare var chrome: any;

function updateBadge(update: Array<any> | undefined) {
  const count = Array.isArray(update) ? update.length : 0;
  chrome.action.setBadgeText({ text: `${count === 0 ? "" : count}` });
}

export default function popupConfigEpic(action$: any) {
  return action$.pipe(
    ofType(
      REQUEST_POPUP_DATA,
      REQUEST_IMPORT_CONFIG,
      REQUEST_RESET_CONFIG,
      REQUEST_EXPORT_CONFIG,
    ),
    mergeMap((action: any) => {
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
}
