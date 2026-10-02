import {
  FETCH_CHAPTER,
  FETCH_IMAGE_SRC,
  FETCH_IMG_LIST,
  fetchImgList,
  fetchImgSrc,
  UPDATE_READ,
} from "@domain/actions/reader";
import {
  type SiteKey,
  uniqueStrings,
} from "@domain/library";
import type { RootState } from "@domain/reducers";
import {
  clearPendingChapterGate,
  type ComicsChapterRecord,
  type ComicsImageSource,
  concatImageList,
  loadImgSrc,
  receivePendingChapterGate,
  setChapterLoadFailed,
  startPendingChapterGate,
  updateCanPreloadPreviousChapter,
  updateChapterLatestIndex,
  updateChapterList,
  updateChapterNowIndex,
  updateChapters,
  updateComicsID,
  updateReadChapters,
  updateSiteInfo,
  updateSubscribe,
  updateTitle,
} from "@domain/reducers/comics";
import {
  applyReaderSeriesState,
  applyReadProgress,
} from "@infra/services/library/reader";
import type {
  FetchMetaOptions,
  SiteMeta,
  SiteMetaFetcher,
} from "@sites/types";
import { devLog } from "@utils/devLog";
import findIndex from "lodash/findIndex";
import { ofType } from "redux-observable";
import { defer, EMPTY, from, merge, type Observable, of } from "rxjs";
import {
  catchError,
  defaultIfEmpty,
  filter as rxFilter,
  finalize,
  map as rxMap,
  mergeMap,
  switchMap,
} from "rxjs/operators";

import type { AppEpic, EpicAction } from "../types";

type ReaderChapterAction = {
  chapter: string;
};

type ReaderIndexAction = {
  index: number;
};

type ReaderRangeAction = {
  begin: number;
  end: number;
};

type ReaderChapterPayload = {
  chapterID: string;
  seriesID: string;
  comicUrl: string;
  imgList: ComicsImageSource[];
  canPreloadPreviousChapter?: boolean;
};

type ReaderFlowConfig = {
  site: SiteKey;
  baseURL: string;
  fetchChapterImages$: (
    chapterID: string,
  ) => Observable<ReaderChapterPayload>;
  fetchMeta$: SiteMetaFetcher;
  onMetaLoaded?: (payload: ReaderChapterPayload, meta: SiteMeta) => void;
  resolveFetchMetaOptions$?: (
    payload: ReaderChapterPayload,
  ) => Observable<FetchMetaOptions>;
};

export function normalizeReaderSiteMeta(meta: SiteMeta): SiteMeta {
  const chapterList = uniqueStrings(meta.chapterList);
  if (chapterList.length === meta.chapterList.length) {
    return meta;
  }
  return {
    ...meta,
    chapterList,
  };
}

export function getRequestedImageIds(input: {
  begin: number;
  end: number;
  result: number[];
}) {
  const { begin, end, result } = input;
  if (result.length === 0) {
    return [];
  }

  const startIndex = Math.max(0, begin);
  const endIndex = Math.min(result.length - 1, end);
  if (startIndex > endIndex) {
    return [];
  }

  const requestedIds: number[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const imageId = result[index];
    if (typeof imageId === "number") {
      requestedIds.push(imageId);
    }
  }
  return requestedIds;
}

function hasLoadedChapter(input: {
  imageList: {
    result: number[];
    entity: Record<number, { chapter?: string }>;
  };
  chapterID: string;
}) {
  const { imageList, chapterID } = input;
  if (!chapterID) {
    return false;
  }

  return imageList.result.some(
    (imageIndex) => imageList.entity[imageIndex]?.chapter === chapterID,
  );
}

function getCanPreloadPreviousChapter(payload: ReaderChapterPayload) {
  return payload.canPreloadPreviousChapter !== false;
}

function getReaderGeneration(state$: { value?: RootState }) {
  return Number(state$?.value?.comics?.readerGeneration || 0);
}

function getTailChapterID(input: {
  imageList: {
    result: number[];
    entity: Record<number, { chapter?: string }>;
  };
}) {
  const tailImageID = input.imageList.result[input.imageList.result.length - 1];
  return typeof tailImageID === "number"
    ? input.imageList.entity[tailImageID]?.chapter || ""
    : "";
}

function toReaderChapterTitles(
  chapters: SiteMeta["chapters"],
): Record<string, ComicsChapterRecord> {
  return Object.entries(chapters || {}).reduce<Record<string, ComicsChapterRecord>>(
    (acc, [chapterID, chapter]) => {
      if (!chapterID) {
        return acc;
      }
      acc[chapterID] = {
        title: chapter?.title || "",
      };
      return acc;
    },
    {},
  );
}

function buildInitialChapterActions(payload: ReaderChapterPayload): EpicAction[] {
  return [
    updateComicsID(payload.seriesID),
    concatImageList(payload.imgList),
    fetchImgSrc(0, 6),
  ];
}

function buildMetadataActions(input: {
  site: SiteKey;
  baseURL: string;
  payload: ReaderChapterPayload;
  meta: SiteMeta;
  seriesRead: string[];
  subscribed: boolean;
}) {
  const { site, baseURL, payload, meta, seriesRead, subscribed } = input;
  const canPreloadPreviousChapter = getCanPreloadPreviousChapter(payload);
  const chapterIndex = findIndex(
    meta.chapterList,
    (item) => item === payload.chapterID,
  );
  const actions: EpicAction[] = [
    updateSiteInfo(site, baseURL),
    updateComicsID(payload.seriesID),
    updateSubscribe(subscribed),
    updateTitle(meta.title || ""),
    updateReadChapters(seriesRead),
    updateChapters(toReaderChapterTitles(meta.chapters)),
    updateChapterList(meta.chapterList),
    updateChapterNowIndex(chapterIndex),
    updateCanPreloadPreviousChapter(canPreloadPreviousChapter),
  ];

  if (chapterIndex > 0 && canPreloadPreviousChapter) {
    actions.push(
      updateChapterLatestIndex(chapterIndex),
      fetchImgList(chapterIndex - 1),
    );
    return actions;
  }

  actions.push(updateChapterLatestIndex(chapterIndex - 1));
  return actions;
}

export function createDirectFetchImgSrcEpic(): AppEpic {
  return (action$, state$) =>
    action$.pipe(
      ofType(FETCH_IMAGE_SRC),
      mergeMap((action) => {
        const { begin, end } = action as ReaderRangeAction;
        const { result, entity } = state$.value.comics.imageList;
        return from(getRequestedImageIds({ begin, end, result })).pipe(
          rxFilter(
            (item) =>
              entity[item].loading &&
              entity[item].type !== "end",
          ),
          rxMap((id) => loadImgSrc(entity[id].requestSrc, id)),
        );
      }),
    );
}

export function createFetchImgListEpic(
  fetchChapterImages$: ReaderFlowConfig["fetchChapterImages$"],
): AppEpic {
  const inFlightChapterRequests = new Set<string>();

  return (action$, state$) =>
    action$.pipe(
      ofType(FETCH_IMG_LIST),
      mergeMap((action) => {
        const { index } = action as ReaderIndexAction;
        const {
          chapterList,
          imageList,
          pendingChapterGate,
        } = state$.value.comics;
        const readerGeneration = getReaderGeneration(state$);
        const chapterID = String(chapterList[index] || "");
        const requestKey = `${readerGeneration}:${chapterID}`;
        const hasExistingImages = imageList.result.length > 0;
        const blockingChapterId = hasExistingImages
          ? getTailChapterID({ imageList })
          : "";
        const pendingGate =
          hasExistingImages && blockingChapterId
            ? {
                blockingChapterId,
                chapterId: chapterID,
                chapterIndex: index,
                readerGeneration,
                status: "fetching" as const,
              }
            : null;

        if (
          !chapterID ||
          pendingChapterGate?.readerGeneration === readerGeneration ||
          inFlightChapterRequests.has(requestKey) ||
          hasLoadedChapter({ imageList, chapterID })
        ) {
          return EMPTY;
        }

        const fetchChapterImagesResult$ = fetchChapterImages$(chapterID).pipe(
          defaultIfEmpty(null),
          mergeMap((payload) => {
            if (getReaderGeneration(state$) !== readerGeneration) {
              return EMPTY;
            }
            if (!payload || payload.imgList.length === 0) {
              return pendingGate ? [clearPendingChapterGate()] : [];
            }
            const latestComics = state$.value.comics;
            const latestImageList = latestComics.imageList;
            const resolvedChapterIndex = latestComics.chapterList.indexOf(
              chapterID,
            );
            if (resolvedChapterIndex < 0) {
              return pendingGate ? [clearPendingChapterGate()] : [];
            }
            if (
              hasLoadedChapter({
                imageList: latestImageList,
                chapterID,
              })
            ) {
              return [
                ...(pendingGate ? [clearPendingChapterGate()] : []),
                updateChapterLatestIndex(resolvedChapterIndex),
              ];
            }

            if (!pendingGate) {
              const actions: EpicAction[] = [
                concatImageList(payload.imgList),
                updateCanPreloadPreviousChapter(
                  getCanPreloadPreviousChapter(payload),
                ),
              ];
              if (latestImageList.result.length === 0) {
                actions.push(fetchImgSrc(0, 6));
              }
              return [
                ...actions,
                updateChapterLatestIndex(resolvedChapterIndex),
              ];
            }

            return [
              receivePendingChapterGate({
                ...pendingGate,
                chapterIndex: resolvedChapterIndex,
                canPreloadPreviousChapter:
                  getCanPreloadPreviousChapter(payload),
                imgList: payload.imgList,
                status: "queued",
              }),
              updateChapterLatestIndex(resolvedChapterIndex),
            ];
          }),
          catchError(() =>
            pendingGate && getReaderGeneration(state$) === readerGeneration
              ? of(clearPendingChapterGate())
              : EMPTY,
          ),
          finalize(() => {
            inFlightChapterRequests.delete(requestKey);
          }),
        );

        inFlightChapterRequests.add(requestKey);
        if (!pendingGate) {
          return fetchChapterImagesResult$;
        }

        return merge(
          of(startPendingChapterGate(pendingGate)),
          fetchChapterImagesResult$,
        );
      }),
    );
}

export function createFetchChapterEpic(config: ReaderFlowConfig): AppEpic {
  const resolveFetchMetaOptions$ =
    config.resolveFetchMetaOptions$ || (() => of({}));

  return (action$, state$) =>
    action$.pipe(
      ofType(FETCH_CHAPTER),
      switchMap((action) => {
        const { chapter: chapterID } = action as ReaderChapterAction;
        const readerGeneration = getReaderGeneration(state$);
        return defer(() => config.fetchChapterImages$(chapterID)).pipe(
          defaultIfEmpty(null),
          catchError((error: unknown) => {
            devLog("reader:fetchChapter:error", {
              chapterID,
              reason: error instanceof Error ? error.message : String(error),
              site: config.site,
            });
            return of(null);
          }),
          mergeMap((payload) => {
            if (getReaderGeneration(state$) !== readerGeneration) {
              return EMPTY;
            }
            if (!payload) {
              return of(setChapterLoadFailed());
            }
            return merge(
              of(...buildInitialChapterActions(payload)),
              defer(() => resolveFetchMetaOptions$(payload)).pipe(
                mergeMap((fetchMetaOptions) =>
                  config.fetchMeta$(payload.comicUrl, fetchMetaOptions),
                ),
                mergeMap((rawMeta) => {
                  const meta = normalizeReaderSiteMeta(rawMeta);
                  config.onMetaLoaded?.(payload, meta);
                  return from(
                    applyReaderSeriesState(
                      config.site,
                      payload.seriesID,
                      {
                        title: meta.title || "",
                        chapters: meta.chapters,
                        chapterList: meta.chapterList,
                        cover: meta.cover,
                        url: payload.comicUrl,
                      },
                      payload.chapterID,
                    ),
                  ).pipe(
                    mergeMap(({ readChapterIDs, subscribed, updatesCount }) => {
                      if (getReaderGeneration(state$) !== readerGeneration) {
                        return EMPTY;
                      }
                      chrome.action.setBadgeText({
                        text: `${updatesCount === 0 ? "" : updatesCount}`,
                      });
                      return buildMetadataActions({
                        site: config.site,
                        baseURL: config.baseURL,
                        payload,
                        meta,
                        seriesRead: readChapterIDs,
                        subscribed,
                      });
                    }),
                  );
                }),
                catchError((error: unknown) => {
                  devLog("reader:fetchMetadata:error", {
                    chapterID: payload.chapterID,
                    reason:
                      error instanceof Error ? error.message : String(error),
                    seriesID: payload.seriesID,
                    site: config.site,
                  });
                  return EMPTY;
                }),
              ),
            );
          }),
        );
      }),
    );
}

export function createUpdateReadEpic(site: SiteKey): AppEpic {
  return (action$, state$) =>
    action$.pipe(
      ofType(UPDATE_READ),
      switchMap((action) => {
        const { index } = action as ReaderIndexAction;
        const { comicsID, chapterList } = state$.value.comics;
        const readerGeneration = getReaderGeneration(state$);

        return from(applyReadProgress(site, comicsID, chapterList[index])).pipe(
          mergeMap(({ readChapterIDs, updatesCount }) => {
            if (getReaderGeneration(state$) !== readerGeneration) {
              return EMPTY;
            }
            chrome.action.setBadgeText({
              text: `${updatesCount === 0 ? "" : updatesCount}`,
            });
            return [updateReadChapters(readChapterIDs)];
          }),
          catchError(() => EMPTY),
        );
      }),
    );
}
