import {
  applyBackgroundSeriesRefresh,
  getSeriesSnapshot,
  getUpdateCount,
  listSubscriptionKeys,
  markSubscriptionCheckedByKey,
  parseSeriesKey,
  resetLibrary,
  setLibraryVersion,
} from "@infra/services/library/background";
import { getSiteAdapter } from "@sites/registry";
import type { FetchMetaOptions, SiteMeta, SiteMetaFetcher } from "@sites/types";
import { firstValueFrom, timeout } from "rxjs";

const dm5Regex = /https\:\/\/(tel||www)\.dm5\.com\/(m\d+)\//;
const sfRegex = /http\:\/\/comic\.sfacg\.com\/(HTML\/[^\/]+\/.+)$/;
const comicbusRegex =
  /http\:\/\/(www|v)\.comicbus.com\/online\/(comic-\d+\.html\?ch=.*$)/;
const READER_REDIRECT_BYPASS_PARAM = "cs_open_native";
const UPDATE_NOTIFICATION_ID = "Comics Scroller Update";
const BACKGROUND_UPDATE_BATCH_SIZE = 20;
const BACKGROUND_UPDATE_CONCURRENCY = 4;
const BACKGROUND_FETCH_TIMEOUT_MS = 15000;

type BackgroundServiceDeps = {
  applyBackgroundSeriesRefresh: typeof applyBackgroundSeriesRefresh;
  clearNotification: (id: string) => void;
  createNotification: (
    id: string,
    options: chrome.notifications.NotificationOptions,
  ) => void;
  getFetchChapterPage: (site: string) => SiteMetaFetcher | undefined;
  getManifestVersion: () => string;
  getRuntimeUrl: (path: string) => string;
  getSeriesSnapshot: typeof getSeriesSnapshot;
  getUpdateCount: typeof getUpdateCount;
  listSubscriptionKeys: typeof listSubscriptionKeys;
  markSubscriptionCheckedByKey: typeof markSubscriptionCheckedByKey;
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

type BackgroundUpdateOptions = {
  batchSize?: number;
  concurrency?: number;
  timeoutMs?: number;
  now?: () => number;
};

function getDefaultDeps(): BackgroundServiceDeps {
  return {
    applyBackgroundSeriesRefresh,
    clearNotification: (id) => chrome.notifications.clear(id),
    createNotification: (id, options) => chrome.notifications.create(id, options),
    getFetchChapterPage: (site) => getSiteAdapter(site)?.fetchMeta,
    getManifestVersion: () => chrome.runtime.getManifest().version,
    getRuntimeUrl: (path) => chrome.runtime.getURL(path),
    getSeriesSnapshot,
    getUpdateCount,
    listSubscriptionKeys,
    markSubscriptionCheckedByKey,
    openTab: (options) => chrome.tabs.create(options),
    parseSeriesKey,
    resetLibrary,
    setBadge: setExtensionBadge,
    setLibraryVersion,
  };
}

function fetchLatestSiteMeta(
  site: string,
  url: string,
  options: FetchMetaOptions,
  getFetchChapterPage: BackgroundServiceDeps["getFetchChapterPage"],
  timeoutMs: number,
): Promise<SiteMeta> {
  const fetchChapterPage = getFetchChapterPage(site);
  if (!fetchChapterPage) {
    return Promise.reject(new Error(`No fetchMeta adapter for site ${site}.`));
  }

  return firstValueFrom(
    fetchChapterPage(url, options).pipe(timeout({ first: timeoutMs })),
  );
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const poolSize = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length || 1));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: poolSize }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    }),
  );

  return results;
}

async function checkSubscribedSeries(
  seriesKey: string,
  deps: BackgroundServiceDeps,
  options: Required<BackgroundUpdateOptions>,
) {
  let shouldCountChecked = false;

  try {
    const { site, comicsID } = deps.parseSeriesKey(seriesKey);
    const comic = await deps.getSeriesSnapshot(seriesKey);

    if (!site || !comicsID || !comic?.url) {
      return { checked: 0, updated: 0, errors: 0 };
    }

    shouldCountChecked = true;

    const { title, chapterList, cover, chapters } = await fetchLatestSiteMeta(
      site,
      comic.url,
      {
        includeCover: !comic.cover,
      },
      deps.getFetchChapterPage,
      options.timeoutMs,
    );
    const nextChapterIDs = (chapterList || []).filter(
      (chapterID: string) => !comic.chapters?.[chapterID],
    );

    if (nextChapterIDs.length > 0) {
      await deps.applyBackgroundSeriesRefresh(
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
    }

    return {
      checked: 1,
      updated: nextChapterIDs.length,
      errors: 0,
    };
  } catch {
    return { checked: shouldCountChecked ? 1 : 0, updated: 0, errors: 1 };
  } finally {
    try {
      await deps.markSubscriptionCheckedByKey(seriesKey, options.now());
    } catch {
      // Scheduling metadata must not break the whole background refresh batch.
    }
  }
}

export function setExtensionBadge(count: number) {
  chrome.action.setBadgeText({ text: `${count > 0 ? count : ""}` });
}

export async function runBackgroundUpdateSummary(
  deps: BackgroundServiceDeps = getDefaultDeps(),
  options: BackgroundUpdateOptions = {},
): Promise<BackgroundSummary> {
  const normalizedOptions = {
    batchSize: Math.max(
      1,
      Math.floor(options.batchSize || BACKGROUND_UPDATE_BATCH_SIZE),
    ),
    concurrency: Math.max(
      1,
      Math.floor(options.concurrency || BACKGROUND_UPDATE_CONCURRENCY),
    ),
    timeoutMs: Math.max(
      1,
      Math.floor(options.timeoutMs || BACKGROUND_FETCH_TIMEOUT_MS),
    ),
    now: options.now || (() => Date.now()),
  };

  const subscriptions = await deps.listSubscriptionKeys(normalizedOptions.batchSize);
  const beforeCount = await deps.getUpdateCount();
  const results = await runWithConcurrency(
    subscriptions,
    normalizedOptions.concurrency,
    (seriesKey) => checkSubscribedSeries(seriesKey, deps, normalizedOptions),
  );

  const checked = results.reduce((sum, result) => sum + result.checked, 0);
  const updated = results.reduce((sum, result) => sum + result.updated, 0);
  const errors = results.reduce((sum, result) => sum + result.errors, 0);

  const afterCount = await deps.getUpdateCount();
  deps.setBadge(afterCount);

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
  try {
    if (new URL(url).searchParams.get(READER_REDIRECT_BYPASS_PARAM) === "1") {
      return "";
    }
  } catch {
    return "";
  }

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
