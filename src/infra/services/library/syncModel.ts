import type { LibraryUpdateRecord, SeriesKey, SiteKey } from "@domain/library";
import {
  buildSeriesKey,
  parseSeriesKey,
  SITE_KEYS,
  uniqueStrings,
} from "@domain/library";

import { HISTORY_LIMIT } from "./schema";

export type LibrarySyncChapterSummary = {
  title: string;
  href: string;
};

export type LibrarySyncSeriesStateV1 = {
  site: SiteKey;
  comicsID: string;
  title: string;
  cover: string;
  url: string;
  latestChapterID: string;
  lastReadChapterID: string;
  readChapterIDs: string[];
  chapterSummaries: Record<string, LibrarySyncChapterSummary>;
};

export type LibrarySyncStateV1 = {
  seriesByKey: Record<SeriesKey, LibrarySyncSeriesStateV1>;
  subscriptions: SeriesKey[];
  history: SeriesKey[];
  updates: LibraryUpdateRecord[];
};

export type LibrarySyncWireChapterV1 = {
  chapterID: string;
  title: string;
  href: string;
};

export type LibrarySyncWireSeriesV1 = {
  site: SiteKey;
  comicsID: string;
  title: string;
  cover: string;
  url: string;
  lastRead: string;
  chapters: LibrarySyncWireChapterV1[];
  read?: string[];
};

export type LibrarySyncWireRowsV1 = {
  series: LibrarySyncWireSeriesV1[];
  subscriptions: Array<{ seriesKey: string }>;
  history: string[];
  updates: LibraryUpdateRecord[];
};

type LibrarySyncChapterRowV2 = [chapterID: string, title: string, href: string];
type LibrarySyncSeriesRowV2 = [
  siteCode: number,
  comicsID: string,
  title: string,
  cover: string,
  url: string,
  latestRef: number,
  lastReadRef: number,
  chapters: LibrarySyncChapterRowV2[],
];
export type LibrarySyncWireRowsV2 = [
  series: LibrarySyncSeriesRowV2[],
  subscriptions: number[],
  history: number[],
  updates: Array<[seriesRef: number, chapterRef: number]>,
];

// Wire codes must remain stable even if the domain's site registry is reordered.
const SYNC_V2_SITES: readonly (SiteKey | null)[] = [
  "dm5",
  null, // Code 1 belonged to the retired provider and must never be reused.
  "comicbus",
  "manhuagui",
];

type MergePreference = "local" | "remote";

function toRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function normalizeChapterSummaries(input: unknown) {
  return Object.fromEntries(
    Object.entries(toRecord(input))
      .filter(([chapterID]) => Boolean(chapterID))
      .map(([chapterID, summary]) => {
        const source = toRecord(summary);
        return [
          chapterID,
          {
            title: typeof source.title === "string" ? source.title : "",
            href: typeof source.href === "string" ? source.href : "",
          },
        ];
      }),
  );
}

function normalizeSeriesState(
  input: Partial<LibrarySyncSeriesStateV1>,
): LibrarySyncSeriesStateV1 {
  const site = input.site as SiteKey;
  const comicsID = parseSeriesKey(
    buildSeriesKey(site, String(input.comicsID || "")),
  ).comicsID;
  const lastReadChapterID = String(input.lastReadChapterID || "");
  return {
    site,
    comicsID,
    title: String(input.title || ""),
    cover: String(input.cover || ""),
    url: String(input.url || ""),
    latestChapterID: String(input.latestChapterID || ""),
    lastReadChapterID,
    readChapterIDs: uniqueStrings([
      ...uniqueStrings(input.readChapterIDs),
      lastReadChapterID,
    ]),
    chapterSummaries: normalizeChapterSummaries(input.chapterSummaries),
  };
}

export function createEmptyLibrarySyncState(): LibrarySyncStateV1 {
  return {
    seriesByKey: {},
    subscriptions: [],
    history: [],
    updates: [],
  };
}

// Full read history stays in IndexedDB. Only referenced series and chapter
// checkpoints belong in the bounded cross-device projection.
export function compactLibrarySyncState(
  state: LibrarySyncStateV1,
): LibrarySyncStateV1 {
  const subscriptions = uniqueStrings(state.subscriptions);
  const history = uniqueStrings(state.history)
    .filter(
      (key) =>
        Object.hasOwn(state.seriesByKey, key) &&
        SITE_KEYS.includes(state.seriesByKey[key].site),
    )
    .slice(0, HISTORY_LIMIT);
  const updates = mergeUpdates(state.updates, []);
  const seriesKeys = uniqueStrings([
    ...subscriptions,
    ...history,
    ...updates.map((update) => update.seriesKey),
  ]).filter(
    (key) =>
      Object.hasOwn(state.seriesByKey, key) &&
      SITE_KEYS.includes(state.seriesByKey[key].site),
  );
  const knownSeriesKeys = new Set(seriesKeys);
  const updatesBySeriesKey = new Map<string, string[]>();
  for (const update of updates) {
    const chapterIDs = updatesBySeriesKey.get(update.seriesKey) || [];
    chapterIDs.push(update.chapterID);
    updatesBySeriesKey.set(update.seriesKey, chapterIDs);
  }

  return {
    seriesByKey: Object.fromEntries(
      seriesKeys.map((key) => {
        const series = state.seriesByKey[key];
        const chapterIDs = uniqueStrings([
          series.latestChapterID,
          series.lastReadChapterID,
          ...(updatesBySeriesKey.get(key) || []),
        ]);
        return [
          key,
          {
            ...series,
            readChapterIDs: uniqueStrings([series.lastReadChapterID]),
            chapterSummaries: Object.fromEntries(
              chapterIDs.map((chapterID) => [
                chapterID,
                Object.hasOwn(series.chapterSummaries, chapterID)
                  ? series.chapterSummaries[chapterID]
                  : { title: "", href: "" },
              ]),
            ),
          },
        ];
      }),
    ),
    subscriptions: subscriptions.filter((key) => knownSeriesKeys.has(key)),
    history: history.filter((key) => knownSeriesKeys.has(key)),
    updates: updates.filter((update) => knownSeriesKeys.has(update.seriesKey)),
  };
}

function mergeUpdates(
  primary: LibraryUpdateRecord[],
  secondary: LibraryUpdateRecord[],
) {
  const seen = new Set<string>();
  const result: LibraryUpdateRecord[] = [];
  for (const item of [...primary, ...secondary]) {
    const seriesKey = String(item?.seriesKey || "");
    const chapterID = String(item?.chapterID || "");
    const key = `${seriesKey}:${chapterID}`;
    if (!seriesKey || !chapterID || seen.has(key)) continue;
    seen.add(key);
    result.push({ seriesKey, chapterID });
  }
  return result;
}

function mergeChapterSummaries(
  primary: Record<string, LibrarySyncChapterSummary>,
  secondary: Record<string, LibrarySyncChapterSummary>,
) {
  return Object.fromEntries(
    uniqueStrings([...Object.keys(secondary), ...Object.keys(primary)]).map(
      (chapterID) => {
        const first = Object.hasOwn(primary, chapterID)
          ? primary[chapterID]
          : undefined;
        const second = Object.hasOwn(secondary, chapterID)
          ? secondary[chapterID]
          : undefined;
        return [
          chapterID,
          {
            title: first?.title || second?.title || "",
            href: first?.href || second?.href || "",
          },
        ];
      },
    ),
  );
}

function mergeSeriesState(
  local: LibrarySyncSeriesStateV1 | undefined,
  remote: LibrarySyncSeriesStateV1 | undefined,
  preference: MergePreference,
) {
  const fallback = local || remote;
  if (!fallback) return null;

  const empty = normalizeSeriesState({
    site: fallback.site,
    comicsID: fallback.comicsID,
  });
  const localState = local ? normalizeSeriesState(local) : empty;
  const remoteState = remote ? normalizeSeriesState(remote) : empty;
  const primary = preference === "remote" ? remoteState : localState;
  const secondary = preference === "remote" ? localState : remoteState;
  const lastReadChapterID =
    primary.lastReadChapterID || secondary.lastReadChapterID;

  return normalizeSeriesState({
    site: primary.site || secondary.site,
    comicsID: primary.comicsID || secondary.comicsID,
    title: primary.title || secondary.title,
    cover: primary.cover || secondary.cover,
    url: primary.url || secondary.url,
    latestChapterID: primary.latestChapterID || secondary.latestChapterID,
    lastReadChapterID,
    readChapterIDs: uniqueStrings([
      ...secondary.readChapterIDs,
      ...primary.readChapterIDs,
      lastReadChapterID,
    ]),
    chapterSummaries: mergeChapterSummaries(
      primary.chapterSummaries,
      secondary.chapterSummaries,
    ),
  });
}

export function mergeLibrarySyncStates(
  local: LibrarySyncStateV1,
  remote: LibrarySyncStateV1,
  preference: MergePreference = "local",
): LibrarySyncStateV1 {
  const result = createEmptyLibrarySyncState();
  const primary = preference === "remote" ? remote : local;
  const secondary = preference === "remote" ? local : remote;
  const seriesKeys = uniqueStrings([
    ...Object.keys(primary.seriesByKey || {}),
    ...Object.keys(secondary.seriesByKey || {}),
  ]);

  for (const seriesKey of seriesKeys) {
    const merged = mergeSeriesState(
      local.seriesByKey[seriesKey],
      remote.seriesByKey[seriesKey],
      preference,
    );
    if (merged) result.seriesByKey[seriesKey] = merged;
  }

  result.subscriptions = uniqueStrings([
    ...(primary.subscriptions || []),
    ...(secondary.subscriptions || []),
  ]).filter((seriesKey) => Boolean(result.seriesByKey[seriesKey]));
  result.history = uniqueStrings(
    [...(primary.history || []), ...(secondary.history || [])],
    HISTORY_LIMIT,
  ).filter((seriesKey) => Boolean(result.seriesByKey[seriesKey]));
  result.updates = mergeUpdates(
    primary.updates || [],
    secondary.updates || [],
  ).filter((item) => Boolean(result.seriesByKey[item.seriesKey]));

  return result;
}

export function syncWireRowsToState(input: unknown): LibrarySyncStateV1 {
  const source = toRecord(input);
  const result = createEmptyLibrarySyncState();
  const wireSeries = Array.isArray(source.series) ? source.series : [];

  for (const item of wireSeries) {
    const series = toRecord(item);
    const site = String(series.site || "") as SiteKey;
    const comicsID = String(series.comicsID || "");
    if (!SITE_KEYS.includes(site) || !comicsID) continue;

    const chapters = (Array.isArray(series.chapters) ? series.chapters : [])
      .map((chapter) => {
        const row = toRecord(chapter);
        return {
          chapterID: String(row.chapterID || ""),
          title: String(row.title || ""),
          href: String(row.href || ""),
        };
      })
      .filter((chapter) => Boolean(chapter.chapterID));
    const lastReadChapterID = String(series.lastRead || "");
    const seriesKey = buildSeriesKey(site, comicsID);
    result.seriesByKey[seriesKey] = normalizeSeriesState({
      site,
      comicsID,
      title: String(series.title || ""),
      cover: String(series.cover || ""),
      url: String(series.url || ""),
      latestChapterID: chapters[0]?.chapterID || "",
      lastReadChapterID,
      readChapterIDs: uniqueStrings([
        ...uniqueStrings(series.read),
        lastReadChapterID,
      ]),
      chapterSummaries: Object.fromEntries(
        chapters.map((chapter) => [
          chapter.chapterID,
          {
            title: chapter.title,
            href: chapter.href,
          },
        ]),
      ),
    });
  }

  const knownSeriesKeys = new Set(Object.keys(result.seriesByKey));
  const subscriptions = Array.isArray(source.subscriptions)
    ? source.subscriptions
    : [];
  result.subscriptions = uniqueStrings(
    subscriptions.map((item) => String(toRecord(item).seriesKey || "")),
  ).filter((seriesKey) => knownSeriesKeys.has(seriesKey));
  result.history = uniqueStrings(source.history)
    .filter((seriesKey) => knownSeriesKeys.has(seriesKey))
    .slice(0, HISTORY_LIMIT);
  result.updates = (Array.isArray(source.updates) ? source.updates : [])
    .map((item) => {
      const update = toRecord(item);
      return {
        seriesKey: String(update.seriesKey || ""),
        chapterID: String(update.chapterID || ""),
      };
    })
    .filter(
      (item) => Boolean(item.chapterID) && knownSeriesKeys.has(item.seriesKey),
    );

  return result;
}

export function syncStateToWireRows(
  state: LibrarySyncStateV1,
): LibrarySyncWireRowsV1 {
  const updatesBySeriesKey = (state.updates || []).reduce<
    Record<string, string[]>
  >((acc, update) => {
    if (!update.seriesKey || !update.chapterID) return acc;
    acc[update.seriesKey] = uniqueStrings([
      ...(acc[update.seriesKey] || []),
      update.chapterID,
    ]);
    return acc;
  }, {});

  const knownSeriesKeys = new Set(Object.keys(state.seriesByKey || {}));
  return {
    series: Object.entries(state.seriesByKey || {}).map(
      ([seriesKey, rawSeries]) => {
        const series = normalizeSeriesState(rawSeries);
        const chapterIDs = uniqueStrings([
          series.latestChapterID,
          series.lastReadChapterID,
          ...series.readChapterIDs,
          ...(updatesBySeriesKey[seriesKey] || []),
        ]);
        return {
          site: series.site,
          comicsID: series.comicsID,
          title: series.title,
          cover: series.cover,
          url: series.url,
          lastRead: series.lastReadChapterID,
          chapters: chapterIDs.map((chapterID) => ({
            chapterID,
            title: series.chapterSummaries[chapterID]?.title || "",
            href: series.chapterSummaries[chapterID]?.href || "",
          })),
          ...(series.readChapterIDs.length > 0
            ? { read: series.readChapterIDs }
            : {}),
        };
      },
    ),
    subscriptions: uniqueStrings(state.subscriptions)
      .filter((seriesKey) => knownSeriesKeys.has(seriesKey))
      .map((seriesKey) => ({ seriesKey })),
    history: uniqueStrings(state.history, HISTORY_LIMIT).filter((seriesKey) =>
      knownSeriesKeys.has(seriesKey),
    ),
    updates: mergeUpdates(state.updates || [], []).filter((item) =>
      knownSeriesKeys.has(item.seriesKey),
    ),
  };
}

export function syncStateToIndexedRows(
  state: LibrarySyncStateV1,
): LibrarySyncWireRowsV2 {
  const compact = compactLibrarySyncState(state);
  const entries = Object.entries(compact.seriesByKey);
  const seriesRefs = new Map(entries.map(([key], index) => [key, index + 1]));
  const chapterRefs = new Map<string, Map<string, number>>();
  const seriesRows = entries.map(([key, series]): LibrarySyncSeriesRowV2 => {
    const chapters = Object.entries(series.chapterSummaries);
    const refs = new Map(
      chapters.map(([chapterID], index) => [chapterID, index + 1]),
    );
    chapterRefs.set(key, refs);
    const siteCode = SYNC_V2_SITES.indexOf(series.site);
    if (siteCode < 0) throw new Error("同步作品的站點不受支援。");
    return [
      siteCode,
      series.comicsID,
      series.title,
      series.cover,
      series.url,
      refs.get(series.latestChapterID) || 0,
      refs.get(series.lastReadChapterID) || 0,
      chapters.map(([chapterID, summary]) => [
        chapterID,
        summary.title,
        summary.href,
      ]),
    ];
  });
  return [
    seriesRows,
    compact.subscriptions.map((key) => seriesRefs.get(key)!),
    compact.history.map((key) => seriesRefs.get(key)!),
    compact.updates.map((update) => [
      seriesRefs.get(update.seriesKey)!,
      chapterRefs.get(update.seriesKey)!.get(update.chapterID)!,
    ]),
  ];
}

function requireTuple(value: unknown, length: number): unknown[] {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error("同步 v2 資料列格式不正確。");
  }
  return value;
}

function requireString(value: unknown, nonempty = false): string {
  if (typeof value !== "string" || (nonempty && !value)) {
    throw new Error("同步 v2 字串欄位不正確。");
  }
  return value;
}

function requireRef(
  value: unknown,
  length: number,
  allowMissing = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < (allowMissing ? 0 : 1) ||
    value > length
  ) {
    throw new Error("同步 v2 索引超出範圍。");
  }
  return value;
}

export function syncIndexedRowsToState(input: unknown): LibrarySyncStateV1 {
  const root = requireTuple(input, 4);
  if (!root.every(Array.isArray)) throw new Error("同步 v2 清單格式不正確。");
  const [seriesRows, subscriptions, history, updates] = root as unknown[][];
  const result = createEmptyLibrarySyncState();
  const keys: Array<string | null> = [];
  const chapterIDsBySeries: string[][] = [];
  const knownKeys = new Set<string>();

  for (const row of seriesRows) {
    const fields = requireTuple(row, 8);
    const siteCode = fields[0];
    if (
      typeof siteCode !== "number" ||
      !Number.isInteger(siteCode) ||
      siteCode < 0 ||
      siteCode >= SYNC_V2_SITES.length
    ) {
      throw new Error("同步 v2 站點代碼不正確。");
    }
    const site = SYNC_V2_SITES[siteCode];
    const comicsID = requireString(fields[1], true);
    const key = site ? buildSeriesKey(site, comicsID) : null;
    const identity = key || `${siteCode}:${comicsID}`;
    if (knownKeys.has(identity)) throw new Error("同步 v2 作品索引重複。");
    knownKeys.add(identity);
    if (!Array.isArray(fields[7])) throw new Error("同步 v2 章節清單不正確。");
    const chapterIDs: string[] = [];
    const summaries = new Map<string, LibrarySyncChapterSummary>();
    for (const chapter of fields[7]) {
      const columns = requireTuple(chapter, 3);
      const chapterID = requireString(columns[0], true);
      if (summaries.has(chapterID)) throw new Error("同步 v2 章節索引重複。");
      chapterIDs.push(chapterID);
      summaries.set(chapterID, {
        title: requireString(columns[1]),
        href: requireString(columns[2]),
      });
    }
    const latestRef = requireRef(fields[5], chapterIDs.length, true);
    const lastReadRef = requireRef(fields[6], chapterIDs.length, true);
    const lastReadChapterID = lastReadRef ? chapterIDs[lastReadRef - 1] : "";
    const title = requireString(fields[2]);
    const cover = requireString(fields[3]);
    const url = requireString(fields[4]);
    if (site && key) {
      result.seriesByKey[key] = {
        site,
        comicsID: parseSeriesKey(key).comicsID,
        title,
        cover,
        url,
        latestChapterID: latestRef ? chapterIDs[latestRef - 1] : "",
        lastReadChapterID,
        readChapterIDs: uniqueStrings([lastReadChapterID]),
        chapterSummaries: Object.fromEntries(summaries),
      };
    }
    keys.push(key);
    chapterIDsBySeries.push(chapterIDs);
  }

  result.subscriptions = subscriptions
    .map((ref) => keys[requireRef(ref, keys.length) - 1])
    .filter((key): key is string => key !== null);
  result.history = history
    .map((ref) => keys[requireRef(ref, keys.length) - 1])
    .filter((key): key is string => key !== null);
  result.updates = updates.flatMap((row) => {
    const [seriesRef, chapterRef] = requireTuple(row, 2);
    const index = requireRef(seriesRef, keys.length) - 1;
    const chapterID =
      chapterIDsBySeries[index][
        requireRef(chapterRef, chapterIDsBySeries[index].length) - 1
      ];
    const seriesKey = keys[index];
    return seriesKey === null ? [] : [{ seriesKey, chapterID }];
  });
  return compactLibrarySyncState(result);
}
