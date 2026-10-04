import type {
  BackgroundCheckResponse,
  BackgroundSummary,
} from "@domain/developerTools";
import type { BackgroundRefreshCandidate } from "@domain/library";
import { validateChapterGroups } from "@domain/library";
import {
  EXTENSION_RELEASE_CHECK_INTERVAL_MINUTES,
  reconcileStoredExtensionReleaseState,
  refreshStoredExtensionReleaseState,
} from "@infra/services/extensionRelease";
import {
  applyBackgroundSeriesRefresh,
  getUpdateCount,
  listBackgroundRefreshCandidates,
  markSubscriptionCheckedByKey,
  resetLibrary,
  setLibraryVersion,
  withBatchedLibrarySignals,
} from "@infra/services/library/background";
import {
  EIGHT_COMIC_READER_URL,
  parseEightComicChapterID,
} from "@sites/8comic/url";
import {
  BAOZIMH_BASE_URL,
  BAOZIMH_READER_URL,
  parseBaozimhChapterURL,
} from "@sites/baozimh/url";
import { MYCOMIC_BASE_URL, parseMyComicChapterURL } from "@sites/mycomic/url";
import { READER_REDIRECT_BYPASS_PARAM } from "@sites/native";
import { getSiteChapterFetcher } from "@sites/registry";
import type { SiteChapterFetcher, SiteChapterSnapshot } from "@sites/types";
import { firstValueFrom, timeout } from "rxjs";

const UPDATE_NOTIFICATION_ID = "Comics Scroller Update";
const BACKGROUND_UPDATE_BATCH_SIZE = 20;
const BACKGROUND_UPDATE_CONCURRENCY = 4;
const BACKGROUND_FETCH_TIMEOUT_MS = 15000;
const RELEASE_AVAILABLE_NOTIFICATION_TITLE = "Comics Scroller 有新版本";
export const LIBRARY_REFRESH_ALARM_NAME = "comcisScroller";
export const EXTENSION_RELEASE_ALARM_NAME = "comicScrollerReleaseCheck";

type BackgroundAlarmDeps = {
  createAlarm: (
    name: string,
    alarmInfo: { when: number; periodInMinutes: number },
  ) => Promise<void> | void;
  getAlarm: (name: string) => Promise<chrome.alarms.Alarm | undefined>;
};

type BackgroundServiceDeps = {
  applyBackgroundSeriesRefresh: typeof applyBackgroundSeriesRefresh;
  clearNotification: (id: string) => void;
  createNotification: (
    id: string,
    options: chrome.notifications.NotificationOptions,
  ) => void;
  getFetchChapters: (site: string) => SiteChapterFetcher | undefined;
  getManifestVersion: () => string;
  getRuntimeUrl: (path: string) => string;
  getUpdateCount: typeof getUpdateCount;
  listBackgroundRefreshCandidates: typeof listBackgroundRefreshCandidates;
  markSubscriptionCheckedByKey: typeof markSubscriptionCheckedByKey;
  openTab: (options: { url: string }) => void;
  reconcileExtensionReleaseState: typeof reconcileStoredExtensionReleaseState;
  refreshExtensionReleaseState: typeof refreshStoredExtensionReleaseState;
  resetLibrary: typeof resetLibrary;
  setBadge: (count: number) => void;
  setLibraryVersion: typeof setLibraryVersion;
  withBatchedLibrarySignals: typeof withBatchedLibrarySignals;
};

type BackgroundUpdateOptions = {
  batchSize?: number;
  concurrency?: number;
  timeoutMs?: number;
  now?: () => number;
};

type BackgroundReleaseSummary = {
  updateAvailable: boolean;
  latestVersion: string;
  notified: boolean;
};

let backgroundUpdateInFlight: Promise<BackgroundSummary> | null = null;

function getDefaultAlarmDeps(): BackgroundAlarmDeps {
  return {
    createAlarm: (name, alarmInfo) => chrome.alarms.create(name, alarmInfo),
    getAlarm: (name) => chrome.alarms.get(name),
  };
}

export async function ensureBackgroundAlarms(
  deps: BackgroundAlarmDeps = getDefaultAlarmDeps(),
  now: () => number = () => Date.now(),
) {
  const alarmConfigs = [
    {
      name: LIBRARY_REFRESH_ALARM_NAME,
      periodInMinutes: 10,
    },
    {
      name: EXTENSION_RELEASE_ALARM_NAME,
      periodInMinutes: EXTENSION_RELEASE_CHECK_INTERVAL_MINUTES,
    },
  ];

  await Promise.all(
    alarmConfigs.map(async ({ name, periodInMinutes }) => {
      const existingAlarm = await deps.getAlarm(name);
      if (existingAlarm) return;
      await deps.createAlarm(name, {
        when: now(),
        periodInMinutes,
      });
    }),
  );
}

function getDefaultDeps(): BackgroundServiceDeps {
  return {
    applyBackgroundSeriesRefresh,
    clearNotification: (id) => chrome.notifications.clear(id),
    createNotification: (id, options) =>
      chrome.notifications.create(id, options),
    getFetchChapters: getSiteChapterFetcher,
    getManifestVersion: () => chrome.runtime.getManifest().version,
    getRuntimeUrl: (path) => chrome.runtime.getURL(path),
    getUpdateCount,
    listBackgroundRefreshCandidates,
    markSubscriptionCheckedByKey,
    openTab: (options) => chrome.tabs.create(options),
    reconcileExtensionReleaseState: reconcileStoredExtensionReleaseState,
    refreshExtensionReleaseState: refreshStoredExtensionReleaseState,
    resetLibrary,
    setBadge: setExtensionBadge,
    setLibraryVersion,
    withBatchedLibrarySignals,
  };
}

function fetchLatestChapterSnapshot(
  site: string,
  url: string,
  getFetchChapters: BackgroundServiceDeps["getFetchChapters"],
  timeoutMs: number,
): Promise<SiteChapterSnapshot> {
  const fetchChapters = getFetchChapters(site);
  if (!fetchChapters) {
    return Promise.reject(new Error(`No chapter adapter for site ${site}.`));
  }

  return firstValueFrom(fetchChapters(url).pipe(timeout({ first: timeoutMs })));
}

function validateBackgroundChapterSnapshot(snapshot: SiteChapterSnapshot) {
  if (
    !Array.isArray(snapshot.chapterList) ||
    snapshot.chapterList.length === 0
  ) {
    throw new Error("Background metadata did not include any chapters.");
  }

  const seenChapterIDs = new Set<string>();
  for (const chapterID of snapshot.chapterList) {
    if (
      typeof chapterID !== "string" ||
      !chapterID.trim() ||
      chapterID !== chapterID.trim() ||
      seenChapterIDs.has(chapterID)
    ) {
      throw new Error("Background metadata included an invalid chapter ID.");
    }
    seenChapterIDs.add(chapterID);

    const chapter = snapshot.chapters?.[chapterID];
    if (!chapter || typeof chapter.href !== "string" || !chapter.href.trim()) {
      throw new Error(
        `Background metadata did not include a usable chapter for ${chapterID}.`,
      );
    }
  }

  if (snapshot.chapterGroups !== undefined) {
    validateChapterGroups(snapshot.chapterList, snapshot.chapterGroups);
  }
  return snapshot;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const poolSize = Math.max(
    1,
    Math.min(Math.floor(concurrency) || 1, items.length || 1),
  );
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
  candidate: BackgroundRefreshCandidate,
  deps: BackgroundServiceDeps,
  options: Required<BackgroundUpdateOptions>,
) {
  let shouldCountChecked = false;
  const { seriesKey, site, comicsID, url, latestChapterID } = candidate;

  try {
    if (!site || !comicsID || !url) {
      return { checked: 0, updated: 0, errors: 0 };
    }

    shouldCountChecked = true;

    const snapshot = validateBackgroundChapterSnapshot(
      await fetchLatestChapterSnapshot(
        site,
        url,
        deps.getFetchChapters,
        options.timeoutMs,
      ),
    );
    const { chapterList, chapterGroups } = snapshot;
    const newChapterIDs = new Set<string>();
    if (chapterGroups) {
      for (const group of chapterGroups) {
        const checkpoints = candidate.latestChapterIDsByGroup;
        const checkpoint =
          checkpoints && Object.hasOwn(checkpoints, group.id)
            ? checkpoints[group.id]
            : "";
        const index = checkpoint ? group.chapterList.indexOf(checkpoint) : -1;
        if (index > 0) {
          group.chapterList
            .slice(0, index)
            .forEach((id) => newChapterIDs.add(id));
        }
      }
    } else {
      const checkpointIndex = latestChapterID
        ? chapterList.indexOf(latestChapterID)
        : -1;
      if (checkpointIndex > 0) {
        chapterList
          .slice(0, checkpointIndex)
          .forEach((id) => newChapterIDs.add(id));
      }
    }
    const nextChapterIDs = chapterList.filter((id) => newChapterIDs.has(id));

    await deps.applyBackgroundSeriesRefresh(
      site,
      comicsID,
      snapshot,
      nextChapterIDs,
    );

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

function setExtensionBadge(count: number) {
  chrome.action.setBadgeText({ text: `${count > 0 ? count : ""}` });
}

async function executeBackgroundUpdateSummary(
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

  const [candidates, beforeCount] = await Promise.all([
    deps.listBackgroundRefreshCandidates(normalizedOptions.batchSize),
    deps.getUpdateCount(),
  ]);
  const results = await deps.withBatchedLibrarySignals(() =>
    runWithConcurrency(candidates, normalizedOptions.concurrency, (candidate) =>
      checkSubscribedSeries(candidate, deps, normalizedOptions),
    ),
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

export function runBackgroundUpdateSummary(
  deps: BackgroundServiceDeps = getDefaultDeps(),
  options: BackgroundUpdateOptions = {},
): Promise<BackgroundSummary> {
  if (backgroundUpdateInFlight) {
    return backgroundUpdateInFlight;
  }

  const trackedPromise = executeBackgroundUpdateSummary(deps, options).finally(
    () => {
      if (backgroundUpdateInFlight === trackedPromise) {
        backgroundUpdateInFlight = null;
      }
    },
  );
  backgroundUpdateInFlight = trackedPromise;
  return trackedPromise;
}

export async function handleExtensionInstalled(
  details: { reason?: string },
  deps: BackgroundServiceDeps = getDefaultDeps(),
) {
  if (details.reason === "update") {
    const version = deps.getManifestVersion();
    await deps.setLibraryVersion(version);
    await deps.reconcileExtensionReleaseState(version);
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

export async function runBackgroundReleaseCheck(
  deps: BackgroundServiceDeps = getDefaultDeps(),
  options: Pick<BackgroundUpdateOptions, "now"> = {},
): Promise<BackgroundReleaseSummary> {
  try {
    const result = await deps.refreshExtensionReleaseState({
      currentVersion: deps.getManifestVersion(),
      ...(options.now ? { now: options.now } : {}),
    });

    if (result.shouldNotify && result.notice) {
      deps.createNotification(result.notice.releaseUrl, {
        type: "basic",
        iconUrl: deps.getRuntimeUrl("imgs/comics-128.png"),
        title: RELEASE_AVAILABLE_NOTIFICATION_TITLE,
        message: `已發布 ${result.notice.latestVersion} 版，請手動更新。`,
      });
    }

    return {
      updateAvailable: Boolean(result.notice),
      latestVersion: result.latest?.version || "",
      notified: result.shouldNotify,
    };
  } catch {
    return {
      updateAvailable: false,
      latestVersion: "",
      notified: false,
    };
  }
}

export function handleNotificationClick(
  id: string,
  deps: Pick<
    BackgroundServiceDeps,
    "openTab" | "clearNotification"
  > = getDefaultDeps(),
) {
  if (id !== UPDATE_NOTIFICATION_ID) {
    deps.openTab({ url: id });
  }
  deps.clearNotification(id);
}

export function handlePingBackgroundMessage(
  message: { msg?: string } | null | undefined,
  sendResponse: (value: BackgroundCheckResponse) => void,
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
  const runSummary =
    options.runBackgroundUpdateSummary || runBackgroundUpdateSummary;
  runSummary()
    .then((summary) => {
      sendResponse({ ok: true, at: now(), summary });
    })
    .catch(() => {
      sendResponse({ ok: false, reason: "update-check-failed" });
    });
  return true;
}

export function resolveReaderRedirect(
  url: string,
  getRuntimeUrl = (path: string) => chrome.runtime.getURL(path),
) {
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.searchParams.get(READER_REDIRECT_BYPASS_PARAM) === "1") {
      return "";
    }
  } catch {
    return "";
  }
  if (!parsedUrl) {
    return "";
  }

  if (parsedUrl.origin === MYCOMIC_BASE_URL) {
    try {
      const chapter = parseMyComicChapterURL(parsedUrl.href);
      const params = new URLSearchParams({ site: "mycomic", chapter });
      return `${getRuntimeUrl("app.html")}?${params.toString()}`;
    } catch {
      return "";
    }
  }

  if (
    parsedUrl.origin === EIGHT_COMIC_READER_URL &&
    /^\/online\/new-[1-9]\d*\.html$/.test(parsedUrl.pathname)
  ) {
    if (parsedUrl.searchParams.getAll("ch").length !== 1) return "";
    try {
      const { chapterID } = parseEightComicChapterID(
        `${parsedUrl.pathname.slice(1)}?ch=${parsedUrl.searchParams.get("ch")}`,
      );
      const params = new URLSearchParams({
        site: "8comic",
        chapter: chapterID,
      });
      return `${getRuntimeUrl("app.html")}?${params.toString()}`;
    } catch {
      return "";
    }
  }

  if ([BAOZIMH_BASE_URL, BAOZIMH_READER_URL].includes(parsedUrl.origin)) {
    try {
      const { chapterID } = parseBaozimhChapterURL(parsedUrl.href);
      const params = new URLSearchParams({
        site: "baozimh",
        chapter: chapterID,
      });
      return `${getRuntimeUrl("app.html")}?${params.toString()}`;
    } catch {
      return "";
    }
  }

  const isDm5Host =
    parsedUrl.hostname === "www.dm5.com" ||
    parsedUrl.hostname === "tel.dm5.com";
  const dm5PathMatch = /^\/(m\d+)\/?$/.exec(parsedUrl.pathname);
  if (isDm5Host && dm5PathMatch) {
    return `${getRuntimeUrl("app.html")}?site=dm5&chapter=${dm5PathMatch[1]}`;
  }
  if (
    parsedUrl.origin === "https://www.manhuagui.com" &&
    /^\/comic\/\d+\/\d+\.html$/.test(parsedUrl.pathname)
  ) {
    const params = new URLSearchParams({
      site: "manhuagui",
      chapter: parsedUrl.pathname.slice(1),
    });
    return `${getRuntimeUrl("app.html")}?${params.toString()}`;
  }
  return "";
}
