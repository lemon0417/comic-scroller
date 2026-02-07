export const FETCH_CHAPTER = "FETCH_CHAPTER";
export const FETCH_IMAGE_SRC = "FETCH_IMAGE_SRC";
export const FETCH_IMG_LIST = "FETCH_IMG_LIST";
export const UPDATE_READ = "UPDATE_READ";
export const START_SCROLL_EPIC = "START_SCROLL_EPIC";
export const STOP_SCROLL_EPIC = "STOP_SCROLL_EPIC";
export const START_RESIZE_EPIC = "START_RESIZE_EPIC";

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

export function startScroll() {
  return { type: START_SCROLL_EPIC };
}

export function stopScroll() {
  return { type: STOP_SCROLL_EPIC };
}

export function startResize() {
  return { type: START_RESIZE_EPIC };
}
