import { storageClear, storageGetAll, storageSet } from "./storage";

declare var chrome: any;

export const LIBRARY_SCHEMA_VERSION = 2;
export const HISTORY_LIMIT = 50;
export const SITE_KEYS = ["dm5", "sf", "comicbus"] as const;

export type SiteKey = (typeof SITE_KEYS)[number];
export type SeriesKey = string;

export type ChapterRecord = {
  title: string;
  href: string;
  chapter?: string;
};

export type SeriesRecord = {
  site: SiteKey;
  comicsID: string;
  title: string;
  cover: string;
  url: string;
  chapterList: string[];
  chapters: Record<string, ChapterRecord>;
  lastRead: string;
  read: string[];
};

export type LibraryUpdateRecord = {
  seriesKey: SeriesKey;
  chapterID: string;
  createdAt: number;
};

export type LibrarySnapshotV2 = {
  schemaVersion: 2;
  version: string;
  seriesByKey: Record<SeriesKey, SeriesRecord>;
  subscriptions: SeriesKey[];
  history: SeriesKey[];
  updates: LibraryUpdateRecord[];
};

type LegacyStore = {
  version?: string;
  history?: Array<{ site?: string; comicsID?: string }>;
  subscribe?: Array<{ site?: string; comicsID?: string }>;
  update?: Array<{ site?: string; comicsID?: string; chapterID?: string }>;
  dm5?: Record<string, any>;
  sf?: Record<string, any>;
  comicbus?: Record<string, any>;
  schemaVersion?: number;
  seriesByKey?: Record<string, SeriesRecord>;
  subscriptions?: string[];
  updates?: LibraryUpdateRecord[];
};

function getExtensionVersion() {
  try {
    return chrome?.runtime?.getManifest?.().version || "";
  } catch {
    return "";
  }
}

function getStorageSnapshot(): Promise<any> {
  return new Promise((resolve) => {
    storageGetAll((items) => resolve(items || {}));
  });
}

function writeStorageSnapshot(snapshot: LibrarySnapshotV2): Promise<void> {
  return new Promise((resolve) => {
    storageSet(snapshot, () => resolve());
  });
}

function clearStorageSnapshot(): Promise<void> {
  return new Promise((resolve) => {
    storageClear(() => resolve());
  });
}

function uniqueStrings(input: any, limit = Number.POSITIVE_INFINITY) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of Array.isArray(input) ? input : []) {
    const value = String(item || "");
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeChapterRecord(chapter: any): ChapterRecord {
  return {
    title: typeof chapter?.title === "string" ? chapter.title : "",
    href: typeof chapter?.href === "string" ? chapter.href : "",
    ...(typeof chapter?.chapter === "string" ? { chapter: chapter.chapter } : {}),
  };
}

function normalizeSeriesRecord(site: SiteKey, comicsID: string, record: any): SeriesRecord {
  const normalizedComicsID = canonicalizeComicsID(site, comicsID);
  const normalizedChapterList = Array.isArray(record?.chapterList)
    ? record.chapterList.map((item: any) => String(item || "")).filter(Boolean)
    : [];
  const normalizedChapters = Object.entries(record?.chapters || {}).reduce<
    Record<string, ChapterRecord>
  >((acc, [chapterID, chapter]) => {
    const normalizedChapterID = String(chapterID || "");
    if (!normalizedChapterID) return acc;
    acc[normalizedChapterID] = normalizeChapterRecord(chapter);
    return acc;
  }, {});

  return {
    site,
    comicsID: normalizedComicsID,
    title: typeof record?.title === "string" ? record.title : "",
    cover: typeof record?.cover === "string" ? record.cover : "",
    url: typeof record?.url === "string" ? record.url : "",
    chapterList: normalizedChapterList,
    chapters: normalizedChapters,
    lastRead: typeof record?.lastRead === "string" ? record.lastRead : "",
    read: uniqueStrings(record?.read),
  };
}

export function canonicalizeComicsID(site: string, comicsID: string) {
  const raw = String(comicsID || "");
  if (!raw) return "";
  if (site === "dm5") {
    return raw.startsWith("m") ? raw : `m${raw}`;
  }
  return raw;
}

export function buildSeriesKey(site: string, comicsID: string) {
  return `${site}:${canonicalizeComicsID(site, comicsID)}`;
}

export function parseSeriesKey(seriesKey: string) {
  const [site, ...rest] = String(seriesKey || "").split(":");
  return {
    site: site as SiteKey,
    comicsID: rest.join(":"),
  };
}

export function createEmptyLibrarySnapshot(
  version = getExtensionVersion(),
): LibrarySnapshotV2 {
  return {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    version,
    seriesByKey: {},
    subscriptions: [],
    history: [],
    updates: [],
  };
}

function migrateV2(raw: LegacyStore): LibrarySnapshotV2 {
  const next = createEmptyLibrarySnapshot(raw.version || getExtensionVersion());
  next.seriesByKey = Object.entries(raw.seriesByKey || {}).reduce<
    Record<string, SeriesRecord>
  >((acc, [seriesKey, record]) => {
    const { site, comicsID } = parseSeriesKey(seriesKey);
    if (!SITE_KEYS.includes(site)) return acc;
    const normalized = normalizeSeriesRecord(site, comicsID, record);
    acc[buildSeriesKey(site, normalized.comicsID)] = normalized;
    return acc;
  }, {});
  next.subscriptions = uniqueStrings(raw.subscriptions).filter(
    (seriesKey) => !!next.seriesByKey[seriesKey],
  );
  next.history = uniqueStrings(raw.history, HISTORY_LIMIT).filter(
    (seriesKey) => !!next.seriesByKey[seriesKey],
  );
  next.updates = (Array.isArray(raw.updates) ? raw.updates : [])
    .map((item) => ({
      seriesKey: String(item?.seriesKey || ""),
      chapterID: String(item?.chapterID || ""),
      createdAt:
        typeof item?.createdAt === "number" ? item.createdAt : Date.now(),
    }))
    .filter(
      (item) =>
        !!item.seriesKey &&
        !!item.chapterID &&
        !!next.seriesByKey[item.seriesKey],
    );
  return next;
}

function migrateLegacy(raw: LegacyStore): LibrarySnapshotV2 {
  const next = createEmptyLibrarySnapshot(raw.version || getExtensionVersion());
  const seriesByKey: Record<string, SeriesRecord> = {};

  for (const site of SITE_KEYS) {
    const bucket = raw[site] || {};
    for (const [comicsID, record] of Object.entries(bucket)) {
      const normalized = normalizeSeriesRecord(site, comicsID, record);
      const key = buildSeriesKey(site, normalized.comicsID);
      seriesByKey[key] = normalized;
    }
  }

  const history = uniqueStrings(
    (raw.history || []).map((item) =>
      buildSeriesKey(String(item?.site || ""), String(item?.comicsID || "")),
    ),
    HISTORY_LIMIT,
  ).filter((seriesKey) => !!seriesByKey[seriesKey]);

  const subscriptions = uniqueStrings(
    (raw.subscribe || []).map((item) =>
      buildSeriesKey(String(item?.site || ""), String(item?.comicsID || "")),
    ),
  ).filter((seriesKey) => !!seriesByKey[seriesKey]);

  const updates = (Array.isArray(raw.update) ? raw.update : [])
    .map((item, index) => ({
      seriesKey: buildSeriesKey(
        String(item?.site || ""),
        String(item?.comicsID || ""),
      ),
      chapterID: String(item?.chapterID || ""),
      createdAt: Date.now() - index,
    }))
    .filter(
      (item) =>
        !!item.seriesKey &&
        !!item.chapterID &&
        !!seriesByKey[item.seriesKey],
    );

  return {
    ...next,
    seriesByKey,
    history,
    subscriptions,
    updates,
  };
}

export function migrateLibrary(raw: LegacyStore | undefined | null) {
  if (raw?.schemaVersion === LIBRARY_SCHEMA_VERSION && raw.seriesByKey) {
    return migrateV2(raw);
  }
  return migrateLegacy(raw || {});
}

export async function loadLibrary() {
  const raw = await getStorageSnapshot();
  const migrated = migrateLibrary(raw);
  const needsWrite =
    raw?.schemaVersion !== LIBRARY_SCHEMA_VERSION ||
    !raw?.seriesByKey ||
    JSON.stringify(raw) !== JSON.stringify(migrated);
  if (needsWrite) {
    await writeStorageSnapshot(migrated);
  }
  return migrated;
}

export async function saveLibrary(snapshot: LibrarySnapshotV2) {
  const normalized = migrateV2(snapshot as LegacyStore);
  await writeStorageSnapshot(normalized);
  return normalized;
}

export async function resetLibrary() {
  const initial = createEmptyLibrarySnapshot();
  await clearStorageSnapshot();
  await saveLibrary(initial);
  return initial;
}

export async function updateLibrary(
  updater: (snapshot: LibrarySnapshotV2) => LibrarySnapshotV2,
) {
  const current = await loadLibrary();
  const next = updater(current);
  return saveLibrary(next);
}

export function subscribeToLibraryChanges(
  listener: (snapshot: LibrarySnapshotV2) => void,
) {
  const onChanged = chrome?.storage?.onChanged;
  if (!onChanged?.addListener || !onChanged?.removeListener) {
    return () => undefined;
  }
  const handleChange = async (_changes: any, areaName: string) => {
    if (areaName !== "local") return;
    listener(await loadLibrary());
  };
  onChanged.addListener(handleChange);
  return () => onChanged.removeListener(handleChange);
}

export function getSeries(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
) {
  return snapshot.seriesByKey[buildSeriesKey(site, comicsID)] || null;
}

export function isSubscribed(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
) {
  return snapshot.subscriptions.includes(buildSeriesKey(site, comicsID));
}

export function upsertSeries(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
  record: Partial<SeriesRecord>,
) {
  const key = buildSeriesKey(site, comicsID);
  const previous = snapshot.seriesByKey[key];
  const nextRecord = normalizeSeriesRecord(site as SiteKey, comicsID, {
    ...previous,
    ...record,
  });
  return {
    ...snapshot,
    seriesByKey: {
      ...snapshot.seriesByKey,
      [key]: nextRecord,
    },
  };
}

export function addHistoryEntry(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
) {
  const key = buildSeriesKey(site, comicsID);
  return {
    ...snapshot,
    history: uniqueStrings([key, ...snapshot.history], HISTORY_LIMIT),
  };
}

export function setSubscription(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
  subscribed: boolean,
) {
  const key = buildSeriesKey(site, comicsID);
  return {
    ...snapshot,
    subscriptions: subscribed
      ? uniqueStrings([key, ...snapshot.subscriptions])
      : snapshot.subscriptions.filter((item) => item !== key),
  };
}

export function dismissUpdate(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
  chapterID?: string,
) {
  const key = buildSeriesKey(site, comicsID);
  return {
    ...snapshot,
    updates: snapshot.updates.filter(
      (item) =>
        item.seriesKey !== key || (chapterID && item.chapterID !== chapterID),
    ),
  };
}

export function prependUpdate(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
  chapterID: string,
) {
  const key = buildSeriesKey(site, comicsID);
  const nextItem = {
    seriesKey: key,
    chapterID,
    createdAt: Date.now(),
  };
  return {
    ...snapshot,
    updates: [
      nextItem,
      ...snapshot.updates.filter(
        (item) => item.seriesKey !== key || item.chapterID !== chapterID,
      ),
    ],
  };
}

export function removeSeries(snapshot: LibrarySnapshotV2, site: string, comicsID: string) {
  const key = buildSeriesKey(site, comicsID);
  const nextSeriesByKey = { ...snapshot.seriesByKey };
  delete nextSeriesByKey[key];
  return {
    ...snapshot,
    seriesByKey: nextSeriesByKey,
    history: snapshot.history.filter((item) => item !== key),
    subscriptions: snapshot.subscriptions.filter((item) => item !== key),
    updates: snapshot.updates.filter((item) => item.seriesKey !== key),
  };
}

export function updateSeriesReadProgress(
  snapshot: LibrarySnapshotV2,
  site: string,
  comicsID: string,
  chapterID: string,
) {
  const current = getSeries(snapshot, site, comicsID);
  if (!current) return snapshot;
  return upsertSeries(snapshot, site, comicsID, {
    ...current,
    lastRead: chapterID,
    read: uniqueStrings([...(current.read || []), chapterID]),
  });
}
