import filter from "lodash/filter";
import map from "lodash/map";

const SITE_ORDER = ["dm5", "sf", "comicbus"];

const SITE_LABELS: Record<string, string> = {
  dm5: "DM5",
  sf: "SF",
  comicbus: "ComicBus",
};

function resolveComicsKeyForBucket(bucket: any, rawKey: string) {
  if (!bucket) return null;
  if (rawKey && bucket[rawKey]) return rawKey;
  const withPrefix = rawKey ? `m${rawKey}` : "";
  if (withPrefix && bucket[withPrefix]) return withPrefix;
  if (rawKey.startsWith("m")) {
    const stripped = rawKey.slice(1);
    if (stripped && bucket[stripped]) return stripped;
  }
  return null;
}

function resolveItem(state: any, item: any) {
  if (!item) return null;
  const rawKey = String(item.comicsID ?? "");
  if (!rawKey) return null;

  const site = item.site as string;
  if (site) {
    const bucket = state.popup[site];
    const resolvedKey = resolveComicsKeyForBucket(bucket, rawKey);
    return resolvedKey
      ? {
          ...item,
          site,
          comicsID: resolvedKey,
        }
      : null;
  }

  for (const candidateSite of SITE_ORDER) {
    const bucket = state.popup[candidateSite];
    const resolvedKey = resolveComicsKeyForBucket(bucket, rawKey);
    if (resolvedKey) {
      return {
        ...item,
        site: candidateSite,
        comicsID: resolvedKey,
      };
    }
  }

  return null;
}

function buildViewEntry(
  state: any,
  category: string,
  item: any,
  index: number,
) {
  const resolved = resolveItem(state, item);
  if (!resolved) return null;

  const bucket = state.popup[resolved.site] || {};
  const record = bucket[resolved.comicsID] || {};
  const chapters = record.chapters || {};
  const chapterList = record.chapterList || [];
  const lastReadChapterID = record.lastRead || "";
  const lastChapterID = chapterList[0] || "";
  const updateChapterID = resolved.chapterID || "";
  const lastRead = lastReadChapterID ? chapters[lastReadChapterID] || {} : {};
  const lastChapter = lastChapterID ? chapters[lastChapterID] || {} : {};
  const updateChapter = resolved.updateChapter || {};
  const title = record.title || "Untitled Series";
  const url = record.url || "";
  const continueChapterID = lastReadChapterID || updateChapterID || lastChapterID;
  const continueHref =
    lastRead.href || updateChapter.href || lastChapter.href || url || "";

  return {
    category,
    key: `${category}_${resolved.site}_${resolved.comicsID}_${resolved.chapterID || index}`,
    index,
    site: resolved.site,
    siteLabel:
      SITE_LABELS[resolved.site] || String(resolved.site || "").toUpperCase(),
    comicsID: resolved.comicsID,
    chapterID: resolved.chapterID,
    lastReadChapterID,
    lastChapterID,
    updateChapterID,
    continueChapterID,
    title,
    url,
    cover: record.cover || "",
    lastReadTitle: lastRead.title || "Not started",
    lastReadHref: lastRead.href || "",
    lastChapterTitle: lastChapter.title || "No chapters yet",
    lastChapterHref: lastChapter.href || "",
    updateChapterTitle: updateChapter.title || "",
    updateChapterHref: updateChapter.href || "",
    continueHref,
    shift: Boolean(resolved.shift),
    move: Boolean(resolved.move),
  };
}

function normalizeList(
  state: any,
  category: "update" | "subscribe" | "history",
) {
  return filter(
    map(state.popup[category] || [], (item, index) =>
      buildViewEntry(state, category, item, index),
    ),
    Boolean,
  );
}

export function selectPopupView(state: any) {
  const update = normalizeList(state, "update");
  const subscribe = normalizeList(state, "subscribe");
  const history = normalizeList(state, "history");

  return {
    hydrationStatus: state.popup.hydrationStatus,
    activeAction: state.popup.activeAction,
    notice: state.popup.notice,
    exportUrl: state.popup.exportUrl,
    exportFilename: state.popup.exportFilename,
    update,
    subscribe,
    history,
    continueReading: history[0] || null,
  };
}
