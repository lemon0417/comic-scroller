import { createLogger } from "redux-logger";
import { isDevLogEnabled } from "@utils/devLog";

export function getDebugLogger() {
  if (process.env.NODE_ENV === "production") return null;
  return createLogger({
    collapsed: true,
    duration: true,
    predicate: () => isDevLogEnabled(),
  });
}
