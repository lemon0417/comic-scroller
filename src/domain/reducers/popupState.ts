import type { LibrarySnapshotV2 } from "@infra/services/library";
import { createEmptyLibrarySnapshot } from "@infra/services/library";
import {
  REQUEST_EXPORT_CONFIG,
  REQUEST_IMPORT_CONFIG,
  REQUEST_POPUP_DATA,
  REQUEST_RESET_CONFIG,
} from "@domain/actions/popup";

type HydrationSource = "load" | "import" | "reset";
type ActiveAction = "import" | "export" | "reset" | null;

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type State = {
  library: LibrarySnapshotV2;
  hydrationStatus: "idle" | "loading" | "ready";
  activeAction: ActiveAction;
  notice: Notice | null;
  exportUrl: string;
  exportFilename: string;
};

type Action = {
  type: string;
  data?: LibrarySnapshotV2;
  source?: HydrationSource;
  url?: string;
  filename?: string;
  tone?: "success" | "error" | "info";
  message?: string;
};

const HYDRATE_POPUP_LIBRARY = "HYDRATE_POPUP_LIBRARY";
const SET_EXPORT_CONFIG = "SET_EXPORT_CONFIG";
const CLEAR_EXPORT_CONFIG = "CLEAR_EXPORT_CONFIG";
const SET_POPUP_NOTICE = "SET_POPUP_NOTICE";
const CLEAR_POPUP_NOTICE = "CLEAR_POPUP_NOTICE";

const initialState: State = {
  library: createEmptyLibrarySnapshot(),
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
      message: "Config imported successfully.",
    };
  }
  if (source === "reset") {
    return {
      tone: "success" as const,
      message: "All extension data has been reset.",
    };
  }
  return null;
}

export default function popupState(state: State = initialState, action: Action) {
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
    case HYDRATE_POPUP_LIBRARY:
      return {
        ...state,
        library: action.data || createEmptyLibrarySnapshot(),
        hydrationStatus: "ready",
        activeAction: null,
        notice: resolveSuccessNotice(action.source) || state.notice,
      };
    case SET_EXPORT_CONFIG:
      return {
        ...state,
        activeAction: null,
        notice: {
          tone: "success",
          message: "Config export is ready. Download should start automatically.",
        },
        exportUrl: action.url || "",
        exportFilename: action.filename || "",
      };
    case CLEAR_EXPORT_CONFIG:
      return {
        ...state,
        exportUrl: "",
        exportFilename: "",
      };
    case SET_POPUP_NOTICE:
      return {
        ...state,
        notice: action.message
          ? {
              tone: action.tone || "info",
              message: action.message,
            }
          : null,
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

export function hydratePopupLibrary(
  data: LibrarySnapshotV2,
  source: HydrationSource = "load",
) {
  return { type: HYDRATE_POPUP_LIBRARY, data, source };
}

export function setExportConfig(url: string, filename: string) {
  return { type: SET_EXPORT_CONFIG, url, filename };
}

export function clearExportConfig() {
  return { type: CLEAR_EXPORT_CONFIG };
}

export function setPopupNotice(
  message: string,
  tone: "success" | "error" | "info" = "info",
) {
  return { type: SET_POPUP_NOTICE, message, tone };
}

export function clearPopupNotice() {
  return { type: CLEAR_POPUP_NOTICE };
}
