import {
  FETCH_CHAPTER,
  FETCH_IMAGE_SRC,
  FETCH_IMG_LIST,
  fetchImgList,
  fetchImgSrc,
  UPDATE_READ,
} from "@domain/actions/reader";
import {
  type ComicsImageSource,
  concatImageList,
  loadImgSrc,
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
import type { SiteKey } from "@infra/services/library/schema";
import type {
  FetchMetaOptions,
  SiteMeta,
  SiteMetaFetcher,
} from "@sites/types";
import findIndex from "lodash/findIndex";
import { ofType } from "redux-observable";
import { from, merge, type Observable,of } from "rxjs";
import {
  filter as rxFilter,
  map as rxMap,
  mergeMap,
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

export type ReaderChapterPayload = {
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

function getCanPreloadPreviousChapter(payload: ReaderChapterPayload) {
  return payload.canPreloadPreviousChapter !== false;
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
    updateChapters(meta.chapters),
    updateChapterList(meta.chapterList),
    updateChapterNowIndex(chapterIndex),
    updateCanPreloadPreviousChapter(canPreloadPreviousChapter),
  ];

  if (chapterIndex > 0 && canPreloadPreviousChapter) {
    actions.push(
      fetchImgList(chapterIndex - 1),
      updateChapterLatestIndex(chapterIndex - 1),
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
        return from(result).pipe(
          rxFilter(
            (item) =>
              item >= begin &&
              item <= end &&
              entity[item].loading &&
              entity[item].type !== "end",
          ),
          rxMap((id) => loadImgSrc(entity[id].src, id)),
        );
      }),
    );
}

export function createFetchImgListEpic(
  fetchChapterImages$: ReaderFlowConfig["fetchChapterImages$"],
): AppEpic {
  return (action$, state$) =>
    action$.pipe(
      ofType(FETCH_IMG_LIST),
      mergeMap((action) => {
        const { index } = action as ReaderIndexAction;
        const { chapterList } = state$.value.comics;
        return fetchChapterImages$(chapterList[index]).pipe(
          mergeMap((payload) => {
            const hasExistingImages = state$.value.comics.imageList.result.length > 0;
            const actions: EpicAction[] = [
              concatImageList(payload.imgList),
              updateCanPreloadPreviousChapter(
                getCanPreloadPreviousChapter(payload),
              ),
            ];
            if (hasExistingImages) {
              return actions;
            }
            return [...actions, fetchImgSrc(0, 6)];
          }),
        );
      }),
    );
}

export function createFetchChapterEpic(config: ReaderFlowConfig): AppEpic {
  const resolveFetchMetaOptions$ =
    config.resolveFetchMetaOptions$ || (() => of({}));

  return (action$) =>
    action$.pipe(
      ofType(FETCH_CHAPTER),
      mergeMap((action) => {
        const { chapter: chapterID } = action as ReaderChapterAction;
        return config.fetchChapterImages$(chapterID).pipe(
          mergeMap((payload) =>
            merge(
              of(...buildInitialChapterActions(payload)),
              resolveFetchMetaOptions$(payload).pipe(
                mergeMap((fetchMetaOptions) =>
                  config.fetchMeta$(payload.comicUrl, fetchMetaOptions),
                ),
                mergeMap((meta) =>
                  {
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
                    mergeMap(({ series, subscribed, updatesCount }) => {
                      chrome.action.setBadgeText({
                        text: `${updatesCount === 0 ? "" : updatesCount}`,
                      });
                      return buildMetadataActions({
                        site: config.site,
                        baseURL: config.baseURL,
                        payload,
                        meta,
                        seriesRead: series?.read || [],
                        subscribed,
                      });
                    }),
                  );
                  },
                ),
              ),
            ),
          ),
        );
      }),
    );
}

export function createUpdateReadEpic(site: SiteKey): AppEpic {
  return (action$, state$) =>
    action$.pipe(
      ofType(UPDATE_READ),
      mergeMap((action) => {
        const { index } = action as ReaderIndexAction;
        const { comicsID, chapterList } = state$.value.comics;

        return from(applyReadProgress(site, comicsID, chapterList[index])).pipe(
          mergeMap(({ series, updatesCount }) => {
            chrome.action.setBadgeText({
              text: `${updatesCount === 0 ? "" : updatesCount}`,
            });
            return [
              updateReadChapters(series?.read || []),
              updateChapterNowIndex(index),
            ];
          }),
        );
      }),
    );
}
