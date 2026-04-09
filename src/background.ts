import {
  handleExtensionInstalled,
  handleNotificationClick,
  handlePingBackgroundMessage,
  resolveReaderRedirect,
  runBackgroundReleaseCheck,
  runBackgroundUpdateSummary,
} from "@infra/services/background";
import { EXTENSION_RELEASE_CHECK_INTERVAL_MINUTES } from "@infra/services/extensionRelease";

const isDev = import.meta.env.MODE !== "production";
const LIBRARY_REFRESH_ALARM_NAME = "comcisScroller";
const EXTENSION_RELEASE_ALARM_NAME = "comicScrollerReleaseCheck";

function ensureBackgroundAlarms() {
  chrome.alarms.create(LIBRARY_REFRESH_ALARM_NAME, {
    when: Date.now(),
    periodInMinutes: 10,
  });
  chrome.alarms.create(EXTENSION_RELEASE_ALARM_NAME, {
    when: Date.now(),
    periodInMinutes: EXTENSION_RELEASE_CHECK_INTERVAL_MINUTES,
  });
}

chrome.action.setBadgeBackgroundColor({ color: "#F00" });

chrome.notifications.onClicked.addListener((id: string) => {
  handleNotificationClick(id);
});

chrome.runtime.onInstalled.addListener(async (details: { reason?: string }) => {
  await handleExtensionInstalled(details);
  ensureBackgroundAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  ensureBackgroundAlarms();
});

chrome.runtime.onMessage.addListener(
  (
    message: { msg?: string },
    _sender: unknown,
    sendResponse: (value: { ok: boolean; reason?: string; at?: number; summary?: unknown }) => void,
  ) =>
    handlePingBackgroundMessage(message, sendResponse, { isDev }),
);

chrome.webNavigation.onBeforeNavigate.addListener(
  (details: { tabId: number; url: string }) => {
    const redirectUrl = resolveReaderRedirect(details.url);
    if (!redirectUrl) return;
    chrome.tabs.update(details.tabId, { url: redirectUrl });
  },
  {
    url: [
      { urlMatches: "comicbus.com/online/.*$" },
      { urlMatches: "comic.sfacg.com/HTML/[^/]+/.+$" },
      {
        urlMatches: "^https://www\\.dm5\\.com/m\\d+/?(?:\\?.*)?$",
      },
      {
        urlMatches: "^https://tel\\.dm5\\.com/m\\d+/?(?:\\?.*)?$",
      },
    ],
  },
);

ensureBackgroundAlarms();

chrome.alarms.onAlarm.addListener((alarm: { name?: string }) => {
  if (alarm.name === LIBRARY_REFRESH_ALARM_NAME) {
    void runBackgroundUpdateSummary();
    return;
  }

  if (alarm.name === EXTENSION_RELEASE_ALARM_NAME) {
    void runBackgroundReleaseCheck();
  }
});
