import type { ChapterRecord } from "@infra/services/library/schema";
import type { FetchMetaOptions } from "@sites/types";
import { getSiteAdapter } from "@sites/registry";
import {
  applyBackgroundSeriesRefresh,
  getSeriesSnapshot,
  getUpdateCount,
  listSubscriptionKeys,
  parseSeriesKey,
  resetLibrary,
  setLibraryVersion,
} from "@infra/services/library";

const dm5Regex = /https\:\/\/(tel||www)\.dm5\.com\/(m\d+)\//;
const sfRegex = /http\:\/\/comic\.sfacg\.com\/(HTML\/[^\/]+\/.+)$/;
const comicbusRegex =
  /http\:\/\/(www|v)\.comicbus.com\/online\/(comic-\d+\.html\?ch=.*$)/;
const UPDATE_NOTIFICATION_ID = "Comics Scroller Update";

type SiteMeta = {
  title?: string;
  chapterList?: string[];
  cover?: string;
  chapters?: Record<string, ChapterRecord>;
};

type SiteMetaStream = {
  subscribe: (
    next: (value: SiteMeta) => void,
    error?: (reason?: unknown) => void,
  ) => void;
};

type BackgroundServiceDeps = {
  applyBackgroundSeriesRefresh: typeof applyBackgroundSeriesRefresh;
  clearNotification: (id: string) => void;
  createNotification: (
    id: string,
    options: chrome.notifications.NotificationOptions,
  ) => void;
  getFetchChapterPage: (
    site: string,
  ) =>
    | ((
        url: string,
        comicsID?: string,
        options?: FetchMetaOptions,
      ) => SiteMetaStream)
    | undefined;
  getManifestVersion: () => string;
  getRuntimeUrl: (path: string) => string;
  getSeriesSnapshot: typeof getSeriesSnapshot;
  getUpdateCount: typeof getUpdateCount;
  listSubscriptionKeys: typeof listSubscriptionKeys;
  openTab: (options: { url: string }) => void;
  parseSeriesKey: typeof parseSeriesKey;
  resetLibrary: typeof resetLibrary;
  setBadge: (count: number) => void;
  setLibraryVersion: typeof setLibraryVersion;
};

export type BackgroundSummary = {
  checked: number;
  updated: number;
  errors: number;
  diff: {
    before: number;
    after: number;
    added: number;
  };
};

function getDefaultDeps(): BackgroundServiceDeps {
  return {
    applyBackgroundSeriesRefresh,
    clearNotification: (id) => chrome.notifications.clear(id),
    createNotification: (id, options) => chrome.notifications.create(id, options),
    getFetchChapterPage: (site) => getSiteAdapter(site)?.fetchMeta as
      | ((
          url: string,
          comicsID?: string,
          options?: FetchMetaOptions,
        ) => SiteMetaStream)
      | undefined,
    getManifestVersion: () => chrome.runtime.getManifest().version,
    getRuntimeUrl: (path) => chrome.runtime.getURL(path),
    getSeriesSnapshot,
    getUpdateCount,
    listSubscriptionKeys,
    openTab: (options) => chrome.tabs.create(options),
    parseSeriesKey,
    resetLibrary,
    setBadge: setExtensionBadge,
    setLibraryVersion,
  };
}

function fetchLatestSiteMeta(
  site: string,
  comicsID: string,
  url: string,
  options: FetchMetaOptions,
  getFetchChapterPage: BackgroundServiceDeps["getFetchChapterPage"],
) {
  const fetchChapterPage = getFetchChapterPage(site);
  if (!fetchChapterPage) {
    return Promise.reject(new Error(`No fetchMeta adapter for site ${site}.`));
  }

  const result$ =
    site === "comicbus"
      ? fetchChapterPage(url, comicsID, options)
      : fetchChapterPage(url, undefined, options);

  return new Promise<SiteMeta>((resolve, reject) => {
    result$.subscribe(
      (value) => resolve(value || {}),
      (error) => reject(error),
    );
  });
}

export function setExtensionBadge(count: number) {
  chrome.action.setBadgeText({ text: `${count > 0 ? count : ""}` });
}

export async function runBackgroundUpdateSummary(
  deps: BackgroundServiceDeps = getDefaultDeps(),
): Promise<BackgroundSummary> {
  const subscriptions = await deps.listSubscriptionKeys();
  const beforeCount = await deps.getUpdateCount();
  let checked = 0;
  let updated = 0;
  let errors = 0;
  let latestUpdateCount = beforeCount;

  for (const seriesKey of subscriptions) {
    const { site, comicsID } = deps.parseSeriesKey(seriesKey);
    const comic = await deps.getSeriesSnapshot(seriesKey);
    if (!site || !comicsID || !comic?.url) {
      continue;
    }
    checked += 1;

    try {
      const { title, chapterList, cover, chapters } = await fetchLatestSiteMeta(
        site,
        comicsID,
        comic.url,
        {
          includeCover: !comic.cover,
        },
        deps.getFetchChapterPage,
      );
      const nextChapterIDs = (chapterList || []).filter(
        (chapterID: string) => !comic.chapters?.[chapterID],
      );
      if (nextChapterIDs.length > 0) {
        const { updatesCount } = await deps.applyBackgroundSeriesRefresh(
          site,
          comicsID,
          {
            title,
            chapterList,
            cover,
            chapters,
            url: comic.url,
          },
          nextChapterIDs,
        );
        latestUpdateCount = updatesCount;
        updated += nextChapterIDs.length;
      }
    } catch {
      errors += 1;
    }
  }

  const afterCount = await deps.getUpdateCount();
  deps.setBadge(latestUpdateCount || afterCount);

  return {
    checked,
    updated,
    errors,
    diff: {
      before: beforeCount,
      after: afterCount,
      added: Math.max(0, afterCount - beforeCount),
    },
  };
}

export async function handleExtensionInstalled(
  details: { reason?: string },
  deps: BackgroundServiceDeps = getDefaultDeps(),
) {
  if (details.reason === "update") {
    const version = deps.getManifestVersion();
    await deps.setLibraryVersion(version);
    deps.createNotification(UPDATE_NOTIFICATION_ID, {
      type: "basic",
      iconUrl: deps.getRuntimeUrl("imgs/comics-128.png"),
      title: UPDATE_NOTIFICATION_ID,
      message: `Comics Scroller 版本 ${version} 更新`,
    });
    return;
  }

  if (details.reason === "install") {
    await deps.resetLibrary();
  }
}

export function handleNotificationClick(
  id: string,
  deps: Pick<BackgroundServiceDeps, "openTab" | "clearNotification"> = getDefaultDeps(),
) {
  if (id !== UPDATE_NOTIFICATION_ID) {
    deps.openTab({ url: id });
  }
  deps.clearNotification(id);
}

export function handlePingBackgroundMessage(
  message: { msg?: string } | null | undefined,
  sendResponse: (value: {
    ok: boolean;
    reason?: string;
    at?: number;
    summary?: BackgroundSummary;
  }) => void,
  options: {
    isDev: boolean;
    now?: () => number;
    runBackgroundUpdateSummary?: typeof runBackgroundUpdateSummary;
  },
) {
  if (!message || message.msg !== "PING_BACKGROUND") {
    return false;
  }

  if (!options.isDev) {
    sendResponse({ ok: false, reason: "disabled" });
    return false;
  }

  const now = options.now || (() => Date.now());
  const runSummary = options.runBackgroundUpdateSummary || runBackgroundUpdateSummary;
  runSummary().then((summary) => {
    sendResponse({ ok: true, at: now(), summary });
  });
  return true;
}

export function resolveReaderRedirect(url: string, getRuntimeUrl = (path: string) => chrome.runtime.getURL(path)) {
  if (comicbusRegex.test(url)) {
    const match = comicbusRegex.exec(url);
    if (!match) return "";
    return `${getRuntimeUrl("app.html")}?site=comicbus&chapter=${match[2]}`;
  }
  if (sfRegex.test(url)) {
    const match = sfRegex.exec(url);
    if (!match) return "";
    return `${getRuntimeUrl("app.html")}?site=sf&chapter=${match[1]}`;
  }
  if (dm5Regex.test(url)) {
    const match = dm5Regex.exec(url);
    if (!match) return "";
    return `${getRuntimeUrl("app.html")}?site=dm5&chapter=${match[2]}`;
  }
  return "";
}

export { UPDATE_NOTIFICATION_ID };
