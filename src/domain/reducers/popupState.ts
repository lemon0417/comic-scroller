import {
  REQUEST_DISMISS_EXTENSION_RELEASE_NOTICE,
  REQUEST_EXPORT_CONFIG,
  REQUEST_IMPORT_CONFIG,
  REQUEST_POPUP_DATA,
  REQUEST_REMOVE_CARD,
  REQUEST_RESET_CONFIG,
} from "@domain/actions/popup";
import type { ExtensionReleaseNotice } from "@infra/services/extensionRelease";
import type { PopupFeedSnapshot } from "@infra/services/library/models";
import { createEmptyPopupFeedSnapshot } from "@infra/services/library/models";

type HydrationSource = "load" | "import" | "reset";
type ActiveAction = "import" | "export" | "remove" | "reset" | null;

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
};

const HYDRATE_POPUP_FEED = "HYDRATE_POPUP_FEED";
const SET_EXPORT_CONFIG = "SET_EXPORT_CONFIG";
const SET_POPUP_NOTICE = "SET_POPUP_NOTICE";
const SET_EXTENSION_RELEASE_NOTICE = "SET_EXTENSION_RELEASE_NOTICE";
const CLEAR_EXPORT_CONFIG = "CLEAR_EXPORT_CONFIG";
const CLEAR_POPUP_NOTICE = "CLEAR_POPUP_NOTICE";

const initialState: PopupState = {
  feed: createEmptyPopupFeedSnapshot(),
  extensionReleaseNotice: null,
  hydrationStatus: "idle",
  activeAction: null,
  notice: null,
  exportUrl: "",
  exportFilename: "",
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
        activeAction: null,
        notice: resolveSuccessNotice(action.source) || state.notice,
      };
    case SET_EXTENSION_RELEASE_NOTICE:
      return {
        ...state,
        extensionReleaseNotice: (action.notice as ExtensionReleaseNotice) || null,
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
        activeAction: null,
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

export function clearExportConfig() {
  return { type: CLEAR_EXPORT_CONFIG };
}

export function clearPopupNotice() {
  return { type: CLEAR_POPUP_NOTICE };
}
