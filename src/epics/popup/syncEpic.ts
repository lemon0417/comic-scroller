import { Observable } from "rxjs";
import { exhaustMap } from "rxjs/operators";
import { ofType } from "redux-observable";
import { REQUEST_POPUP_DATA } from "@domain/actions/popup";
import { hydratePopupFeed } from "@domain/reducers/popupState";
import {
  getPopupFeedSnapshot,
  subscribeToLibrarySignal,
} from "@infra/services/library";

function observeLibraryChanges() {
  return new Observable((subscriber) => {
    const unsubscribe = subscribeToLibrarySignal(() => {
      getPopupFeedSnapshot().then((feed) => {
        subscriber.next(hydratePopupFeed(feed, "load"));
      });
    });
    return unsubscribe;
  });
}

export default function popupSyncEpic(action$: any) {
  return action$.pipe(
    ofType(REQUEST_POPUP_DATA),
    exhaustMap(() => observeLibraryChanges()),
  );
}
