import reduce from "lodash/reduce";

type State = {
  innerHeight: number;
  innerWidth: number;
  site: string;
  comicsID: string;
  title: string;
  chapterLatestIndex: number;
  chapterNowIndex: number;
  baseURL: string;
  subscribe: boolean;
  chapters: Record<number, any>;
  chapterList: Array<any>;
  read: string[];
  renderBeginIndex: number;
  renderEndIndex: number;
  imageList: {
    result: Array<any>;
    entity: Record<number, any>;
  };
};

type Action = {
  type: string;
  src?: string;
  data?: any;
  index?: number;
  begin?: number;
  end?: number;
  height?: number;
  innerHeight?: number;
  innerWidth?: number;
  imgType?: any;
  naturalWidth?: number;
  naturalHeight?: number;
  [key: string]: any;
};

const initialState: State = {
  innerHeight: typeof window === "undefined" ? 0 : window.innerHeight,
  innerWidth: typeof window === "undefined" ? 0 : window.innerWidth,
  site: "",
  comicsID: "",
  title: "",
  chapterLatestIndex: 0,
  chapterNowIndex: 0,
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
const UPDATE_RENDER_INDEX = "UPDATE_RENDER_INDEX";
const UPDATE_READ_CHAPTERS = "UPDATE_READ_CHAPTERS";
const CONCAT_IMAGE_LIST = "CONCAT_IMAGE_LIST";
const LOAD_IMAGE_SRC = "LOAD_IMAGE_SRC";
const UPDATE_IMAGE_TYPE = "UPDATE_IMAGE_TYPE";
const UPDATE_INNER_HEIGHT = "UPDATE_INNER_HEIGHT";
const UPDATE_INNER_WIDTH = "UPDATE_INNER_WIDTH";
const RESET_IMAGE = "RESET_IMAGE";
const UPDATE_SITE_INFO = "UPDATE_SITE_INFO";

export default function comics(
  state: State = initialState,
  action: Action,
): State {
  switch (action.type) {
    case LOAD_IMAGE_SRC:
      if (typeof action.index === "number" && action.index >= 0) {
        return {
          ...state,
          imageList: {
            ...state.imageList,
            entity: {
              ...state.imageList.entity,
              [action.index]: {
                ...state.imageList.entity[action.index],
                src: action.src,
                loading: false,
              },
            },
          },
        };
      }
      return state;
    case UPDATE_IMAGE_TYPE:
      if (typeof action.index === "number" && action.index >= 0) {
        return {
          ...state,
          imageList: {
            ...state.imageList,
            entity: {
              ...state.imageList.entity,
              [action.index]: {
                ...state.imageList.entity[action.index],
                height: action.height,
                type: action.imgType,
                naturalWidth:
                  typeof action.naturalWidth === "number"
                    ? action.naturalWidth
                    : state.imageList.entity[action.index].naturalWidth,
                naturalHeight:
                  typeof action.naturalHeight === "number"
                    ? action.naturalHeight
                    : state.imageList.entity[action.index].naturalHeight,
              },
            },
          },
        };
      }
      return state;
    case CONCAT_IMAGE_LIST:
      if (action.data && action.data.length) {
        const data = action.data;
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
                    loading: true,
                    height: 1400,
                    type: "image",
                    naturalWidth: 0,
                    naturalHeight: 0,
                  },
                }),
                state.imageList.entity,
              ),
              [data.length + state.imageList.result.length]: {
                type: "end",
                chapter: data[0].chapter,
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
      return {
        ...state,
        chapterLatestIndex: action.data,
      };
    case UPDATE_CHAPTER_NOW_INDEX:
      return {
        ...state,
        chapterNowIndex: action.data,
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
      return {
        ...state,
        read: action.data,
      };
    case UPDATE_CHAPTERS:
      return {
        ...state,
        chapters: action.data,
      };
    case UPDATE_CHAPTER_LIST:
      return {
        ...state,
        chapterList: action.data,
      };
    case UPDATE_COMICS_ID:
      return {
        ...state,
        comicsID: action.data,
      };
    case UPDATE_SUBSCRIBE:
      return {
        ...state,
        subscribe: action.data,
      };
    case UPDATE_TITLE:
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

export function updateChapters(data: {}) {
  return { type: UPDATE_CHAPTERS, data };
}

export function updateChapterList(data: Array<any>) {
  return { type: UPDATE_CHAPTER_LIST, data };
}

export function updateChapterLatestIndex(data: number) {
  return { type: UPDATE_CHAPTER_LATEST_INDEX, data };
}

export function updateChapterNowIndex(data: number) {
  return { type: UPDATE_CHAPTER_NOW_INDEX, data };
}

export function updateRenderIndex(begin: number, end: number) {
  return { type: UPDATE_RENDER_INDEX, begin, end };
}

export function concatImageList(data: Array<any>) {
  return { type: CONCAT_IMAGE_LIST, data };
}

export function loadImgSrc(src: string, index: number) {
  return { type: LOAD_IMAGE_SRC, src, index };
}

export function updateImgType(
  height: number,
  index: number,
  imgType: string,
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
