import { buildSeriesKey } from "@infra/services/library/schema";
import reduce from "lodash/reduce";

export type ComicsChapterRecord = {
  title: string;
};

export type ComicsImageType = "end" | "image" | "natural" | "paywall" | "wide";

export type ComicsImageSource = {
  chapter: string;
  href?: string;
  src: string;
  cid?: string;
  key?: string;
  type?: ComicsImageType;
};

export type ComicsImageRecord = ComicsImageSource & {
  height: number;
  loading: boolean;
  naturalHeight: number;
  naturalWidth: number;
  type: ComicsImageType;
};

export type ComicsState = {
  innerHeight: number;
  innerWidth: number;
  site: string;
  seriesKey: string;
  comicsID: string;
  title: string;
  currentChapterTitle: string;
  chapterLatestIndex: number;
  chapterNowIndex: number;
  canPreloadPreviousChapter: boolean;
  baseURL: string;
  subscribe: boolean;
  chapters: Record<string, ComicsChapterRecord>;
  chapterList: string[];
  read: string[];
  renderBeginIndex: number;
  renderEndIndex: number;
  imageList: {
    result: number[];
    entity: Record<number, ComicsImageRecord>;
  };
};

type Action = {
  type: string;
  src?: string;
  data?:
    | boolean
    | number
    | string
    | string[]
    | ComicsImageSource[]
    | Record<string, ComicsChapterRecord>;
  index?: number;
  begin?: number;
  end?: number;
  height?: number;
  innerHeight?: number;
  innerWidth?: number;
  imgType?: ComicsImageType;
  naturalWidth?: number;
  naturalHeight?: number;
  baseURL?: string;
  site?: string;
};

const initialState: ComicsState = {
  innerHeight: typeof window === "undefined" ? 0 : window.innerHeight,
  innerWidth: typeof window === "undefined" ? 0 : window.innerWidth,
  site: "",
  seriesKey: "",
  comicsID: "",
  title: "",
  currentChapterTitle: "",
  chapterLatestIndex: 0,
  chapterNowIndex: 0,
  canPreloadPreviousChapter: true,
  baseURL: "",
  subscribe: false,
  chapters: {},
  chapterList: [],
  read: [],
  renderBeginIndex: 0,
  renderEndIndex: 0,
  imageList: {
    result: [],
    entity: {},
  },
};

const UPDATE_COMICS_ID = "UPDATE_COMICS_ID";
const UPDATE_SUBSCRIBE = "UPDATE_SUBSCRIBE";
const UPDATE_TITLE = "UPDATE_TITLE";
const UPDATE_CHAPTERS = "UPDATE_CHAPTERS";
const UPDATE_CHAPTER_LIST = "UPDATE_CHAPTER_LIST";
const UPDATE_CHAPTER_LATEST_INDEX = "UPDATE_CHAPTER_LATEST_INDEX";
export const UPDATE_CHAPTER_NOW_INDEX = "UPDATE_CHAPTER_NOW_INDEX";
const UPDATE_CAN_PRELOAD_PREVIOUS_CHAPTER =
  "UPDATE_CAN_PRELOAD_PREVIOUS_CHAPTER";
const UPDATE_RENDER_INDEX = "UPDATE_RENDER_INDEX";
const UPDATE_READ_CHAPTERS = "UPDATE_READ_CHAPTERS";
const CONCAT_IMAGE_LIST = "CONCAT_IMAGE_LIST";
const LOAD_IMAGE_SRC = "LOAD_IMAGE_SRC";
const UPDATE_IMAGE_TYPE = "UPDATE_IMAGE_TYPE";
const UPDATE_INNER_HEIGHT = "UPDATE_INNER_HEIGHT";
const UPDATE_INNER_WIDTH = "UPDATE_INNER_WIDTH";
const RESET_IMAGE = "RESET_IMAGE";
const UPDATE_SITE_INFO = "UPDATE_SITE_INFO";

function createFallbackImageRecord(chapter = ""): ComicsImageRecord {
  return {
    chapter,
    src: "",
    height: 1400,
    loading: false,
    naturalHeight: 0,
    naturalWidth: 0,
    type: "image",
  };
}

function resolveCurrentChapterTitle(input: {
  chapterList: string[];
  chapters: Record<string, ComicsChapterRecord>;
  chapterNowIndex: number;
}) {
  const chapterID = input.chapterList[input.chapterNowIndex];
  return chapterID ? input.chapters[chapterID]?.title || "" : "";
}

export default function comics(
  state: ComicsState = initialState,
  action: Action,
): ComicsState {
  switch (action.type) {
    case LOAD_IMAGE_SRC:
      if (typeof action.index === "number" && action.index >= 0) {
        const currentRecord =
          state.imageList.entity[action.index] || createFallbackImageRecord();
        return {
          ...state,
          imageList: {
            ...state.imageList,
            entity: {
              ...state.imageList.entity,
              [action.index]: {
                ...currentRecord,
                src: action.src || "",
                loading: false,
              },
            },
          },
        };
      }
      return state;
    case UPDATE_IMAGE_TYPE:
      if (typeof action.index === "number" && action.index >= 0) {
        const currentRecord =
          state.imageList.entity[action.index] || createFallbackImageRecord();
        return {
          ...state,
          imageList: {
            ...state.imageList,
            entity: {
              ...state.imageList.entity,
              [action.index]: {
                ...currentRecord,
                height:
                  typeof action.height === "number"
                    ? action.height
                    : currentRecord.height,
                type: action.imgType || currentRecord.type,
                naturalWidth:
                  typeof action.naturalWidth === "number"
                    ? action.naturalWidth
                    : currentRecord.naturalWidth,
                naturalHeight:
                  typeof action.naturalHeight === "number"
                    ? action.naturalHeight
                    : currentRecord.naturalHeight,
              },
            },
          },
        };
      }
      return state;
    case CONCAT_IMAGE_LIST:
      if (Array.isArray(action.data) && action.data.length > 0) {
        const data = action.data as ComicsImageSource[];
        return {
          ...state,
          imageList: {
            ...state.imageList,
            result: [
              ...state.imageList.result,
              ...Array.from(
                { length: data.length },
                (_v, k) => k + state.imageList.result.length,
              ),
              data.length + state.imageList.result.length,
            ],
            entity: {
              ...reduce(
                data,
                (acc, item, k) => ({
                  ...acc,
                  [state.imageList.result.length + k]: {
                    ...item,
                    loading: item.type !== "paywall",
                    height: item.type === "paywall" ? 320 : 1400,
                    type: item.type || "image",
                    naturalWidth: 0,
                    naturalHeight: 0,
                  },
                }),
                state.imageList.entity,
              ) as Record<number, ComicsImageRecord>,
              [data.length + state.imageList.result.length]: {
                type: "end",
                chapter: data[0].chapter,
                src: "",
                loading: false,
                height: 72,
                naturalWidth: 0,
                naturalHeight: 0,
              },
            },
          },
        };
      }
      return state;
    case UPDATE_CHAPTER_LATEST_INDEX:
      if (typeof action.data !== "number") return state;
      return {
        ...state,
        chapterLatestIndex: action.data,
      };
    case UPDATE_CHAPTER_NOW_INDEX: {
      if (typeof action.data !== "number") return state;
      const chapterNowIndex = action.data;
      return {
        ...state,
        chapterNowIndex,
        currentChapterTitle: resolveCurrentChapterTitle({
          chapterList: state.chapterList,
          chapters: state.chapters,
          chapterNowIndex,
        }),
      };
    }
    case UPDATE_CAN_PRELOAD_PREVIOUS_CHAPTER:
      if (typeof action.data !== "boolean") return state;
      return {
        ...state,
        canPreloadPreviousChapter: action.data,
      };
    case UPDATE_RENDER_INDEX:
      return {
        ...state,
        renderBeginIndex:
          typeof action.begin === "number"
            ? action.begin
            : state.renderBeginIndex,
        renderEndIndex:
          typeof action.end === "number" ? action.end : state.renderEndIndex,
      };
    case UPDATE_READ_CHAPTERS:
      if (!Array.isArray(action.data)) return state;
      return {
        ...state,
        read: action.data as string[],
      };
    case UPDATE_CHAPTERS: {
      if (!action.data || typeof action.data !== "object" || Array.isArray(action.data)) {
        return state;
      }
      const chapters = action.data as Record<string, ComicsChapterRecord>;
      return {
        ...state,
        chapters,
        currentChapterTitle: resolveCurrentChapterTitle({
          chapterList: state.chapterList,
          chapters,
          chapterNowIndex: state.chapterNowIndex,
        }),
      };
    }
    case UPDATE_CHAPTER_LIST: {
      if (!Array.isArray(action.data)) return state;
      const chapterList = action.data as string[];
      return {
        ...state,
        chapterList,
        currentChapterTitle: resolveCurrentChapterTitle({
          chapterList,
          chapters: state.chapters,
          chapterNowIndex: state.chapterNowIndex,
        }),
      };
    }
    case UPDATE_COMICS_ID:
      if (typeof action.data !== "string") return state;
      return {
        ...state,
        comicsID: action.data,
        seriesKey:
          state.site && typeof action.data === "string"
            ? buildSeriesKey(state.site, action.data)
            : "",
      };
    case UPDATE_SUBSCRIBE:
      if (typeof action.data !== "boolean") return state;
      return {
        ...state,
        subscribe: action.data,
      };
    case UPDATE_TITLE:
      if (typeof action.data !== "string") return state;
      return {
        ...state,
        title: action.data,
      };
    case RESET_IMAGE:
      return {
        ...state,
        imageList: {
          result: [],
          entity: {},
        },
      };
    case UPDATE_INNER_HEIGHT:
      return {
        ...state,
        innerHeight:
          typeof action.innerHeight === "number"
            ? action.innerHeight
            : state.innerHeight,
      };
    case UPDATE_INNER_WIDTH:
      return {
        ...state,
        innerWidth:
          typeof action.innerWidth === "number"
            ? action.innerWidth
            : state.innerWidth,
      };
    case UPDATE_SITE_INFO:
      return {
        ...state,
        site: typeof action.site === "string" ? action.site : state.site,
        seriesKey:
          typeof action.site === "string" && state.comicsID
            ? buildSeriesKey(action.site, state.comicsID)
            : "",
        baseURL:
          typeof action.baseURL === "string" ? action.baseURL : state.baseURL,
      };
    default:
      return state;
  }
}

export function updateTitle(data: string) {
  return { type: UPDATE_TITLE, data };
}

export function updateComicsID(data: string) {
  return { type: UPDATE_COMICS_ID, data };
}

export function updateSubscribe(data: boolean) {
  return { type: UPDATE_SUBSCRIBE, data };
}

export function updateReadChapters(data: string[]) {
  return { type: UPDATE_READ_CHAPTERS, data };
}

export function updateChapters(data: Record<string, ComicsChapterRecord>) {
  return { type: UPDATE_CHAPTERS, data };
}

export function updateChapterList(data: string[]) {
  return { type: UPDATE_CHAPTER_LIST, data };
}

export function updateChapterLatestIndex(data: number) {
  return { type: UPDATE_CHAPTER_LATEST_INDEX, data };
}

export function updateChapterNowIndex(data: number) {
  return { type: UPDATE_CHAPTER_NOW_INDEX, data };
}

export function updateCanPreloadPreviousChapter(data: boolean) {
  return { type: UPDATE_CAN_PRELOAD_PREVIOUS_CHAPTER, data };
}

export function concatImageList(data: ComicsImageSource[]) {
  return { type: CONCAT_IMAGE_LIST, data };
}

export function loadImgSrc(src: string, index: number) {
  return { type: LOAD_IMAGE_SRC, src, index };
}

export function updateImgType(
  height: number,
  index: number,
  imgType: ComicsImageType,
  naturalWidth?: number,
  naturalHeight?: number,
) {
  return {
    type: UPDATE_IMAGE_TYPE,
    height,
    index,
    imgType,
    naturalWidth,
    naturalHeight,
  };
}

export function resetImg() {
  return { type: RESET_IMAGE };
}

export function updateInnerHeight(innerHeight: number) {
  return { type: UPDATE_INNER_HEIGHT, innerHeight };
}

export function updateInnerWidth(innerWidth: number) {
  return { type: UPDATE_INNER_WIDTH, innerWidth };
}

export function updateSiteInfo(site: string, baseURL: string) {
  return { type: UPDATE_SITE_INFO, site, baseURL };
}
