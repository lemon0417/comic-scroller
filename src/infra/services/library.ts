export {
  parseSeriesKey,
} from "./library/schema";

export type {
  PopupFeedCategory,
  PopupFeedEntry,
  PopupFeedSnapshot,
  ReaderSeriesState,
} from "./library/models";

export {
  resetLibrary,
  exportLibraryDump,
  importLibraryDump,
  setLibraryVersion,
} from "./library/compat";

export {
  getReaderSeriesState,
  getSeriesSnapshot,
  getPopupFeedSnapshot,
  listSubscriptionKeys,
  isSeriesSubscribedByKey,
  getUpdateCount,
} from "./library/queries";

export {
  setSeriesSubscription,
  setSeriesSubscriptionByKey,
  dismissSeriesUpdate,
  removeSeriesCascade,
  applyReaderSeriesState,
  applyReadProgress,
  applyBackgroundSeriesRefresh,
  markSubscriptionCheckedByKey,
} from "./library/mutations";

export {
  subscribeToLibrarySignal,
} from "./library/signal";
