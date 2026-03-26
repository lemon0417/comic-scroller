import { getSiteAdapter } from "@sites/registry";
import {
  getSeries,
  loadLibrary,
  parseSeriesKey,
  prependUpdate,
  resetLibrary,
  saveLibrary,
  upsertSeries,
} from "@infra/services/library";

const dm5Regex = /https\:\/\/(tel||www)\.dm5\.com\/(m\d+)\//;
const sfRegex = /http\:\/\/comic\.sfacg\.com\/(HTML\/[^\/]+\/.+)$/;
const comicbusRegex =
  /http\:\/\/(www|v)\.comicbus.com\/online\/(comic-\d+\.html\?ch=.*$)/;
const isDev = import.meta.env.MODE !== "production";

declare var chrome: any;

const getFetchChapterPage = (site: string) => getSiteAdapter(site)?.fetchMeta;

function setBadge(count: number) {
  chrome.action.setBadgeText({ text: `${count > 0 ? count : ""}` });
}

function computeUpdateDiff(before: any, after: any) {
  const beforeSet = new Set(
    (before?.updates || []).map((item: any) => `${item.seriesKey}:${item.chapterID}`),
  );
  const afterSet = new Set(
    (after?.updates || []).map((item: any) => `${item.seriesKey}:${item.chapterID}`),
  );
  let added = 0;
  afterSet.forEach((key) => {
    if (!beforeSet.has(key)) added += 1;
  });
  return {
    before: before?.updates?.length || 0,
    after: after?.updates?.length || 0,
    added,
  };
}

async function comicsQuerySummary() {
  const before = await loadLibrary();
  let checked = 0;
  let updated = 0;
  let errors = 0;
  let nextLibrary = before;

  for (const seriesKey of before.subscriptions) {
    const { site, comicsID } = parseSeriesKey(seriesKey);
    const comic = getSeries(nextLibrary, site, comicsID);
    if (!site || !comicsID || !comic?.url) {
      continue;
    }
    checked += 1;
    try {
      const fetchChapterPage = getFetchChapterPage(site);
      if (!fetchChapterPage) {
        errors += 1;
        continue;
      }
      const result$ =
        site === "comicbus"
          ? fetchChapterPage(comic.url, comicsID)
          : fetchChapterPage(comic.url);
      await new Promise<void>((resolve) => {
        result$.subscribe(
          ({ title, chapterList, cover, chapters }: any) => {
            const latest = getSeries(nextLibrary, site, comicsID) || comic;
            for (const chapterID of chapterList || []) {
              if (!latest.chapters?.[chapterID]) {
                nextLibrary = upsertSeries(nextLibrary, site, comicsID, {
                  title,
                  chapterList,
                  cover,
                  chapters,
                  url: comic.url,
                });
                nextLibrary = prependUpdate(nextLibrary, site, comicsID, chapterID);
                updated += 1;
              }
            }
            resolve();
          },
          () => {
            errors += 1;
            resolve();
          },
        );
      });
    } catch {
      errors += 1;
    }
  }

  const after = await saveLibrary(nextLibrary);
  setBadge(after.updates.length);
  return {
    checked,
    updated,
    errors,
    diff: computeUpdateDiff(before, after),
  };
}

chrome.action.setBadgeBackgroundColor({ color: "#F00" });

chrome.notifications.onClicked.addListener((id: any) => {
  if (id !== "Comics Scroller Update") {
    chrome.tabs.create({ url: id });
  }
  chrome.notifications.clear(id);
});

chrome.runtime.onInstalled.addListener(async (details: any) => {
  if (details.reason === "update") {
    const library = await loadLibrary();
    await saveLibrary({
      ...library,
      version: chrome.runtime.getManifest().version,
    });
    chrome.notifications.create("Comics Scroller Update", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("imgs/comics-128.png"),
      title: "Comics Scroller Update",
      message: `Comics Scroller 版本 ${chrome.runtime.getManifest().version} 更新`,
    });
  } else if (details.reason === "install") {
    await resetLibrary();
  }
});

chrome.runtime.onMessage.addListener(
  (message: any, _sender: any, sendResponse: any) => {
    if (message && message.msg === "PING_BACKGROUND") {
      if (!isDev) {
        sendResponse({ ok: false, reason: "disabled" });
        return false;
      }
      comicsQuerySummary().then((summary) => {
        sendResponse({ ok: true, at: Date.now(), summary });
      });
      return true;
    }
    return false;
  },
);

chrome.webNavigation.onBeforeNavigate.addListener(
  (details: any) => {
    if (comicbusRegex.test(details.url)) {
      const match = comicbusRegex.exec(details.url);
      if (!match) return;
      const chapter = match[2];
      chrome.tabs.update(details.tabId, {
        url: `${chrome.runtime.getURL("app.html")}?site=comicbus&chapter=${chapter}`,
      });
    } else if (sfRegex.test(details.url)) {
      const match = sfRegex.exec(details.url);
      if (!match) return;
      const chapter = match[1];
      chrome.tabs.update(details.tabId, {
        url: `${chrome.runtime.getURL("app.html")}?site=sf&chapter=${chapter}`,
      });
    } else if (dm5Regex.test(details.url)) {
      const match = dm5Regex.exec(details.url);
      if (!match) return;
      const chapter = match[2];
      chrome.tabs.update(details.tabId, {
        url: `${chrome.runtime.getURL("app.html")}?site=dm5&chapter=${chapter}`,
      });
    }
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

chrome.alarms.onAlarm.addListener((alarm: any) => {
  if (alarm.name === "comcisScroller") {
    void comicsQuerySummary();
  }
});
