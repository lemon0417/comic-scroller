import {
  CLEAR_READER_SUBSCRIPTION_NOTICE,
  FETCH_CHAPTER,
  FINISH_READER_SUBSCRIPTION,
  IMAGE_LOAD_FAILED,
  INVALIDATE_READER_PERSISTENCE,
  type ReaderImageFailureStage,
  REQUEST_UNSUBSCRIBE_SERIES,
  RETRY_IMAGE,
  TOGGLE_SUBSCRIBE,
  UPDATE_READ,
  UPDATE_VISIBLE_IMAGE_RANGE,
} from "@domain/actions/reader";
import { buildSeriesKey, uniqueStrings } from "@domain/library";
import {
  clampReaderImageScale,
  getImageRenderMetrics,
  getReaderImageRowHeight,
  READER_IMAGE_SCALE_DEFAULT,
  READER_IMAGE_SCALE_STEP,
} from "@domain/utils/readerLayout";
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
  autoRetryCount: number;
  height: number;
  loadError: ReaderImageFailureStage | null;
  loading: boolean;
  naturalHeight: number;
  naturalWidth: number;
  requestSrc: string;
  type: ComicsImageType;
};

export type PendingChapterGateStatus = "fetching" | "queued";
export type ReaderZoomTarget = "all" | "selected";

export type PendingChapterGateRecord = {
  blockingChapterId: string;
  chapterId: string;
  chapterIndex: number;
  readerGeneration: number;
  status: PendingChapterGateStatus;
  imgList?: ComicsImageSource[];
  canPreloadPreviousChapter?: boolean;
};

export type LeadingEvictionRestoreRecord = {
  sequence: number;
  firstRetainedImageId: number;
  removedScrollHeight: number;
};

export type ReaderSeriesSyncPayload = {
  title: string;
  chapterList: string[];
  chapters: Record<string, ComicsChapterRecord>;
  read: string[];
  subscribed: boolean;
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
  comicUrl: string;
  subscribe: boolean;
  subscriptionPending: boolean;
  subscriptionNotice: string;
  persistenceInvalidated: boolean;
  chapterLoadStatus: "failed" | "idle" | "loading" | "ready";
  chapters: Record<string, ComicsChapterRecord>;
  chapterList: string[];
  requestedChapter: string;
  readyChapters: Record<string, true>;
  pendingChapterGate: PendingChapterGateRecord | null;
  leadingEvictionRestore: LeadingEvictionRestoreRecord | null;
  leadingEvictionRestoreSequence: number;
  nextImageId: number;
  readerGeneration: number;
  readerGlobalScale: number;
  readerZoomTarget: ReaderZoomTarget;
  read: string[];
  renderBeginIndex: number;
  renderEndIndex: number;
  selectedImageId: number | null;
  imageScaleOverrides: Record<number, number>;
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
  comicUrl?: string;
  chapter?: string;
  site?: string;
  stage?: ReaderImageFailureStage;
  gate?: PendingChapterGateRecord;
  readerSeries?: ReaderSeriesSyncPayload;
  scaleDelta?: number;
  zoomTarget?: ReaderZoomTarget;
  seriesKey?: string;
  clearSeriesData?: boolean;
  message?: string;
  restorePersistence?: boolean;
};

export const MAX_IMAGE_AUTO_RETRY_COUNT = 2;

const initialState: ComicsState = {
  innerHeight: 0,
  innerWidth: 0,
  site: "",
  seriesKey: "",
  comicsID: "",
  title: "",
  currentChapterTitle: "",
  chapterLatestIndex: 0,
  chapterNowIndex: 0,
  canPreloadPreviousChapter: true,
  baseURL: "",
  comicUrl: "",
  subscribe: false,
  subscriptionPending: false,
  subscriptionNotice: "",
  persistenceInvalidated: false,
  chapterLoadStatus: "idle",
  chapters: {},
  chapterList: [],
  requestedChapter: "",
  readyChapters: {},
  pendingChapterGate: null,
  leadingEvictionRestore: null,
  leadingEvictionRestoreSequence: 0,
  nextImageId: 0,
  readerGeneration: 0,
  readerGlobalScale: READER_IMAGE_SCALE_DEFAULT,
  readerZoomTarget: "all",
  read: [],
  renderBeginIndex: 0,
  renderEndIndex: 0,
  selectedImageId: null,
  imageScaleOverrides: {},
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
const SYNC_READER_SERIES_STATE = "SYNC_READER_SERIES_STATE";
const UPDATE_CHAPTER_LATEST_INDEX = "UPDATE_CHAPTER_LATEST_INDEX";
export const UPDATE_CHAPTER_NOW_INDEX = "UPDATE_CHAPTER_NOW_INDEX";
const UPDATE_CAN_PRELOAD_PREVIOUS_CHAPTER =
  "UPDATE_CAN_PRELOAD_PREVIOUS_CHAPTER";
const UPDATE_RENDER_INDEX = "UPDATE_RENDER_INDEX";
const UPDATE_READ_CHAPTERS = "UPDATE_READ_CHAPTERS";
const CONCAT_IMAGE_LIST = "CONCAT_IMAGE_LIST";
const LOAD_IMAGE_SRC = "LOAD_IMAGE_SRC";
export const UPDATE_IMAGE_TYPE = "UPDATE_IMAGE_TYPE";
const UPDATE_INNER_HEIGHT = "UPDATE_INNER_HEIGHT";
const UPDATE_INNER_WIDTH = "UPDATE_INNER_WIDTH";
const RESET_IMAGE = "RESET_IMAGE";
const SET_CHAPTER_LOAD_FAILED = "SET_CHAPTER_LOAD_FAILED";
const EVICT_LEADING_IMAGE_CHAPTERS = "EVICT_LEADING_IMAGE_CHAPTERS";
const UPDATE_SITE_INFO = "UPDATE_SITE_INFO";
const START_PENDING_CHAPTER_GATE = "START_PENDING_CHAPTER_GATE";
const RECEIVE_PENDING_CHAPTER_GATE = "RECEIVE_PENDING_CHAPTER_GATE";
const APPEND_PENDING_CHAPTER_GATE = "APPEND_PENDING_CHAPTER_GATE";
const CLEAR_PENDING_CHAPTER_GATE = "CLEAR_PENDING_CHAPTER_GATE";
const CLEAR_LEADING_EVICTION_RESTORE = "CLEAR_LEADING_EVICTION_RESTORE";
const SET_READER_ZOOM_TARGET = "SET_READER_ZOOM_TARGET";
const ADJUST_READER_IMAGE_SCALE = "ADJUST_READER_IMAGE_SCALE";
const RESET_READER_IMAGE_SCALE = "RESET_READER_IMAGE_SCALE";

function resolveCurrentChapterTitle(input: {
  chapterList: string[];
  chapters: Record<string, ComicsChapterRecord>;
  chapterNowIndex: number;
}) {
  const chapterID = input.chapterList[input.chapterNowIndex];
  return chapterID ? input.chapters[chapterID]?.title || "" : "";
}

function buildChapterIndexMap(chapterList: string[]) {
  return chapterList.reduce<Record<string, number>>((acc, chapterID, index) => {
    if (chapterID) {
      acc[chapterID] = index;
    }
    return acc;
  }, {});
}

function mergeRetainedChapterIDs(
  currentChapterList: string[],
  incomingChapterList: string[],
  retainedChapterIDs: Set<string>,
) {
  const incomingChapterIDs = new Set(incomingChapterList);
  const retainedBefore = new Map<string, string[]>();
  const retainedAtEnd: string[] = [];
  let nextAnchor = "";

  for (let index = currentChapterList.length - 1; index >= 0; index -= 1) {
    const chapterID = currentChapterList[index];
    if (incomingChapterIDs.has(chapterID)) {
      nextAnchor = chapterID;
      continue;
    }
    if (!retainedChapterIDs.has(chapterID)) {
      continue;
    }

    if (!nextAnchor) {
      retainedAtEnd.unshift(chapterID);
      continue;
    }

    retainedBefore.set(nextAnchor, [
      chapterID,
      ...(retainedBefore.get(nextAnchor) || []),
    ]);
  }

  return uniqueStrings([
    ...incomingChapterList.flatMap((chapterID) => [
      ...(retainedBefore.get(chapterID) || []),
      chapterID,
    ]),
    ...retainedAtEnd,
  ]);
}

export function projectReaderSeriesState(
  state: ComicsState,
  payload: ReaderSeriesSyncPayload,
): ComicsState {
  const incomingChapterList = uniqueStrings(payload.chapterList);
  const incomingChapterIDs = new Set(incomingChapterList);
  const currentChapterID = state.chapterList[state.chapterNowIndex] || "";
  const frontierChapterID =
    state.chapterList[
      state.chapterLatestIndex >= 0 ? state.chapterLatestIndex : 0
    ] || "";
  const loadedChapterIDs = new Set(
    state.imageList.result
      .map((imageID) => state.imageList.entity[imageID]?.chapter || "")
      .filter(Boolean),
  );
  if (currentChapterID) {
    loadedChapterIDs.add(currentChapterID);
  }
  if (state.pendingChapterGate?.chapterId) {
    loadedChapterIDs.add(state.pendingChapterGate.chapterId);
  }
  if (state.pendingChapterGate?.blockingChapterId) {
    loadedChapterIDs.add(state.pendingChapterGate.blockingChapterId);
  }

  const retainedChapterIDs = new Set(state.chapterList.filter(
    (chapterID) =>
      loadedChapterIDs.has(chapterID) &&
      !incomingChapterIDs.has(chapterID),
  ));
  const chapterList = mergeRetainedChapterIDs(
    state.chapterList,
    incomingChapterList,
    retainedChapterIDs,
  );
  const chapters = Object.fromEntries(
    chapterList.flatMap((chapterID) => {
      const chapter = payload.chapters[chapterID] || state.chapters[chapterID];
      return chapter ? [[chapterID, chapter] as const] : [];
    }),
  );
  const resolvedChapterNowIndex = currentChapterID
    ? chapterList.indexOf(currentChapterID)
    : -1;
  const chapterNowIndex =
    resolvedChapterNowIndex >= 0
      ? resolvedChapterNowIndex
      : Math.max(0, Math.min(state.chapterNowIndex, chapterList.length - 1));
  const resolvedChapterLatestIndex = frontierChapterID
    ? chapterList.indexOf(frontierChapterID)
    : -1;
  const chapterLatestIndex =
    resolvedChapterLatestIndex >= 0
      ? resolvedChapterLatestIndex
      : Math.min(state.chapterLatestIndex, chapterList.length - 1);
  const pendingChapterIndex = state.pendingChapterGate
    ? chapterList.indexOf(state.pendingChapterGate.chapterId)
    : -1;

  return {
    ...state,
    title: payload.title,
    subscribe: payload.subscribed,
    read: uniqueStrings(payload.read),
    chapters,
    chapterList,
    chapterNowIndex,
    chapterLatestIndex,
    currentChapterTitle: resolveCurrentChapterTitle({
      chapterList,
      chapters,
      chapterNowIndex,
    }),
    pendingChapterGate:
      state.pendingChapterGate && pendingChapterIndex >= 0
        ? {
            ...state.pendingChapterGate,
            chapterIndex: pendingChapterIndex,
          }
        : state.pendingChapterGate,
  };
}

function appendImageListToState(
  state: ComicsState,
  data: ComicsImageSource[],
): ComicsState {
  if (data.length === 0) {
    return state;
  }

  const imageStartIndex = state.nextImageId;
  return syncReadyChaptersForAppendedImages({
    ...state,
    chapterLoadStatus: "ready",
    nextImageId: imageStartIndex + data.length + 1,
    imageList: {
      ...state.imageList,
      result: [
        ...state.imageList.result,
        ...Array.from({ length: data.length }, (_v, k) => k + imageStartIndex),
        data.length + imageStartIndex,
      ],
      entity: {
        ...reduce(
          data,
          (acc, item, k) => ({
            ...acc,
            [imageStartIndex + k]: {
              ...item,
              autoRetryCount: 0,
              loading: item.type !== "paywall",
              height: item.type === "paywall" ? 320 : 1400,
              loadError: null,
              requestSrc: item.src,
              type: item.type || "image",
              naturalWidth: 0,
              naturalHeight: 0,
            },
          }),
          state.imageList.entity,
        ) as Record<number, ComicsImageRecord>,
        [data.length + imageStartIndex]: {
          autoRetryCount: 0,
          type: "end",
          chapter: data[0].chapter,
          loadError: null,
          requestSrc: "",
          src: "",
          loading: false,
          height: 72,
          naturalWidth: 0,
          naturalHeight: 0,
        },
      },
    },
  });
}

function canAppendPendingChapter(
  state: ComicsState,
  gate: PendingChapterGateRecord | null,
) {
  return Boolean(
    gate &&
      gate.status === "queued" &&
      gate.imgList?.length &&
      gate.readerGeneration === state.readerGeneration &&
      state.readyChapters[gate.blockingChapterId],
  );
}

function isReadableChapterImage(record: ComicsImageRecord) {
  return record.type !== "end" && record.type !== "paywall";
}

function isSettledReadableChapterImage(record: ComicsImageRecord) {
  return Boolean(record.naturalHeight > 0 || record.loadError);
}

function isChapterReady(
  imageList: ComicsState["imageList"],
  chapterID: string,
) {
  if (!chapterID) {
    return false;
  }

  let hasChapterRecord = false;
  let tailReadableRecord: ComicsImageRecord | null = null;
  for (const imageID of imageList.result) {
    const record = imageList.entity[imageID];
    if (!record || record.chapter !== chapterID) {
      continue;
    }

    hasChapterRecord = true;
    if (isReadableChapterImage(record)) {
      tailReadableRecord = record;
    }
  }

  if (!hasChapterRecord) {
    return false;
  }
  if (!tailReadableRecord) {
    return true;
  }
  return isSettledReadableChapterImage(tailReadableRecord);
}

function syncReadyChapter(
  readyChapters: ComicsState["readyChapters"],
  imageList: ComicsState["imageList"],
  chapterID: string,
) {
  if (!chapterID) {
    return readyChapters;
  }

  const isReady = isChapterReady(imageList, chapterID);
  if (isReady) {
    if (readyChapters[chapterID]) {
      return readyChapters;
    }
    const nextReadyChapters: ComicsState["readyChapters"] = {
      ...readyChapters,
    };
    nextReadyChapters[chapterID] = true;
    return nextReadyChapters;
  }

  if (!readyChapters[chapterID]) {
    return readyChapters;
  }

  const nextReadyChapters = { ...readyChapters };
  delete nextReadyChapters[chapterID];
  return nextReadyChapters;
}

function syncReadyChaptersForAppendedImages(state: ComicsState) {
  const chapterIDs: string[] = [];
  for (const imageID of state.imageList.result) {
    const chapterID = state.imageList.entity[imageID]?.chapter;
    if (chapterID && !chapterIDs.includes(chapterID)) {
      chapterIDs.push(chapterID);
    }
  }

  let readyChapters = state.readyChapters;
  for (let index = 0; index < chapterIDs.length; index += 1) {
    const chapterID = chapterIDs[index];
    readyChapters = syncReadyChapter(
      readyChapters,
      state.imageList,
      chapterID,
    );
  }

  return readyChapters === state.readyChapters
    ? state
    : {
        ...state,
        readyChapters,
      };
}

function getReaderImageRecordRowHeight(
  state: ComicsState,
  imageId: number,
  record?: ComicsImageRecord,
) {
  if (!record) {
    return 0;
  }
  return getReaderImageRowHeight({
    type: record.type,
    height: record.height,
    naturalWidth: record.naturalWidth,
    naturalHeight: record.naturalHeight,
    innerWidth: state.innerWidth,
    innerHeight: state.innerHeight,
    imageScale: getReaderImageScaleForImage(state, imageId),
  });
}

function isReaderZoomTargetImage(record?: ComicsImageRecord) {
  return Boolean(record && record.type !== "end" && record.type !== "paywall");
}

function resolveVisibleReaderImageId(input: {
  begin: number;
  end: number;
  imageList: ComicsState["imageList"];
}) {
  const { begin, end, imageList } = input;
  if (imageList.result.length === 0) {
    return null;
  }

  const startIndex = Math.max(0, begin);
  const endIndex = Math.min(imageList.result.length - 1, end);
  if (startIndex > endIndex) {
    return null;
  }

  for (let index = startIndex; index <= endIndex; index += 1) {
    const imageId = imageList.result[index];
    if (
      typeof imageId === "number" &&
      isReaderZoomTargetImage(imageList.entity[imageId])
    ) {
      return imageId;
    }
  }
  return null;
}

export function getReaderImageScaleForImage(
  state: Pick<ComicsState, "imageScaleOverrides" | "readerGlobalScale">,
  imageId: number,
) {
  const overrideScale = state.imageScaleOverrides[imageId];
  return clampReaderImageScale(
    typeof overrideScale === "number"
      ? overrideScale
      : state.readerGlobalScale,
  );
}

export function getReaderZoomScaleForTarget(
  state: Pick<
    ComicsState,
    | "imageScaleOverrides"
    | "readerGlobalScale"
    | "readerZoomTarget"
    | "selectedImageId"
  >,
) {
  if (
    state.readerZoomTarget === "selected" &&
    typeof state.selectedImageId === "number"
  ) {
    return getReaderImageScaleForImage(state, state.selectedImageId);
  }
  return clampReaderImageScale(state.readerGlobalScale);
}

function getRecalculatedImageRecord(
  state: ComicsState,
  imageId: number,
  record: ComicsImageRecord,
) {
  if (
    !record.naturalWidth ||
    !record.naturalHeight ||
    record.type === "end" ||
    record.type === "paywall"
  ) {
    return record;
  }

  const layout = getImageRenderMetrics({
    type: record.type,
    height: record.height,
    naturalWidth: record.naturalWidth,
    naturalHeight: record.naturalHeight,
    innerWidth: state.innerWidth,
    innerHeight: state.innerHeight,
    imageScale: getReaderImageScaleForImage(state, imageId),
  });
  if (layout.height === record.height && layout.type === record.type) {
    return record;
  }
  return {
    ...record,
    height: layout.height,
    type: layout.type,
  };
}

function recalculateReaderImageHeights(
  state: ComicsState,
  shouldUpdateImage: (imageId: number) => boolean,
) {
  let nextEntity = state.imageList.entity;
  let hasChanged = false;

  for (let index = 0; index < state.imageList.result.length; index += 1) {
    const imageId = state.imageList.result[index];
    const record = state.imageList.entity[imageId];
    if (!record || !shouldUpdateImage(imageId)) {
      continue;
    }
    const nextRecord = getRecalculatedImageRecord(state, imageId, record);
    if (nextRecord === record) {
      continue;
    }
    if (!hasChanged) {
      nextEntity = { ...state.imageList.entity };
      hasChanged = true;
    }
    nextEntity[imageId] = nextRecord;
  }

  if (!hasChanged) {
    return state;
  }
  return {
    ...state,
    imageList: {
      ...state.imageList,
      entity: nextEntity,
    },
  };
}

function updateReaderGlobalScale(state: ComicsState, nextScale: number) {
  const readerGlobalScale = clampReaderImageScale(nextScale);
  if (readerGlobalScale === state.readerGlobalScale) {
    return state;
  }
  const nextState = {
    ...state,
    readerGlobalScale,
  };
  return recalculateReaderImageHeights(
    nextState,
    (imageId) => typeof nextState.imageScaleOverrides[imageId] !== "number",
  );
}

function updateSelectedImageScale(state: ComicsState, nextScale: number) {
  if (typeof state.selectedImageId !== "number") {
    return state;
  }
  const selectedImageId = state.selectedImageId;
  const imageScale = clampReaderImageScale(nextScale);
  if (state.imageScaleOverrides[selectedImageId] === imageScale) {
    return state;
  }
  const nextState = {
    ...state,
    imageScaleOverrides: {
      ...state.imageScaleOverrides,
      [selectedImageId]: imageScale,
    },
  };
  return recalculateReaderImageHeights(
    nextState,
    (imageId) => imageId === selectedImageId,
  );
}

function resetSelectedImageScale(state: ComicsState) {
  if (typeof state.selectedImageId !== "number") {
    return state;
  }
  const selectedImageId = state.selectedImageId;
  if (typeof state.imageScaleOverrides[selectedImageId] !== "number") {
    return state;
  }
  const imageScaleOverrides = { ...state.imageScaleOverrides };
  delete imageScaleOverrides[selectedImageId];
  const nextState = {
    ...state,
    imageScaleOverrides,
  };
  return recalculateReaderImageHeights(
    nextState,
    (imageId) => imageId === selectedImageId,
  );
}

function updateReaderVisibleRange(
  state: ComicsState,
  action: Pick<Action, "begin" | "end">,
) {
  const renderBeginIndex =
    typeof action.begin === "number"
      ? action.begin
      : state.renderBeginIndex;
  const renderEndIndex =
    typeof action.end === "number" ? action.end : state.renderEndIndex;
  const visibleImageId = resolveVisibleReaderImageId({
    begin: renderBeginIndex,
    end: renderEndIndex,
    imageList: state.imageList,
  });
  const selectedImageId =
    typeof visibleImageId === "number" ? visibleImageId : state.selectedImageId;

  if (
    renderBeginIndex === state.renderBeginIndex &&
    renderEndIndex === state.renderEndIndex &&
    selectedImageId === state.selectedImageId
  ) {
    return state;
  }

  return {
    ...state,
    renderBeginIndex,
    renderEndIndex,
    selectedImageId,
  };
}

function appendPendingChapterToState(state: ComicsState): ComicsState {
  const gate = state.pendingChapterGate;
  if (!canAppendPendingChapter(state, gate) || !gate?.imgList) {
    return state;
  }

  const nextState = appendImageListToState(
    {
      ...state,
      pendingChapterGate: null,
    },
    gate.imgList,
  );

  return {
    ...nextState,
    canPreloadPreviousChapter: gate.canPreloadPreviousChapter !== false,
  };
}

export default function comics(
  state: ComicsState = initialState,
  action: Action,
): ComicsState {
  switch (action.type) {
    case TOGGLE_SUBSCRIBE:
      if (state.subscriptionPending || state.persistenceInvalidated)
        return state;
      return { ...state, subscriptionPending: true, subscriptionNotice: "" };
    case REQUEST_UNSUBSCRIBE_SERIES:
      if (state.subscriptionPending || action.seriesKey !== state.seriesKey)
        return state;
      return {
        ...state,
        subscriptionPending: true,
        subscriptionNotice: "",
        persistenceInvalidated: Boolean(action.clearSeriesData),
        readerGeneration:
          state.readerGeneration + (action.clearSeriesData ? 1 : 0),
      };
    case FINISH_READER_SUBSCRIPTION:
      if (action.seriesKey !== state.seriesKey) return state;
      return {
        ...state,
        subscriptionPending: false,
        subscriptionNotice: action.message || "",
        persistenceInvalidated: action.restorePersistence
          ? false
          : state.persistenceInvalidated,
      };
    case INVALIDATE_READER_PERSISTENCE:
      return {
        ...state,
        persistenceInvalidated: true,
        readerGeneration: state.readerGeneration + 1,
      };
    case CLEAR_READER_SUBSCRIPTION_NOTICE:
      return { ...state, subscriptionNotice: "" };
    case FETCH_CHAPTER:
      return {
        ...state,
        chapterLoadStatus: "loading",
        persistenceInvalidated: false,
        readyChapters: {},
        pendingChapterGate: null,
        leadingEvictionRestore: null,
        leadingEvictionRestoreSequence: 0,
        readerGeneration: state.readerGeneration + 1,
        requestedChapter:
          typeof action.chapter === "string"
            ? action.chapter
            : state.requestedChapter,
      };
    case LOAD_IMAGE_SRC:
      if (typeof action.index === "number" && action.index >= 0) {
        const currentRecord = state.imageList.entity[action.index];
        if (!currentRecord) {
          return state;
        }
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
        const currentRecord = state.imageList.entity[action.index];
        if (!currentRecord) {
          return state;
        }
        const nextImageList = {
          ...state.imageList,
          entity: {
            ...state.imageList.entity,
            [action.index]: {
              ...currentRecord,
              autoRetryCount: 0,
              height:
                typeof action.height === "number"
                  ? action.height
                  : currentRecord.height,
              loadError: null,
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
        };
        return {
          ...state,
          readyChapters: syncReadyChapter(
            state.readyChapters,
            nextImageList,
            currentRecord.chapter,
          ),
          imageList: nextImageList,
        };
      }
      return state;
    case CONCAT_IMAGE_LIST:
      if (Array.isArray(action.data) && action.data.length > 0) {
        return appendImageListToState(state, action.data as ComicsImageSource[]);
      }
      return state;
    case START_PENDING_CHAPTER_GATE:
      if (
        !action.gate ||
        action.gate.readerGeneration !== state.readerGeneration
      ) {
        return state;
      }
      return {
        ...state,
        pendingChapterGate: action.gate,
      };
    case RECEIVE_PENDING_CHAPTER_GATE:
      if (
        !action.gate ||
        action.gate.readerGeneration !== state.readerGeneration
      ) {
        return state;
      }
      if (
        state.readyChapters[action.gate.blockingChapterId] &&
        action.gate.imgList?.length
      ) {
        return appendImageListToState(
          {
            ...state,
            canPreloadPreviousChapter:
              action.gate.canPreloadPreviousChapter !== false,
            pendingChapterGate: null,
          },
          action.gate.imgList,
        );
      }
      return {
        ...state,
        pendingChapterGate: action.gate,
      };
    case APPEND_PENDING_CHAPTER_GATE:
      return appendPendingChapterToState(state);
    case CLEAR_PENDING_CHAPTER_GATE:
      return {
        ...state,
        pendingChapterGate: null,
      };
    case IMAGE_LOAD_FAILED: {
      if (typeof action.index !== "number" || action.index < 0) {
        return state;
      }
      if (!action.stage) {
        return state;
      }
      const currentRecord = state.imageList.entity[action.index];
      if (
        !currentRecord ||
        currentRecord.type === "end" ||
        currentRecord.type === "paywall"
      ) {
        return state;
      }
      if (currentRecord.autoRetryCount < MAX_IMAGE_AUTO_RETRY_COUNT) {
        const nextImageList = {
          ...state.imageList,
          entity: {
            ...state.imageList.entity,
            [action.index]: {
              ...currentRecord,
              autoRetryCount: currentRecord.autoRetryCount + 1,
              loadError: null,
              loading: true,
              src: currentRecord.requestSrc,
            },
          },
        };
        return {
          ...state,
          readyChapters: syncReadyChapter(
            state.readyChapters,
            nextImageList,
            currentRecord.chapter,
          ),
          imageList: nextImageList,
        };
      }
      const nextImageList = {
        ...state.imageList,
        entity: {
          ...state.imageList.entity,
          [action.index]: {
            ...currentRecord,
            loadError: action.stage,
            loading: false,
            src: currentRecord.requestSrc,
          },
        },
      };
      return {
        ...state,
        readyChapters: syncReadyChapter(
          state.readyChapters,
          nextImageList,
          currentRecord.chapter,
        ),
        imageList: nextImageList,
      };
    }
    case RETRY_IMAGE: {
      if (typeof action.index !== "number" || action.index < 0) {
        return state;
      }
      if (!state.imageList.entity[action.index]) {
        return state;
      }
      const currentRecord = state.imageList.entity[action.index];
      const nextImageList = {
        ...state.imageList,
        entity: {
          ...state.imageList.entity,
          [action.index]: {
            ...currentRecord,
            autoRetryCount: 0,
            loadError: null,
            loading: true,
            src: currentRecord.requestSrc,
          },
        },
      };
      return {
        ...state,
        readyChapters: syncReadyChapter(
          state.readyChapters,
          nextImageList,
          currentRecord.chapter,
        ),
        imageList: nextImageList,
      };
    }
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
    case UPDATE_READ: {
      if (typeof action.index !== "number") return state;
      const chapterNowIndex = action.index;
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
    case UPDATE_VISIBLE_IMAGE_RANGE:
    case UPDATE_RENDER_INDEX:
      return updateReaderVisibleRange(state, action);
    case SET_READER_ZOOM_TARGET:
      if (action.zoomTarget === "selected" && state.selectedImageId === null) {
        return state;
      }
      if (action.zoomTarget !== "all" && action.zoomTarget !== "selected") {
        return state;
      }
      return {
        ...state,
        readerZoomTarget: action.zoomTarget,
      };
    case ADJUST_READER_IMAGE_SCALE: {
      const scaleDelta =
        typeof action.scaleDelta === "number"
          ? action.scaleDelta
          : READER_IMAGE_SCALE_STEP;
      if (state.readerZoomTarget === "selected") {
        if (typeof state.selectedImageId !== "number") {
          return state;
        }
        return updateSelectedImageScale(
          state,
          getReaderImageScaleForImage(state, state.selectedImageId) + scaleDelta,
        );
      }
      return updateReaderGlobalScale(state, state.readerGlobalScale + scaleDelta);
    }
    case RESET_READER_IMAGE_SCALE:
      if ((action.zoomTarget || state.readerZoomTarget) === "selected") {
        return resetSelectedImageScale(state);
      }
      return updateReaderGlobalScale(state, READER_IMAGE_SCALE_DEFAULT);
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
    case SYNC_READER_SERIES_STATE:
      if (!action.readerSeries) return state;
      return projectReaderSeriesState(state, action.readerSeries);
    case UPDATE_COMICS_ID:
      if (typeof action.data !== "string") return state;
      return {
        ...state,
        comicsID: action.data,
        comicUrl: action.data === state.comicsID ? state.comicUrl : "",
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
    case SET_CHAPTER_LOAD_FAILED:
      return {
        ...state,
        chapterLoadStatus: "failed",
      };
    case EVICT_LEADING_IMAGE_CHAPTERS: {
      if (typeof action.data !== "number" || state.imageList.result.length === 0) {
        return state;
      }

      const chapterIndexMap = buildChapterIndexMap(state.chapterList);
      const headImageID = state.imageList.result[0];
      const headChapterID = state.imageList.entity[headImageID]?.chapter || "";
      const headChapterIndex = chapterIndexMap[headChapterID];
      if (
        typeof headChapterIndex !== "number" ||
        headChapterIndex <= action.data
      ) {
        return state;
      }

      let removeCount = 0;
      while (removeCount < state.imageList.result.length) {
        const imageID = state.imageList.result[removeCount];
        if (state.imageList.entity[imageID]?.chapter !== headChapterID) {
          break;
        }
        removeCount += 1;
      }

      if (removeCount <= 0) {
        return state;
      }

      const nextResult = state.imageList.result.slice(removeCount);
      const nextEntity = { ...state.imageList.entity };
      const nextImageScaleOverrides = { ...state.imageScaleOverrides };
      let didRemoveImageScaleOverride = false;
      let didRemoveSelectedImage = false;
      let removedScrollHeight = 0;
      for (let index = 0; index < removeCount; index += 1) {
        const imageID = state.imageList.result[index];
        removedScrollHeight += getReaderImageRecordRowHeight(
          state,
          imageID,
          nextEntity[imageID],
        );
        delete nextEntity[imageID];
        if (typeof nextImageScaleOverrides[imageID] === "number") {
          delete nextImageScaleOverrides[imageID];
          didRemoveImageScaleOverride = true;
        }
        if (state.selectedImageId === imageID) {
          didRemoveSelectedImage = true;
        }
      }
      const firstRetainedImageId = nextResult[0];
      const nextRestoreSequence = state.leadingEvictionRestoreSequence + 1;
      const nextReadyChapters = { ...state.readyChapters };
      const didRemoveReadyChapter = Boolean(nextReadyChapters[headChapterID]);
      delete nextReadyChapters[headChapterID];

      return {
        ...state,
        leadingEvictionRestoreSequence: nextRestoreSequence,
        leadingEvictionRestore:
          typeof firstRetainedImageId === "number" && removedScrollHeight > 0
            ? {
                sequence: nextRestoreSequence,
                firstRetainedImageId,
                removedScrollHeight,
              }
            : null,
        imageList: {
          result: nextResult,
          entity: nextEntity,
        },
        imageScaleOverrides: didRemoveImageScaleOverride
          ? nextImageScaleOverrides
          : state.imageScaleOverrides,
        readyChapters: didRemoveReadyChapter
          ? nextReadyChapters
          : state.readyChapters,
        selectedImageId: didRemoveSelectedImage ? null : state.selectedImageId,
        readerZoomTarget: didRemoveSelectedImage ? "all" : state.readerZoomTarget,
      };
    }
    case CLEAR_LEADING_EVICTION_RESTORE:
      if (
        typeof action.data !== "number" ||
        state.leadingEvictionRestore?.sequence !== action.data
      ) {
        return state;
      }
      return {
        ...state,
        leadingEvictionRestore: null,
      };
    case RESET_IMAGE:
      return {
        ...state,
        readyChapters: {},
        pendingChapterGate: null,
        leadingEvictionRestore: null,
        leadingEvictionRestoreSequence: 0,
        readerGeneration: state.readerGeneration + 1,
        readerGlobalScale: READER_IMAGE_SCALE_DEFAULT,
        readerZoomTarget: "all",
        selectedImageId: null,
        imageScaleOverrides: {},
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
        comicUrl:
          typeof action.comicUrl === "string"
            ? action.comicUrl
            : action.site && action.site !== state.site
              ? ""
              : state.comicUrl,
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

export function syncReaderSeriesState(readerSeries: ReaderSeriesSyncPayload) {
  return { type: SYNC_READER_SERIES_STATE, readerSeries };
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

export function setReaderZoomTarget(zoomTarget: ReaderZoomTarget) {
  return { type: SET_READER_ZOOM_TARGET, zoomTarget };
}

export function adjustReaderImageScale(scaleDelta: number) {
  return { type: ADJUST_READER_IMAGE_SCALE, scaleDelta };
}

export function resetReaderImageScale(zoomTarget?: ReaderZoomTarget) {
  return { type: RESET_READER_IMAGE_SCALE, zoomTarget };
}

export function updateSiteInfo(
  site: string,
  baseURL: string,
  comicUrl?: string,
) {
  return {
    type: UPDATE_SITE_INFO,
    site,
    baseURL,
    ...(comicUrl !== undefined ? { comicUrl } : {}),
  };
}

export function setChapterLoadFailed() {
  return { type: SET_CHAPTER_LOAD_FAILED };
}

export function evictLeadingImageChapters(data: number) {
  return { type: EVICT_LEADING_IMAGE_CHAPTERS, data };
}

export function startPendingChapterGate(gate: PendingChapterGateRecord) {
  return { type: START_PENDING_CHAPTER_GATE, gate };
}

export function receivePendingChapterGate(gate: PendingChapterGateRecord) {
  return { type: RECEIVE_PENDING_CHAPTER_GATE, gate };
}

export function appendPendingChapterGate() {
  return { type: APPEND_PENDING_CHAPTER_GATE };
}

export function clearPendingChapterGate() {
  return { type: CLEAR_PENDING_CHAPTER_GATE };
}

export function clearLeadingEvictionRestore(sequence: number) {
  return { type: CLEAR_LEADING_EVICTION_RESTORE, data: sequence };
}
