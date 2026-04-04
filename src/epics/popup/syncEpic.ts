import { Observable } from "rxjs";
import { exhaustMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import { REQUEST_POPUP_DATA } from "@domain/actions/popup";
import { hydratePopupFeed } from "@domain/reducers/popupState";
import {
  getPopupFeedSnapshot,
  subscribeToLibrarySignal,
} from "@infra/services/library";
import type { PopupEpic } from "../types";

function observeLibraryChanges() {
  return new Observable<ReturnType<typeof hydratePopupFeed>>((subscriber) => {
    const unsubscribe = subscribeToLibrarySignal(() => {
      getPopupFeedSnapshot().then((feed) => {
        subscriber.next(hydratePopupFeed(feed, "load"));
      });
    });
    return unsubscribe;
  });
}

const popupSyncEpic: PopupEpic = (action$) =>
  action$.pipe(
    ofType(REQUEST_POPUP_DATA),
    exhaustMap(() => observeLibraryChanges()),
  );

export default popupSyncEpic;
