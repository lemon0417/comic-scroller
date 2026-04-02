import type { PopupFeedSnapshot } from "@infra/services/library/models";

type PopupState = {
  popup: {
    feed: PopupFeedSnapshot;
    hydrationStatus: "idle" | "loading" | "ready";
    activeAction: "import" | "export" | "reset" | null;
    notice: {
      tone: "success" | "error" | "info";
      message: string;
    } | null;
    exportUrl: string;
    exportFilename: string;
  };
};

export function selectPopupView(state: PopupState) {
  const popupState = state.popup;

  return {
    hydrationStatus: popupState.hydrationStatus,
    activeAction: popupState.activeAction,
    notice: popupState.notice,
    exportUrl: popupState.exportUrl,
    exportFilename: popupState.exportFilename,
    update: popupState.feed.update,
    subscribe: popupState.feed.subscribe,
    history: popupState.feed.history,
    continueReading: popupState.feed.continueReading,
  };
}
