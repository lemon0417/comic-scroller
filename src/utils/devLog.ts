const DEBUG_KEY = "CS_DEBUG";

function getDebugStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isDevLogEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  return getDebugStorage()?.getItem(DEBUG_KEY) === "1";
}

export function setDevLogEnabled(enabled: boolean) {
  if (process.env.NODE_ENV === "production") return false;
  const storage = getDebugStorage();
  if (!storage) return false;
  if (enabled) {
    storage.setItem(DEBUG_KEY, "1");
  } else {
    storage.removeItem(DEBUG_KEY);
  }
  return true;
}

export function devLog(scope: string, payload?: unknown) {
  if (!isDevLogEnabled()) return;
  console.info(`[CS_DEBUG] ${scope}`, payload ?? "");
}
