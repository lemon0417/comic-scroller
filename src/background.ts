import {
  handleExtensionInstalled,
  handleNotificationClick,
  handlePingBackgroundMessage,
  resolveReaderRedirect,
  runBackgroundUpdateSummary,
} from "@infra/services/background";

const isDev = import.meta.env.MODE !== "production";

chrome.action.setBadgeBackgroundColor({ color: "#F00" });

chrome.notifications.onClicked.addListener((id: string) => {
  handleNotificationClick(id);
});

chrome.runtime.onInstalled.addListener(async (details: { reason?: string }) => {
  await handleExtensionInstalled(details);
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
      { urlMatches: "https://(tel||www).dm5.com/md*" },
    ],
  },
);

chrome.alarms.create("comcisScroller", {
  when: Date.now(),
  periodInMinutes: 10,
});

chrome.alarms.onAlarm.addListener((alarm: { name?: string }) => {
  if (alarm.name === "comcisScroller") {
    void runBackgroundUpdateSummary();
  }
});
