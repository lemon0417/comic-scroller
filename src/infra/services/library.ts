export {
  LIBRARY_DB_NAME,
  LIBRARY_DB_VERSION,
  LIBRARY_META_KEY,
  LIBRARY_SCHEMA_VERSION,
  LIBRARY_SIGNAL_KEY,
  META_STORE,
  SERIES_STORE,
  CHAPTERS_STORE,
  SUBSCRIPTIONS_STORE,
  HISTORY_STORE,
  UPDATES_STORE,
  HISTORY_LIMIT,
  SITE_KEYS,
  canonicalizeComicsID,
  buildSeriesKey,
  parseSeriesKey,
  createEmptyLibrarySnapshot,
  normalizeChapterRecord,
  normalizeSeriesRecord,
  getExtensionVersion,
  uniqueStrings,
} from "./library/schema";

export type {
  ChapterRecord,
  ChapterRow,
  HistoryRow,
  LibraryDumpV1,
  LibrarySignal,
  LibrarySnapshotV2,
  LibraryUpdateRecord,
  SeriesKey,
  SeriesRecord,
  SeriesRow,
  SiteKey,
  SubscriptionRow,
  UpdateRow,
} from "./library/schema";

export {
  migrateLibrary,
  loadLibrary,
  saveLibrary,
  resetLibrary,
  exportLibraryDump,
  importLibraryDump,
  setLibraryVersion,
} from "./library/compat";

export {
  getSeriesSnapshot,
  getSeriesMeta,
  getPopupFeedSnapshot,
  listSubscriptionKeys,
  findExistingSeriesKey,
  isSeriesSubscribedByKey,
  getUpdateCount,
} from "./library/queries";

export {
  upsertSeriesWithChapters,
  markSeriesRead,
  recordHistory,
  setSeriesSubscription,
  setSeriesSubscriptionByKey,
  dismissSeriesUpdate,
  prependSeriesUpdate,
  removeSeriesCascade,
  applyReaderSeriesState,
  applyReadProgress,
  applyBackgroundSeriesRefresh,
} from "./library/mutations";

export {
  subscribeToLibrarySignal,
  subscribeToLibraryChanges,
} from "./library/signal";
