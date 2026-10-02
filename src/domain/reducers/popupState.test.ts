import {
  requestCleanupUnsubscribedSeries,
  requestRemoveCard,
} from "@domain/actions/popup";
import { createEmptyPopupFeedSnapshot } from "@domain/library";

import popupState, {
  finishLibraryRemoval,
  hydratePopupFeed,
  setPopupNotice,
} from "./popupState";

describe("library removal state", () => {
  it.each([
    requestCleanupUnsubscribedSeries(),
    requestRemoveCard({
      category: "subscribe",
      site: "dm5",
      comicsID: "123",
      index: 0,
      clearSeriesData: true,
    }),
  ])(
    "stays busy through library signals until the operation finishes",
    (request) => {
      const pending = popupState(undefined, request);
      const hydrated = popupState(
        pending,
        hydratePopupFeed(createEmptyPopupFeedSnapshot()),
      );
      expect(hydrated.activeAction).toBe(pending.activeAction);
      const noticed = popupState(hydrated, setPopupNotice("暫時無法載入書庫"));
      expect(noticed.activeAction).toBe(pending.activeAction);
      expect(
        popupState(noticed, finishLibraryRemoval()).activeAction,
      ).toBeNull();
    },
  );
});
