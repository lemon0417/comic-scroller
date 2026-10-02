import {
  REQUEST_BACKGROUND_CHECK,
  REQUEST_INITIALIZE_DEVELOPER_TOOLS,
  REQUEST_SET_DEV_LOG_ENABLED,
} from "@domain/actions/developerTools";
import type { BackgroundCheckResult } from "@domain/developerTools";

export type DeveloperToolsState = {
  debugLogEnabled: boolean;
  debugReady: boolean;
  debugPending: boolean;
  debugError: string;
  checkStatus: "idle" | "running" | "success" | "error";
  checkResult: BackgroundCheckResult | null;
  checkError: string;
};

export const initialDeveloperToolsState: DeveloperToolsState = {
  debugLogEnabled: false,
  debugReady: false,
  debugPending: false,
  debugError: "",
  checkStatus: "idle",
  checkResult: null,
  checkError: "",
};

const FINISH_DEV_LOG_SETTING = "FINISH_DEV_LOG_SETTING";
const FINISH_BACKGROUND_CHECK = "FINISH_BACKGROUND_CHECK";

type Action = {
  type: string;
  enabled?: boolean;
  result?: BackgroundCheckResult;
  error?: string;
};

export default function developerTools(
  state = initialDeveloperToolsState,
  action: Action,
): DeveloperToolsState {
  switch (action.type) {
    case REQUEST_INITIALIZE_DEVELOPER_TOOLS:
    case REQUEST_SET_DEV_LOG_ENABLED:
      return { ...state, debugPending: true, debugError: "" };
    case FINISH_DEV_LOG_SETTING:
      return {
        ...state,
        debugLogEnabled: action.enabled ?? state.debugLogEnabled,
        debugReady: true,
        debugPending: false,
        debugError: action.error || "",
      };
    case REQUEST_BACKGROUND_CHECK:
      return state.checkStatus === "running"
        ? state
        : {
            ...state,
            checkStatus: "running",
            checkResult: null,
            checkError: "",
          };
    case FINISH_BACKGROUND_CHECK:
      return {
        ...state,
        checkStatus: action.error ? "error" : "success",
        checkResult: action.result || null,
        checkError: action.error || "",
      };
    default:
      return state;
  }
}

export function finishDevLogSetting(enabled?: boolean, error = "") {
  return { type: FINISH_DEV_LOG_SETTING, enabled, error };
}

export function finishBackgroundCheck(
  result?: BackgroundCheckResult,
  error = "",
) {
  return { type: FINISH_BACKGROUND_CHECK, result, error };
}
