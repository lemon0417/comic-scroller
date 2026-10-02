export const REQUEST_INITIALIZE_DEVELOPER_TOOLS =
  "REQUEST_INITIALIZE_DEVELOPER_TOOLS";
export const REQUEST_SET_DEV_LOG_ENABLED = "REQUEST_SET_DEV_LOG_ENABLED";
export const REQUEST_BACKGROUND_CHECK = "REQUEST_BACKGROUND_CHECK";

export function requestInitializeDeveloperTools() {
  return { type: REQUEST_INITIALIZE_DEVELOPER_TOOLS };
}

export function requestSetDevLogEnabled(enabled: boolean) {
  return { type: REQUEST_SET_DEV_LOG_ENABLED, enabled };
}

export function requestBackgroundCheck() {
  return { type: REQUEST_BACKGROUND_CHECK };
}
