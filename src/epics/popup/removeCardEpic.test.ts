import { requestRemoveCard } from "@domain/actions/popup";
import {
  hydratePopupFeed,
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
    removeSeriesFromHistory: jest.fn(),
    removeSeriesCascade: jest.fn(),
    setSeriesSubscription: jest.fn(),
  };
});

const {
  dismissSeriesUpdate,
  getPopupFeedSnapshot,
  removeSeriesCascade,
  removeSeriesFromHistory,
  setSeriesSubscription,
} = jest.requireMock("@infra/services/library/popup");

describe("removeCardEpic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).chrome = {
      action: { setBadgeText: jest.fn() },
    };
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

    expect(actions).toEqual([hydratePopupFeed(nextFeed, "load")]);
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
    expect(actions).toEqual([hydratePopupFeed(nextFeed, "load")]);
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
    setSeriesSubscription.mockResolvedValue(false);
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

    expect(setSeriesSubscription).toHaveBeenCalledWith("dm5", "c1", false);
    expect(dismissSeriesUpdate).toHaveBeenCalledWith("dm5", "c1");
    expect(removeSeriesCascade).not.toHaveBeenCalled();
  });

  it("runs cascade delete when unsubscribe requests data clearing", async () => {
    const nextFeed: PopupFeedSnapshot = {
      update: [],
      subscribe: [],
      history: [],
      continueReading: null,
    };
    removeSeriesCascade.mockResolvedValue(0);
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

    expect(removeSeriesCascade).toHaveBeenCalledWith("dm5", "c1");
    expect(setSeriesSubscription).not.toHaveBeenCalled();
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
      setPopupNotice("移除閱讀紀錄失敗，請稍後再試。"),
    ]);
  });
});
