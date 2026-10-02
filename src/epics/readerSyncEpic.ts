import {
  fetchImgList,
  invalidateReaderPersistence,
} from "@domain/actions/reader";
import type { RootState } from "@domain/reducers";
import {
  projectReaderSeriesState,
  syncReaderSeriesState,
  updateSubscribe,
} from "@domain/reducers/comics";
import {
  getReaderSeriesState,
  getReaderSeriesSyncState,
  subscribeToLibrarySignal,
} from "@infra/services/library/reader";
import { devLog } from "@utils/devLog";
import { closeCurrentTab } from "@utils/navigation";
import { concat, defer, EMPTY, from, of } from "rxjs";
import { catchError, filter, map, switchMap } from "rxjs/operators";

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

function closeMissingSeries(subscriptionPending: boolean) {
  return concat(
    of(invalidateReaderPersistence()),
    subscriptionPending
      ? EMPTY
      : defer(() => from(closeCurrentTab())).pipe(
          catchError((error: unknown) => {
            devLog("reader:close-missing-series-failed", error);
            return EMPTY;
          }),
          switchMap(() => EMPTY),
        ),
  );
}

function getLiveChapterPreloadActions(
  comics: RootState["comics"],
  projectedComics: RootState["comics"],
): EpicAction[] {
  if (
    comics.pendingChapterGate ||
    !comics.canPreloadPreviousChapter ||
    comics.chapterList.length === 0 ||
    comics.imageList.result.length === 0
  ) {
    return [];
  }

  const previousFrontierIndex =
    comics.chapterLatestIndex >= 0 ? comics.chapterLatestIndex : 0;
  const frontierChapterID = comics.chapterList[previousFrontierIndex] || "";
  const nextFrontierIndex =
    projectedComics.chapterList.indexOf(frontierChapterID);
  if (nextFrontierIndex <= previousFrontierIndex) {
    return [];
  }

  const preloadIndex = nextFrontierIndex - 1;
  const preloadChapterID = projectedComics.chapterList[preloadIndex] || "";
  const alreadyLoaded = comics.imageList.result.some(
    (imageID) =>
      comics.imageList.entity[imageID]?.chapter === preloadChapterID,
  );
  if (!preloadChapterID || alreadyLoaded) {
    return [];
  }

  return [fetchImgList(preloadIndex)];
}

const readerSyncEpic: AppEpic = (_action$, state$) => {
  let needsFullHydration = false;

  return observeLibrarySignals(subscribeToLibrarySignal).pipe(
    map((signal) => ({
      signal,
      seriesKey: String(state$.value.comics.seriesKey || ""),
    })),
    filter(({ signal, seriesKey }) =>
      isReaderLibrarySignalRelevant(signal, seriesKey),
    ),
    map(({ signal, seriesKey }) => {
      needsFullHydration =
        needsFullHydration || signal.scopes.includes("chapters");
      return { needsFullHydration, seriesKey };
    }),
    switchMap(({ needsFullHydration: shouldHydrate, seriesKey }) => {
      if (!shouldHydrate) {
        return defer(() => from(getReaderSeriesSyncState(seriesKey))).pipe(
          switchMap(({ exists, subscribed }) => {
            if (state$.value.comics.seriesKey !== seriesKey) {
              return EMPTY;
            }
            if (exists) {
              return of(updateSubscribe(subscribed));
            }
            return closeMissingSeries(
              Boolean(state$.value.comics.subscriptionPending),
            );
          }),
          catchError((error: unknown) => {
            devLog("reader:library-sync-failed", error);
            return EMPTY;
          }),
        );
      }

      return defer(() => from(getReaderSeriesState(seriesKey))).pipe(
        switchMap(({ series, subscribed }) => {
          if (state$.value.comics.seriesKey !== seriesKey) {
            return EMPTY;
          }

          needsFullHydration = false;
          if (!series) {
            return closeMissingSeries(
              Boolean(state$.value.comics.subscriptionPending),
            );
          }

          const comics = state$.value.comics;
          const readerSeries = {
            title: series.title || "",
            chapterList: series.chapterList,
            chapters: Object.fromEntries(
              Object.entries(series.chapters).map(([chapterID, chapter]) => [
                chapterID,
                { title: chapter.title || "" },
              ]),
            ),
            read: series.read,
            subscribed,
          };
          const projectedComics = projectReaderSeriesState(
            comics,
            readerSeries,
          );
          return from([
            syncReaderSeriesState(readerSeries),
            ...getLiveChapterPreloadActions(comics, projectedComics),
          ] as EpicAction[]);
        }),
        catchError((error: unknown) => {
          devLog("reader:library-sync-failed", error);
          return EMPTY;
        }),
      );
    }),
  );
};

export default readerSyncEpic;
