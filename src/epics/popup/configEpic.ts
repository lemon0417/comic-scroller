import { bindCallback } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import {
  REQUEST_EXPORT_CONFIG,
  REQUEST_IMPORT_CONFIG,
  REQUEST_POPUP_DATA,
  REQUEST_RESET_CONFIG,
} from "@domain/actions/popup";
import {
  setExportConfig,
  updatePopupData,
} from "@containers/PopupApp/reducers/popup";
import initObject from "@utils/initObject";
import { storageGet, storageSet, storageClear } from "@infra/services/storage";

declare var chrome: any;

const storageGet$ = bindCallback(storageGet);
const storageSet$ = bindCallback(storageSet);
const storageClear$ = bindCallback(storageClear);

function updateBadge(update: any[] | undefined) {
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
        return storageGet$().pipe(
          mergeMap((item: any) => [updatePopupData(item, "load")]),
        );
      }

      if (action.type === REQUEST_IMPORT_CONFIG) {
        return storageSet$(action.payload || {}).pipe(
          mergeMap(() =>
            storageGet$().pipe(
              mergeMap((item: any) => {
                updateBadge(item?.update);
                chrome.runtime.sendMessage({ msg: "UPDATE" });
                return [updatePopupData(item, "import")];
              }),
            ),
          ),
        );
      }

      if (action.type === REQUEST_RESET_CONFIG) {
        return storageClear$().pipe(
          mergeMap(() =>
            storageSet$(initObject).pipe(
              mergeMap(() =>
                storageGet$().pipe(
                  mergeMap((item: any) => {
                    updateBadge(item?.update);
                    chrome.runtime.sendMessage({ msg: "UPDATE" });
                    return [updatePopupData(item, "reset")];
                  }),
                ),
              ),
            ),
          ),
        );
      }

      if (action.type === REQUEST_EXPORT_CONFIG) {
        return storageGet$().pipe(
          mergeMap((item: any) => {
            const json = JSON.stringify(item);
            const blob = new Blob([json], { type: "octet/stream" });
            const url = window.URL.createObjectURL(blob);
            return [setExportConfig(url, "comic-scroller-config.json")];
          }),
        );
      }

      return [];
    }),
  );
}
