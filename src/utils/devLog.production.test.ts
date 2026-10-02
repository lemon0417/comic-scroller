import { getDebugLogger } from "@domain/store/debugLogger.production";

import { devLog, isDevLogEnabled, setDevLogEnabled } from "./devLog.production";

it("keeps production logging inert even if old debug settings exist", () => {
  localStorage.setItem("CS_DEBUG", "1");
  const read = jest.spyOn(Storage.prototype, "getItem");
  const write = jest.spyOn(Storage.prototype, "setItem");
  const log = jest.spyOn(console, "info");
  expect(isDevLogEnabled()).toBe(false);
  expect(setDevLogEnabled(true)).toBe(false);
  expect(getDebugLogger()).toBeNull();
  devLog("test", {});
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(log).not.toHaveBeenCalled();
  jest.restoreAllMocks();
  localStorage.removeItem("CS_DEBUG");
});
