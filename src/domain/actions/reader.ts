export const FETCH_CHAPTER = "FETCH_CHAPTER";
export const FETCH_IMAGE_SRC = "FETCH_IMAGE_SRC";
export const FETCH_IMG_LIST = "FETCH_IMG_LIST";
export const UPDATE_READ = "UPDATE_READ";
export const NAVIGATE_CHAPTER = "NAVIGATE_CHAPTER";
export const TOGGLE_SUBSCRIBE = "TOGGLE_SUBSCRIBE";
export const REQUEST_UNSUBSCRIBE_SERIES = "REQUEST_UNSUBSCRIBE_SERIES";
export const FINISH_READER_SUBSCRIPTION = "FINISH_READER_SUBSCRIPTION";
export const INVALIDATE_READER_PERSISTENCE = "INVALIDATE_READER_PERSISTENCE";
export const CLEAR_READER_SUBSCRIPTION_NOTICE =
  "CLEAR_READER_SUBSCRIPTION_NOTICE";
export const UPDATE_VISIBLE_IMAGE_RANGE = "UPDATE_VISIBLE_IMAGE_RANGE";
export const IMAGE_LOAD_FAILED = "IMAGE_LOAD_FAILED";
export const RETRY_IMAGE = "RETRY_IMAGE";

export type ReaderImageFailureStage = "image" | "resolve";

export function fetchChapter(chapter: string) {
  return { type: FETCH_CHAPTER, chapter };
}

export function fetchImgSrc(begin: number, end: number) {
  return { type: FETCH_IMAGE_SRC, begin, end };
}

export function fetchImgList(index: number) {
  return { type: FETCH_IMG_LIST, index };
}

export function updateRead(index: number) {
  return { type: UPDATE_READ, index };
}

export function navigateChapter(index: number) {
  return { type: NAVIGATE_CHAPTER, index };
}

export function toggleSubscribe() {
  return { type: TOGGLE_SUBSCRIBE };
}

export function requestUnsubscribeSeries(
  seriesKey: string,
  clearSeriesData: boolean,
) {
  return { type: REQUEST_UNSUBSCRIBE_SERIES, seriesKey, clearSeriesData };
}

export function finishReaderSubscription(
  seriesKey: string,
  message = "",
  restorePersistence = false,
) {
  return {
    type: FINISH_READER_SUBSCRIPTION,
    seriesKey,
    message,
    restorePersistence,
  };
}

export function invalidateReaderPersistence() {
  return { type: INVALIDATE_READER_PERSISTENCE };
}

export function clearReaderSubscriptionNotice() {
  return { type: CLEAR_READER_SUBSCRIPTION_NOTICE };
}

export function updateVisibleImageRange(begin: number, end: number) {
  return { type: UPDATE_VISIBLE_IMAGE_RANGE, begin, end };
}

export function imageLoadFailed(index: number, stage: ReaderImageFailureStage) {
  return { type: IMAGE_LOAD_FAILED, index, stage };
}

export function retryImage(index: number) {
  return { type: RETRY_IMAGE, index };
}
