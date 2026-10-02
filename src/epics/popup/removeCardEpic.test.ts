import {
  requestCleanupUnsubscribedSeries,
  requestRemoveCard,
} from "@domain/actions/popup";
import {
  finishLibraryRemoval,
  hydratePopupFeed,
  setLibrarySyncStatus,
  setPopupNotice,
} from "@domain/reducers/popupState";
import type { PopupFeedSnapshot } from "@infra/services/library/models";
import { lastValueFrom, of } from "rxjs";
import { toArray } from "rxjs/operators";

import removeCardEpic from "./removeCardEpic";

jest.mock("@infra/services/library/popup", () => {
  const actual = jest.requireActual("@infra/services/library/popup");
  return {
    ...actual,
    dismissSeriesUpdate: jest.fn(),
    getPopupFeedSnapshot: jest.fn(),
    pushLibrarySyncIfEnabled: jest.fn(),
    removeSeriesFromHistory: jest.fn(),
    removeSeriesCascade: jest.fn(),
    setSeriesSubscription: jest.fn(),
    unsubscribeSeriesByKey: jest.fn(),
    cleanupUnsubscribedSeries: jest.fn(),
  };
});

const {
  dismissSeriesUpdate,
  getPopupFeedSnapshot,
  pushLibrarySyncIfEnabled,
  removeSeriesCascade,
  removeSeriesFromHistory,
  unsubscribeSeriesByKey,
  cleanupUnsubscribedSeries,
} = jest.requireMock("@infra/services/library/popup");

const librarySyncStatus = {
  enabled: false,
  available: true,
  quotaBytes: 92160,
};

describe("removeCardEpic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).chrome = {
      action: { setBadgeText: jest.fn() },
    };
    pushLibrarySyncIfEnabled.mockResolvedValue(librarySyncStatus);
  });

  it("removes update card and rehydrates popup state", async () => {
    const nextFeed: PopupFeedSnapshot = {
      update: [
        {
          category: "update",
          key: "update_dm5:c2_ch2",
          index: 0,
          site: "dm5",
          siteLabel: "DM5",
          comicsID: "c2",
          chapterID: "ch2",
          lastReadChapterID: "",
          lastChapterID: "ch2",
          updateChapterID: "ch2",
          continueChapterID: "ch2",
          title: "B",
          url: "",
          cover: "",
          lastReadTitle: "Not started",
          lastReadHref: "",
          lastChapterTitle: "Ch2",
          lastChapterHref: "",
          updateChapterTitle: "Ch2",
          updateChapterHref: "",
          continueHref: "",
        },
      ],
      subscribe: [],
      history: [],
      continueReading: null,
    };
    dismissSeriesUpdate.mockResolvedValue(1);
    getPopupFeedSnapshot.mockResolvedValue(nextFeed);

    const actions = await lastValueFrom(
      removeCardEpic(
        of(
          requestRemoveCard({
            category: "update",
            index: "0",
            comicsID: "c1",
            chapterID: "ch1",
            site: "dm5",
          }),
        ),
        {
          value: undefined as never,
        },
      ).pipe(toArray()),
    );

    expect(actions).toEqual([
      hydratePopupFeed(nextFeed, "load"),
      setLibrarySyncStatus(librarySyncStatus),
      finishLibraryRemoval(),
    ]);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "1" });
  });

  it("removes only history entries for history cards", async () => {
    const nextFeed: PopupFeedSnapshot = {
      update: [],
      subscribe: [
        {
          category: "subscribe",
          key: "subscribe_dm5:c1_0",
          index: 0,
          site: "dm5",
          siteLabel: "DM5",
          comicsID: "c1",
          chapterID: "",
          lastReadChapterID: "m1",
          lastChapterID: "m2",
          updateChapterID: "",
          continueChapterID: "m1",
          title: "Demo",
          url: "",
          cover: "",
          lastReadTitle: "Ch1",
          lastReadHref: "",
          lastChapterTitle: "Ch2",
          lastChapterHref: "",
          updateChapterTitle: "",
          updateChapterHref: "",
          continueHref: "",
        },
      ],
      history: [],
      continueReading: null,
    };
    removeSeriesFromHistory.mockResolvedValue(undefined);
    getPopupFeedSnapshot.mockResolvedValue(nextFeed);

    const actions = await lastValueFrom(
      removeCardEpic(
        of(
          requestRemoveCard({
            category: "history",
            index: 0,
            comicsID: "c1",
            site: "dm5",
          }),
        ),
        { value: undefined as never },
      ).pipe(toArray()),
    );

    expect(removeSeriesFromHistory).toHaveBeenCalledWith("dm5", "c1");
    expect(removeSeriesCascade).not.toHaveBeenCalled();
    expect(actions).toEqual([
      hydratePopupFeed(nextFeed, "load"),
      setLibrarySyncStatus(librarySyncStatus),
      finishLibraryRemoval(),
    ]);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
  });

  it("removes tracking without cascade delete by default", async () => {
    const nextFeed: PopupFeedSnapshot = {
      update: [],
      subscribe: [],
      history: [
        {
          category: "history",
          key: "history_dm5:c1_0",
          index: 0,
          site: "dm5",
          siteLabel: "DM5",
          comicsID: "c1",
          chapterID: "",
          lastReadChapterID: "m1",
          lastChapterID: "m2",
          updateChapterID: "",
          continueChapterID: "m1",
          title: "Demo",
          url: "",
          cover: "",
          lastReadTitle: "Ch1",
          lastReadHref: "",
          lastChapterTitle: "Ch2",
          lastChapterHref: "",
          updateChapterTitle: "",
          updateChapterHref: "",
          continueHref: "",
        },
      ],
      continueReading: null,
    };
    unsubscribeSeriesByKey.mockResolvedValue(0);
    dismissSeriesUpdate.mockResolvedValue(0);
    getPopupFeedSnapshot.mockResolvedValue(nextFeed);

    await lastValueFrom(
      removeCardEpic(
        of(
          requestRemoveCard({
            category: "subscribe",
            index: 0,
            comicsID: "c1",
            site: "dm5",
          }),
        ),
        { value: undefined as never },
      ).pipe(toArray()),
    );

    expect(unsubscribeSeriesByKey).toHaveBeenCalledWith("dm5:c1", {
      clearSeriesData: false,
    });
    expect(dismissSeriesUpdate).not.toHaveBeenCalled();
    expect(removeSeriesCascade).not.toHaveBeenCalled();
  });

  it("runs cascade delete when unsubscribe requests data clearing", async () => {
    const nextFeed: PopupFeedSnapshot = {
      update: [],
      subscribe: [],
      history: [],
      continueReading: null,
    };
    unsubscribeSeriesByKey.mockResolvedValue(0);
    getPopupFeedSnapshot.mockResolvedValue(nextFeed);

    await lastValueFrom(
      removeCardEpic(
        of(
          requestRemoveCard({
            category: "subscribe",
            index: 0,
            comicsID: "c1",
            clearSeriesData: true,
            site: "dm5",
          }),
        ),
        { value: undefined as never },
      ).pipe(toArray()),
    );

    expect(unsubscribeSeriesByKey).toHaveBeenCalledWith("dm5:c1", {
      clearSeriesData: true,
    });
  });

  it("surfaces a notice when removing history fails", async () => {
    removeSeriesFromHistory.mockRejectedValue(new Error("boom"));

    const actions = await lastValueFrom(
      removeCardEpic(
        of(
          requestRemoveCard({
            category: "history",
            index: 0,
            comicsID: "c1",
            site: "dm5",
          }),
        ),
        { value: undefined as never },
      ).pipe(toArray()),
    );

    expect(actions).toEqual([
      finishLibraryRemoval(),
      setPopupNotice("移除閱讀紀錄失敗，請稍後再試。"),
    ]);
  });

  it.each([0, 3])(
    "reports the actual batch cleanup count (%s)",
    async (removedSeriesCount) => {
      const feed = {
        update: [],
        subscribe: [],
        history: [],
        continueReading: null,
      };
      cleanupUnsubscribedSeries.mockResolvedValue({
        removedSeriesCount,
        updatesCount: 0,
      });
      getPopupFeedSnapshot.mockResolvedValue(feed);
      const actions = await lastValueFrom(
        removeCardEpic(of(requestCleanupUnsubscribedSeries()), {
          value: undefined as never,
        }).pipe(toArray()),
      );
      expect(cleanupUnsubscribedSeries).toHaveBeenCalledTimes(1);
      expect(pushLibrarySyncIfEnabled).toHaveBeenCalledTimes(1);
      expect(actions).toEqual([
        hydratePopupFeed(feed, "load"),
        setLibrarySyncStatus(librarySyncStatus),
        finishLibraryRemoval(),
        setPopupNotice(
          removedSeriesCount
            ? "已清理 3 部未追蹤作品。"
            : "沒有需要清理的未追蹤作品。",
          "success",
        ),
      ]);
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    },
  );

  it("reports batch failure without pushing sync", async () => {
    cleanupUnsubscribedSeries.mockRejectedValueOnce(new Error("storage"));
    const actions = await lastValueFrom(
      removeCardEpic(of(requestCleanupUnsubscribedSeries()), {
        value: undefined as never,
      }).pipe(toArray()),
    );
    expect(actions).toEqual([
      finishLibraryRemoval(),
      setPopupNotice("清理未追蹤作品失敗，請稍後再試。"),
    ]);
    expect(pushLibrarySyncIfEnabled).not.toHaveBeenCalled();
  });

  it("still rehydrates and reports local cleanup when the sync attempt rejects", async () => {
    const feed = {
      update: [],
      subscribe: [],
      history: [],
      continueReading: null,
    };
    cleanupUnsubscribedSeries.mockResolvedValue({
      removedSeriesCount: 2,
      updatesCount: 0,
    });
    getPopupFeedSnapshot.mockResolvedValue(feed);
    pushLibrarySyncIfEnabled.mockRejectedValueOnce(new Error("sync"));
    const actions = await lastValueFrom(
      removeCardEpic(of(requestCleanupUnsubscribedSeries()), {
        value: undefined as never,
      }).pipe(toArray()),
    );
    expect(actions).toContainEqual(hydratePopupFeed(feed, "load"));
    expect(actions).toContainEqual(
      setPopupNotice("已清理 2 部未追蹤作品。", "success"),
    );
    expect(actions).toContainEqual(
      expect.objectContaining({
        type: "SET_LIBRARY_SYNC_STATUS",
        syncStatus: expect.objectContaining({
          lastError: "同步失敗，請稍後再試。",
        }),
      }),
    );
  });
});
