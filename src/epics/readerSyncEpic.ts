import { fetchImgList } from "@domain/actions/reader";
import { uniqueStrings } from "@domain/library";
import type { RootState } from "@domain/reducers";
import {
  syncReaderSeriesState,
  updateChapterLatestIndex,
  updateSubscribe,
} from "@domain/reducers/comics";
import {
  getReaderSeriesState,
  getReaderSeriesSyncState,
  subscribeToLibrarySignal,
} from "@infra/services/library/reader";
import { devLog } from "@utils/devLog";
import { closeCurrentTab } from "@utils/navigation";
import { EMPTY, from, merge, of } from "rxjs";
import {
  catchError,
  filter,
  map,
  share,
  switchMap,
} from "rxjs/operators";

import { observeLibrarySignals } from "./librarySignal";
import type { AppEpic, EpicAction } from "./types";

type ReaderLibrarySignal = Parameters<
  Parameters<typeof subscribeToLibrarySignal>[0]
>[0];

export function isReaderLibrarySignalRelevant(
  signal: ReaderLibrarySignal,
  seriesKey: string,
) {
  if (!seriesKey || !signal || !Array.isArray(signal.scopes)) {
    return false;
  }

  const seriesKeys = Array.isArray(signal.seriesKeys) ? signal.seriesKeys : [];
  return (
    seriesKeys.length === 0 ||
    seriesKeys.includes(seriesKey) ||
    signal.scopes.includes("subscriptions")
  );
}

function closeMissingSeries() {
  return from(closeCurrentTab()).pipe(
    catchError((error: unknown) => {
      devLog("reader:close-missing-series-failed", error);
      return EMPTY;
    }),
    switchMap(() => EMPTY),
  );
}

function getLiveChapterList(
  comics: RootState["comics"],
  incomingChapterList: string[],
) {
  const currentChapterID = comics.chapterList[comics.chapterNowIndex] || "";
  const loadedChapterIDs = new Set(
    comics.imageList.result
      .map((imageID) => comics.imageList.entity[imageID]?.chapter || "")
      .filter(Boolean),
  );
  if (currentChapterID) {
    loadedChapterIDs.add(currentChapterID);
  }
  if (comics.pendingChapterGate?.chapterId) {
    loadedChapterIDs.add(comics.pendingChapterGate.chapterId);
  }
  if (comics.pendingChapterGate?.blockingChapterId) {
    loadedChapterIDs.add(comics.pendingChapterGate.blockingChapterId);
  }
  return uniqueStrings([
    ...incomingChapterList,
    ...comics.chapterList.filter(
      (chapterID) =>
        loadedChapterIDs.has(chapterID) &&
        !incomingChapterList.includes(chapterID),
    ),
  ]);
}

function getLiveChapterPreloadActions(
  comics: RootState["comics"],
  chapterList: string[],
): EpicAction[] {
  if (
    comics.pendingChapterGate ||
    !comics.canPreloadPreviousChapter ||
    comics.chapterList.length === 0
  ) {
    return [];
  }

  const previousFrontierIndex =
    comics.chapterLatestIndex >= 0 ? comics.chapterLatestIndex : 0;
  const frontierChapterID = comics.chapterList[previousFrontierIndex] || "";
  const nextFrontierIndex = chapterList.indexOf(frontierChapterID);
  if (nextFrontierIndex <= previousFrontierIndex) {
    return [];
  }

  const preloadIndex = nextFrontierIndex - 1;
  const preloadChapterID = chapterList[preloadIndex] || "";
  const alreadyLoaded = comics.imageList.result.some(
    (imageID) =>
      comics.imageList.entity[imageID]?.chapter === preloadChapterID,
  );
  if (!preloadChapterID || alreadyLoaded) {
    return [];
  }

  return [fetchImgList(preloadIndex), updateChapterLatestIndex(preloadIndex)];
}

const readerSyncEpic: AppEpic = (_action$, state$) => {
  const relevantSignal$ = observeLibrarySignals(subscribeToLibrarySignal).pipe(
    map((signal) => ({
      signal,
      seriesKey: String(state$.value.comics.seriesKey || ""),
    })),
    filter(({ signal, seriesKey }) =>
      isReaderLibrarySignalRelevant(signal, seriesKey),
    ),
    share(),
  );

  const chapterSync$ = relevantSignal$.pipe(
    filter(({ signal }) => signal.scopes.includes("chapters")),
    switchMap(({ seriesKey }) =>
      from(getReaderSeriesState(seriesKey)).pipe(
        switchMap(({ series, subscribed }) => {
          if (state$.value.comics.seriesKey !== seriesKey) {
            return EMPTY;
          }
          if (!series) {
            return closeMissingSeries();
          }

          const comics = state$.value.comics;
          const chapterList = getLiveChapterList(comics, series.chapterList);
          const chapters = Object.fromEntries(
            Object.entries(series.chapters).map(([chapterID, chapter]) => [
              chapterID,
              { title: chapter.title || "" },
            ]),
          );
          return from([
            syncReaderSeriesState({
              title: series.title || "",
              chapterList: series.chapterList,
              chapters,
              read: series.read,
              subscribed,
            }),
            ...getLiveChapterPreloadActions(comics, chapterList),
          ] as EpicAction[]);
        }),
        catchError((error: unknown) => {
          devLog("reader:library-sync-failed", error);
          return EMPTY;
        }),
      ),
    ),
  );

  const stateSync$ = relevantSignal$.pipe(
    filter(({ signal }) => !signal.scopes.includes("chapters")),
    switchMap(({ seriesKey }) =>
      from(getReaderSeriesSyncState(seriesKey)).pipe(
        switchMap(({ exists, subscribed }) => {
          if (state$.value.comics.seriesKey !== seriesKey) {
            return EMPTY;
          }
          if (exists) {
            return of(updateSubscribe(subscribed));
          }
          return closeMissingSeries();
        }),
        catchError((error: unknown) => {
          devLog("reader:library-sync-failed", error);
          return EMPTY;
        }),
      ),
    ),
  );

  return merge(chapterSync$, stateSync$);
};

export default readerSyncEpic;
