import type {
  BackgroundCheckResult,
  BackgroundSummary,
} from "@domain/developerTools";
import { IS_DEVELOPMENT_BUILD } from "@utils/buildMode";

export const BACKGROUND_CHECK_TIMEOUT_MS = 120000;

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSummary(value: unknown): value is BackgroundSummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<BackgroundSummary>;
  return (
    isCount(summary.checked) &&
    isCount(summary.updated) &&
    isCount(summary.errors) &&
    Boolean(summary.diff) &&
    isCount(summary.diff?.before) &&
    isCount(summary.diff?.after) &&
    isCount(summary.diff?.added)
  );
}

export async function runDeveloperBackgroundCheck(): Promise<BackgroundCheckResult> {
  if (!IS_DEVELOPMENT_BUILD) throw new Error("目前版本未啟用開發者功能。");

  let timer: ReturnType<typeof setTimeout> | undefined;
  const transport = Promise.resolve()
    .then(() => chrome.runtime.sendMessage({ msg: "PING_BACKGROUND" }))
    .catch(() => {
      throw new Error("無法連線至背景程序，請重新載入擴充功能後重試。");
    });
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error("等待結果逾時，背景檢查可能仍在執行，請稍後重試。")),
      BACKGROUND_CHECK_TIMEOUT_MS,
    );
  });
  const response: unknown = await Promise.race([transport, deadline]).finally(
    () => clearTimeout(timer),
  );
  if (!response || typeof response !== "object") {
    throw new Error("背景程序未回傳有效結果，請重新載入擴充功能後重試。");
  }
  const value = response as {
    ok?: unknown;
    reason?: unknown;
    at?: unknown;
    summary?: unknown;
  };
  if (value.ok === false) {
    throw new Error(
      value.reason === "disabled"
        ? "目前版本未啟用開發者功能。"
        : "背景檢查失敗，請稍後重試。",
    );
  }
  if (value.ok !== true || !isCount(value.at) || !isSummary(value.summary)) {
    throw new Error("背景程序未回傳有效結果，請重新載入擴充功能後重試。");
  }
  return { at: value.at, summary: value.summary };
}
