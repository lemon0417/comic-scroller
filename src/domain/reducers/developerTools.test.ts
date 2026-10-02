import {
  requestBackgroundCheck,
  requestSetDevLogEnabled,
} from "@domain/actions/developerTools";
import { createEmptyPopupFeedSnapshot } from "@domain/library";

import developerTools, {
  finishBackgroundCheck,
  finishDevLogSetting,
  initialDeveloperToolsState,
} from "./developerTools";
import { hydratePopupFeed, setPopupNotice } from "./popupState";

describe("developer state", () => {
  it("keeps the scan running through feed refreshes, notices and repeated requests", () => {
    const pending = developerTools(
      initialDeveloperToolsState,
      requestBackgroundCheck(),
    );
    expect(pending.checkStatus).toBe("running");
    expect(
      developerTools(pending, hydratePopupFeed(createEmptyPopupFeedSnapshot())),
    ).toBe(pending);
    expect(developerTools(pending, setPopupNotice("更新通知"))).toBe(pending);
    expect(developerTools(pending, requestBackgroundCheck())).toBe(pending);
    const failed = developerTools(
      pending,
      finishBackgroundCheck(undefined, "error"),
    );
    expect(failed.checkStatus).toBe("error");
    expect(developerTools(failed, requestBackgroundCheck()).checkError).toBe(
      "",
    );
  });

  it("keeps the saved debug value after a failed toggle", () => {
    const enabled = developerTools(
      initialDeveloperToolsState,
      finishDevLogSetting(true),
    );
    const saving = developerTools(enabled, requestSetDevLogEnabled(false));
    const failed = developerTools(
      saving,
      finishDevLogSetting(undefined, "storage failed"),
    );
    expect(failed.debugLogEnabled).toBe(true);
    expect(failed.debugPending).toBe(false);
    expect(failed.debugError).toBe("storage failed");
  });
});
