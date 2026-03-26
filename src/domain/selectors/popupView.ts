import type {
  LibrarySnapshotV2,
  SeriesRecord,
  SiteKey,
} from "@infra/services/library";
import { parseSeriesKey } from "@infra/services/library";

const SITE_LABELS: Record<string, string> = {
  dm5: "DM5",
  sf: "SF",
  comicbus: "ComicBus",
};

function buildViewEntry(
  library: LibrarySnapshotV2,
  category: string,
  seriesKey: string,
  index: number,
  chapterID = "",
) {
  const record = library.seriesByKey[seriesKey];
  if (!record) return null;

  const chapters = record.chapters || {};
  const chapterList = record.chapterList || [];
  const lastReadChapterID = record.lastRead || "";
  const lastChapterID = chapterList[0] || "";
  const lastRead = (lastReadChapterID ? chapters[lastReadChapterID] : null) || null;
  const lastChapter = (lastChapterID ? chapters[lastChapterID] : null) || null;
  const updateChapter = (chapterID ? chapters[chapterID] : null) || null;
  const continueChapterID = lastReadChapterID || chapterID || lastChapterID;
  const continueHref =
    lastRead?.href || updateChapter?.href || lastChapter?.href || record.url || "";
  const { site } = parseSeriesKey(seriesKey);

  return {
    category,
    key: `${category}_${seriesKey}_${chapterID || index}`,
    index,
    site,
    siteLabel: SITE_LABELS[site] || String(site || "").toUpperCase(),
    comicsID: record.comicsID,
    chapterID,
    lastReadChapterID,
    lastChapterID,
    updateChapterID: chapterID,
    continueChapterID,
    title: record.title || "Untitled Series",
    url: record.url || "",
    cover: record.cover || "",
    lastReadTitle: lastRead?.title || "Not started",
    lastReadHref: lastRead?.href || "",
    lastChapterTitle: lastChapter?.title || "No chapters yet",
    lastChapterHref: lastChapter?.href || "",
    updateChapterTitle: updateChapter?.title || "",
    updateChapterHref: updateChapter?.href || "",
    continueHref,
  };
}

function mapSeriesList(
  library: LibrarySnapshotV2,
  category: "subscribe" | "history",
  list: string[],
) {
  return list
    .map((seriesKey, index) => buildViewEntry(library, category, seriesKey, index))
    .filter(Boolean);
}

function mapUpdates(library: LibrarySnapshotV2) {
  return library.updates
    .map((item, index) =>
      buildViewEntry(
        library,
        "update",
        item.seriesKey,
        index,
        String(item.chapterID || ""),
      ),
    )
    .filter(Boolean);
}

function buildContinueReading(
  library: LibrarySnapshotV2,
  history: ReturnType<typeof mapSeriesList>,
) {
  if (history.length > 0) return history[0];
  const firstSubscribed = library.subscriptions.find(
    (seriesKey) => !!library.seriesByKey[seriesKey],
  );
  if (!firstSubscribed) return null;
  return buildViewEntry(library, "subscribe", firstSubscribed, 0);
}

export function selectPopupView(state: any) {
  const popupState = state.popup;
  const library = popupState.library as LibrarySnapshotV2;
  const update = mapUpdates(library);
  const subscribe = mapSeriesList(library, "subscribe", library.subscriptions);
  const history = mapSeriesList(library, "history", library.history);

  return {
    hydrationStatus: popupState.hydrationStatus,
    activeAction: popupState.activeAction,
    notice: popupState.notice,
    exportUrl: popupState.exportUrl,
    exportFilename: popupState.exportFilename,
    update,
    subscribe,
    history,
    continueReading: buildContinueReading(library, history),
  };
}

export function selectReaderSeries(
  library: LibrarySnapshotV2,
  site: SiteKey,
  comicsID: string,
) {
  const seriesKey = `${site}:${comicsID}`;
  return library.seriesByKey[seriesKey] as SeriesRecord | undefined;
}
