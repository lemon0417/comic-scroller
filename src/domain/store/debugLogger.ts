import { IS_DEVELOPMENT_BUILD } from "@utils/buildMode";
import { isDevLogEnabled } from "@utils/devLog";
import { createLogger } from "redux-logger";

export function getDebugLogger() {
  if (!IS_DEVELOPMENT_BUILD) return null;
  return createLogger({
    collapsed: true,
    duration: true,
    predicate: () => isDevLogEnabled(),
  });
}
