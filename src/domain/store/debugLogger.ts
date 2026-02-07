import { createLogger } from "redux-logger";

const DEBUG_KEY = "CS_DEBUG";

function isDebugEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage?.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function getDebugLogger() {
  if (!isDebugEnabled()) return null;
  return createLogger({
    collapsed: true,
    duration: true,
  });
}
