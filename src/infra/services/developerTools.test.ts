import * as buildMode from "@utils/buildMode";

import {
  BACKGROUND_CHECK_TIMEOUT_MS,
  runDeveloperBackgroundCheck,
} from "./developerTools";

jest.mock("@utils/buildMode", () => ({
  __esModule: true,
  IS_DEVELOPMENT_BUILD: true,
}));

const summary = {
  checked: 3,
  updated: 1,
  errors: 1,
  diff: { before: 2, after: 4, added: 2 },
};

describe("developer background messaging", () => {
  let sendMessage: jest.Mock;
  beforeEach(() => {
    jest.useFakeTimers();
    sendMessage = jest.fn().mockResolvedValue({ ok: true, at: 123, summary });
    (global as any).chrome = { runtime: { sendMessage } };
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("returns a validated result using the existing background message", async () => {
    await expect(runDeveloperBackgroundCheck()).resolves.toEqual({
      at: 123,
      summary,
    });
    expect(sendMessage).toHaveBeenCalledWith({ msg: "PING_BACKGROUND" });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("accepts empty scans", async () => {
    sendMessage.mockResolvedValue({
      ok: true,
      at: 0,
      summary: {
        checked: 0,
        updated: 0,
        errors: 0,
        diff: { before: 0, after: 0, added: 0 },
      },
    });
    await expect(runDeveloperBackgroundCheck()).resolves.toHaveProperty(
      "summary.checked",
      0,
    );
  });

  it.each([
    undefined,
    { ok: true, at: 123 },
    { ok: true, at: -1, summary },
    { ok: true, at: 123, summary: { ...summary, checked: -1 } },
    { ok: true, at: 123, summary: { ...summary, diff: { added: "2" } } },
  ])("rejects invalid responses (%j)", async (response) => {
    sendMessage.mockResolvedValue(response);
    await expect(runDeveloperBackgroundCheck()).rejects.toThrow("有效結果");
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(["disabled", "update-check-failed"])(
    "handles background refusal: %s",
    async (reason) => {
      sendMessage.mockResolvedValue({ ok: false, reason });
      await expect(runDeveloperBackgroundCheck()).rejects.toThrow(
        reason === "disabled" ? "未啟用" : "檢查失敗",
      );
    },
  );

  it("handles connection errors and clears the deadline", async () => {
    sendMessage.mockRejectedValue(new Error("port closed"));
    await expect(runDeveloperBackgroundCheck()).rejects.toThrow("無法連線");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("times out without claiming that the background work stopped", async () => {
    sendMessage.mockReturnValue(new Promise(() => {}));
    const request = runDeveloperBackgroundCheck();
    const rejected = expect(request).rejects.toThrow("背景檢查可能仍在執行");
    await jest.advanceTimersByTimeAsync(BACKGROUND_CHECK_TIMEOUT_MS);
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("does not send messages outside development builds", async () => {
    jest.replaceProperty(buildMode, "IS_DEVELOPMENT_BUILD", false);
    await expect(runDeveloperBackgroundCheck()).rejects.toThrow("未啟用");
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
