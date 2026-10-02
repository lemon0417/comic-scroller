import type { DeveloperToolsState } from "@domain/reducers/developerTools";
import type { PopupState } from "@domain/reducers/popupState";
import { IS_DEVELOPMENT_BUILD } from "@utils/buildMode";

type State = { popup: PopupState; developerTools?: DeveloperToolsState };

export function selectPopupView(state: State) {
  const popupState = state.popup;

  return {
    hydrationStatus: popupState.hydrationStatus,
    activeAction: popupState.activeAction,
    developerCheckRunning:
      IS_DEVELOPMENT_BUILD && state.developerTools?.checkStatus === "running",
    notice: popupState.notice,
    extensionReleaseNotice: popupState.extensionReleaseNotice,
    exportUrl: popupState.exportUrl,
    exportFilename: popupState.exportFilename,
    librarySyncStatus: popupState.librarySyncStatus,
    update: popupState.feed.update,
    updatesTruncated: popupState.feed.updatesTruncated === true,
    subscribe: popupState.feed.subscribe,
    history: popupState.feed.history,
    continueReading: popupState.feed.continueReading,
  };
}

export type PopupViewProps = ReturnType<typeof selectPopupView>;
