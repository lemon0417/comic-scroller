import { lastValueFrom, of } from "rxjs";
import { toArray } from "rxjs/operators";
import removeCardEpic from "./removeCardEpic";
import { requestRemoveCard } from "@domain/actions/popup";
import { hydratePopupFeed } from "@domain/reducers/popupState";
import type { PopupFeedSnapshot } from "@infra/services/library/models";

jest.mock("@infra/services/library", () => {
  const actual = jest.requireActual("@infra/services/library");
  return {
    ...actual,
    dismissSeriesUpdate: jest.fn(),
    getPopupFeedSnapshot: jest.fn(),
    removeSeriesCascade: jest.fn(),
    setSeriesSubscription: jest.fn(),
  };
});

const {
  dismissSeriesUpdate,
  getPopupFeedSnapshot,
} = jest.requireMock("@infra/services/library");

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
});
