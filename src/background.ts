import type { BackgroundCheckResponse } from "@domain/developerTools";
import {
  ensureBackgroundAlarms,
  EXTENSION_RELEASE_ALARM_NAME,
  handleExtensionInstalled,
  handleNotificationClick,
  handlePingBackgroundMessage,
  LIBRARY_REFRESH_ALARM_NAME,
  resolveReaderRedirect,
  runBackgroundReleaseCheck,
  runBackgroundUpdateSummary,
} from "@infra/services/background";
import { IS_DEVELOPMENT_BUILD } from "@utils/buildMode";
import { devLog } from "@utils/devLog";

function runBackgroundTask(scope: string, task: () => Promise<unknown>) {
  void task().catch((error: unknown) => {
    devLog(scope, error);
  });
}

chrome.action.setBadgeBackgroundColor({ color: "#F00" });

chrome.notifications.onClicked.addListener((id: string) => {
  handleNotificationClick(id);
});

chrome.runtime.onInstalled.addListener((details: { reason?: string }) => {
  void handleExtensionInstalled(details).catch((error: unknown) => {
    devLog("background:install-failed", error);
  });
});

if (IS_DEVELOPMENT_BUILD)
  chrome.runtime.onMessage.addListener(
    (
      message: { msg?: string },
      _sender: unknown,
      sendResponse: (value: BackgroundCheckResponse) => void,
    ) =>
      handlePingBackgroundMessage(message, sendResponse, {
        isDev: IS_DEVELOPMENT_BUILD,
      }),
  );

chrome.webNavigation.onBeforeNavigate.addListener(
  (details: { tabId: number; url: string }) => {
    const redirectUrl = resolveReaderRedirect(details.url);
    if (!redirectUrl) return;
    chrome.tabs.update(details.tabId, { url: redirectUrl });
  },
  {
    url: [
      {
        urlMatches:
          "^https://mycomic\\.com/(?:cn/)?chapters/[1-9][0-9]*/?(?:\\?.*)?(?:#.*)?$",
      },
      {
        urlMatches:
          "^https://www\\.(baozimh\\.com|twmanga\\.com)/comic/chapter/[a-z0-9_-]+/[0-9]+_[0-9]+(?:_[0-9]+)?\\.html(?:\\?.*)?(?:#.*)?$",
      },
      {
        urlMatches:
          "^https://www\\.(baozimh\\.com|twmanga\\.com)/user/page_direct\\?",
      },
      {
        urlMatches:
          "^https://www\\.manhuagui\\.com/comic/\\d+/\\d+\\.html(?:\\?.*)?(?:#.*)?$",
      },
      {
        urlMatches:
          "^https://articles\\.onemoreplace\\.tw/online/new-[1-9][0-9]*\\.html\\?",
      },
      {
        urlMatches: "^https://www\\.dm5\\.com/m\\d+/?(?:\\?.*)?$",
      },
      {
        urlMatches: "^https://tel\\.dm5\\.com/m\\d+/?(?:\\?.*)?$",
      },
    ],
  },
);

runBackgroundTask("background:ensure-alarms-failed", () =>
  ensureBackgroundAlarms(),
);

chrome.alarms.onAlarm.addListener((alarm: { name?: string }) => {
  if (alarm.name === LIBRARY_REFRESH_ALARM_NAME) {
    runBackgroundTask("background:update-summary-failed", () =>
      runBackgroundUpdateSummary(),
    );
    return;
  }

  if (alarm.name === EXTENSION_RELEASE_ALARM_NAME) {
    runBackgroundTask("background:release-check-failed", () =>
      runBackgroundReleaseCheck(),
    );
  }
});
