import {
  REQUEST_CLEANUP_UNSUBSCRIBED_SERIES,
  REQUEST_DISMISS_EXTENSION_RELEASE_NOTICE,
  REQUEST_EXPORT_CONFIG,
  REQUEST_IMPORT_CONFIG,
  REQUEST_POPUP_DATA,
  REQUEST_REMOVE_CARD,
  REQUEST_RESET_CONFIG,
  REQUEST_SET_LIBRARY_SYNC_ENABLED,
  REQUEST_SYNC_LIBRARY_NOW,
} from "@domain/actions/popup";
import type { ExtensionReleaseNotice } from "@domain/extensionRelease";
import {
  createEmptyLibrarySyncStatus,
  createEmptyPopupFeedSnapshot,
  type LibrarySyncStatus,
  type PopupFeedSnapshot,
} from "@domain/library";

type HydrationSource = "load" | "import" | "reset";
type ActiveAction =
  | "import"
  | "export"
  | "remove"
  | "cleanup"
  | "reset"
  | "sync"
  | null;

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

export type PopupState = {
  feed: PopupFeedSnapshot;
  extensionReleaseNotice: ExtensionReleaseNotice | null;
  hydrationStatus: "idle" | "loading" | "ready";
  activeAction: ActiveAction;
  notice: Notice | null;
  exportUrl: string;
  exportFilename: string;
  librarySyncStatus: LibrarySyncStatus;
};

type Action = {
  type: string;
  data?: PopupFeedSnapshot;
  source?: HydrationSource;
  url?: string;
  filename?: string;
  message?: string;
  notice?: ExtensionReleaseNotice | null;
  tone?: Notice["tone"];
  syncStatus?: LibrarySyncStatus;
};

const HYDRATE_POPUP_FEED = "HYDRATE_POPUP_FEED";
const SET_EXPORT_CONFIG = "SET_EXPORT_CONFIG";
const SET_POPUP_NOTICE = "SET_POPUP_NOTICE";
const SET_EXTENSION_RELEASE_NOTICE = "SET_EXTENSION_RELEASE_NOTICE";
const SET_LIBRARY_SYNC_STATUS = "SET_LIBRARY_SYNC_STATUS";
const CLEAR_EXPORT_CONFIG = "CLEAR_EXPORT_CONFIG";
const CLEAR_POPUP_NOTICE = "CLEAR_POPUP_NOTICE";
const FINISH_LIBRARY_REMOVAL = "FINISH_LIBRARY_REMOVAL";

const initialState: PopupState = {
  feed: createEmptyPopupFeedSnapshot(),
  extensionReleaseNotice: null,
  hydrationStatus: "idle",
  activeAction: null,
  notice: null,
  exportUrl: "",
  exportFilename: "",
  librarySyncStatus: createEmptyLibrarySyncStatus(),
};

function resolveSuccessNotice(source?: HydrationSource) {
  if (source === "import") {
    return {
      tone: "success" as const,
      message: "匯入完成。",
    };
  }
  if (source === "reset") {
    return {
      tone: "success" as const,
      message: "資料已重置。",
    };
  }
  return null;
}

export default function popupState(
  state: PopupState = initialState,
  action: Action,
): PopupState {
  switch (action.type) {
    case REQUEST_CLEANUP_UNSUBSCRIBED_SERIES:
      return { ...state, activeAction: "cleanup", notice: null };
    case FINISH_LIBRARY_REMOVAL:
      return { ...state, activeAction: null };
    case REQUEST_POPUP_DATA:
      return {
        ...state,
        hydrationStatus: "loading",
      };
    case REQUEST_IMPORT_CONFIG:
      return {
        ...state,
        activeAction: "import",
        notice: null,
      };
    case REQUEST_RESET_CONFIG:
      return {
        ...state,
        activeAction: "reset",
        notice: null,
      };
    case REQUEST_EXPORT_CONFIG:
      return {
        ...state,
        activeAction: "export",
        notice: null,
      };
    case REQUEST_SET_LIBRARY_SYNC_ENABLED:
    case REQUEST_SYNC_LIBRARY_NOW:
      return {
        ...state,
        activeAction: "sync",
        notice: null,
      };
    case REQUEST_REMOVE_CARD:
    case REQUEST_DISMISS_EXTENSION_RELEASE_NOTICE:
      return {
        ...state,
        activeAction:
          action.type === REQUEST_REMOVE_CARD ? "remove" : state.activeAction,
        notice: null,
      };
    case HYDRATE_POPUP_FEED:
      return {
        ...state,
        feed: action.data || createEmptyPopupFeedSnapshot(),
        hydrationStatus: "ready",
        activeAction:
          state.activeAction === "remove" || state.activeAction === "cleanup"
            ? state.activeAction
            : null,
        notice: resolveSuccessNotice(action.source) || state.notice,
      };
    case SET_EXTENSION_RELEASE_NOTICE:
      return {
        ...state,
        extensionReleaseNotice: (action.notice as ExtensionReleaseNotice) || null,
      };
    case SET_LIBRARY_SYNC_STATUS:
      return {
        ...state,
        activeAction: state.activeAction === "sync" ? null : state.activeAction,
        librarySyncStatus:
          action.syncStatus || createEmptyLibrarySyncStatus(),
      };
    case SET_EXPORT_CONFIG:
      return {
        ...state,
        activeAction: null,
        notice: {
          tone: "success",
          message: "匯出完成，將自動下載。",
        },
        exportUrl: action.url || "",
        exportFilename: action.filename || "",
      };
    case SET_POPUP_NOTICE:
      return {
        ...state,
        hydrationStatus: "ready",
        activeAction:
          state.activeAction === "remove" || state.activeAction === "cleanup"
            ? state.activeAction
            : null,
        notice: action.message
          ? {
              tone: action.tone || "error",
              message: action.message,
            }
          : null,
      };
    case CLEAR_EXPORT_CONFIG:
      return {
        ...state,
        exportUrl: "",
        exportFilename: "",
      };
    case CLEAR_POPUP_NOTICE:
      return {
        ...state,
        notice: null,
      };
    default:
      return state;
  }
}

export function hydratePopupFeed(
  data: PopupFeedSnapshot,
  source: HydrationSource = "load",
) {
  return { type: HYDRATE_POPUP_FEED, data, source };
}

export function setExportConfig(url: string, filename: string) {
  return { type: SET_EXPORT_CONFIG, url, filename };
}

export function setPopupNotice(
  message: string,
  tone: Notice["tone"] = "error",
) {
  return { type: SET_POPUP_NOTICE, message, tone };
}

export function setExtensionReleaseNotice(
  notice: ExtensionReleaseNotice | null,
) {
  return { type: SET_EXTENSION_RELEASE_NOTICE, notice };
}

export function setLibrarySyncStatus(syncStatus: LibrarySyncStatus) {
  return { type: SET_LIBRARY_SYNC_STATUS, syncStatus };
}

export function clearExportConfig() {
  return { type: CLEAR_EXPORT_CONFIG };
}

export function clearPopupNotice() {
  return { type: CLEAR_POPUP_NOTICE };
}

export function finishLibraryRemoval() {
  return { type: FINISH_LIBRARY_REMOVAL };
}
