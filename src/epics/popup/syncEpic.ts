import {
  POPUP_UPDATE_LIMIT,
  type PopupDataView,
  REQUEST_POPUP_DATA,
} from "@domain/actions/popup";
import { hydratePopupFeed } from "@domain/reducers/popupState";
import {
  getPopupFeedSnapshot,
  subscribeToLibrarySignal,
} from "@infra/services/library/popup";
import { ofType } from "redux-observable";
import { Observable } from "rxjs";
import { exhaustMap } from "rxjs/operators";

import type { PopupEpic } from "../types";

function observeLibraryChanges(view?: PopupDataView) {
  return new Observable<ReturnType<typeof hydratePopupFeed>>((subscriber) => {
    const unsubscribe = subscribeToLibrarySignal(() => {
      getPopupFeedSnapshot(
        view === "popup" ? { updateLimit: POPUP_UPDATE_LIMIT } : {},
      ).then((feed) => {
        subscriber.next(hydratePopupFeed(feed, "load"));
      });
    });
    return unsubscribe;
  });
}

function resolvePopupView(action: { payload?: unknown }): PopupDataView | undefined {
  if (!action.payload || typeof action.payload !== "object") {
    return undefined;
  }
  const view = (action.payload as { view?: PopupDataView }).view;
  return view === "popup" || view === "manage" ? view : undefined;
}

const popupSyncEpic: PopupEpic = (action$) =>
  action$.pipe(
    ofType(REQUEST_POPUP_DATA),
    exhaustMap((action) =>
      observeLibraryChanges(resolvePopupView(action as { payload?: unknown })),
    ),
  );

export default popupSyncEpic;
