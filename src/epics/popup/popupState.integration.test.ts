import {
  requestPopupData,
  requestRemoveCard,
} from "@domain/actions/popup";
import popupReducer from "@domain/reducers/popup";
import popupEpic from "@epics/popup";
import type { EpicAction, PopupRootState } from "@epics/types";
import { configureStore, Tuple } from "@reduxjs/toolkit";
import { createEpicMiddleware } from "redux-observable";

jest.mock("@infra/services/library/popup", () => ({
  getPopupFeedSnapshot: jest.fn(),
  exportLibraryDump: jest.fn(),
  importLibraryDump: jest.fn(),
  removeSeriesFromHistory: jest.fn(),
  resetLibrary: jest.fn(),
  subscribeToLibrarySignal: jest.fn(() => () => undefined),
}));
jest.mock("@infra/services/extensionRelease", () => ({
  getExtensionReleaseNotice: jest.fn(() => Promise.resolve(null)),
  dismissExtensionReleaseNotice: jest.fn(() => Promise.resolve()),
  subscribeToExtensionReleaseState: jest.fn(() => () => undefined),
}));

const { getPopupFeedSnapshot, removeSeriesFromHistory } = jest.requireMock(
  "@infra/services/library/popup",
);

describe("popup state integration", () => {
  it("hydrates popup state from storage", async () => {
    const data = {
      update: [
        {
          category: "update",
          key: "update_dm5:m123_m1",
          index: 0,
          site: "dm5",
          siteLabel: "DM5",
          comicsID: "m123",
          chapterID: "m1",
          lastReadChapterID: "m1",
          lastChapterID: "m1",
          updateChapterID: "m1",
          continueChapterID: "m1",
          title: "Demo",
          url: "https://www.dm5.com/m123/",
          cover: "cover.jpg",
          lastReadTitle: "Ch 1",
          lastReadHref: "https://dm5.com/m1",
          lastChapterTitle: "Ch 1",
          lastChapterHref: "https://dm5.com/m1",
          updateChapterTitle: "Ch 1",
          updateChapterHref: "https://dm5.com/m1",
          continueHref: "https://dm5.com/m1",
        },
      ],
      subscribe: [
        {
          category: "subscribe",
          key: "subscribe_dm5:m123_0",
          index: 0,
          site: "dm5",
          siteLabel: "DM5",
          comicsID: "m123",
          chapterID: "",
          lastReadChapterID: "m1",
          lastChapterID: "m1",
          updateChapterID: "",
          continueChapterID: "m1",
          title: "Demo",
          url: "https://www.dm5.com/m123/",
          cover: "cover.jpg",
          lastReadTitle: "Ch 1",
          lastReadHref: "https://dm5.com/m1",
          lastChapterTitle: "Ch 1",
          lastChapterHref: "https://dm5.com/m1",
          updateChapterTitle: "",
          updateChapterHref: "",
          continueHref: "https://dm5.com/m1",
        },
      ],
      history: [
        {
          category: "history",
          key: "history_dm5:m123_0",
          index: 0,
          site: "dm5",
          siteLabel: "DM5",
          comicsID: "m123",
          chapterID: "",
          lastReadChapterID: "m1",
          lastChapterID: "m1",
          updateChapterID: "",
          continueChapterID: "m1",
          title: "Demo",
          url: "https://www.dm5.com/m123/",
          cover: "cover.jpg",
          lastReadTitle: "Ch 1",
          lastReadHref: "https://dm5.com/m1",
          lastChapterTitle: "Ch 1",
          lastChapterHref: "https://dm5.com/m1",
          updateChapterTitle: "",
          updateChapterHref: "",
          continueHref: "https://dm5.com/m1",
        },
      ],
      continueReading: {
        category: "history",
        key: "history_dm5:m123_0",
        index: 0,
        site: "dm5",
        siteLabel: "DM5",
        comicsID: "m123",
        chapterID: "",
        lastReadChapterID: "m1",
        lastChapterID: "m1",
        updateChapterID: "",
        continueChapterID: "m1",
        title: "Demo",
        url: "https://www.dm5.com/m123/",
        cover: "cover.jpg",
        lastReadTitle: "Ch 1",
        lastReadHref: "https://dm5.com/m1",
        lastChapterTitle: "Ch 1",
        lastChapterHref: "https://dm5.com/m1",
        updateChapterTitle: "",
        updateChapterHref: "",
        continueHref: "https://dm5.com/m1",
      },
    };

    getPopupFeedSnapshot.mockResolvedValue(data);

    const epicMiddleware = createEpicMiddleware<
      EpicAction,
      EpicAction,
      PopupRootState
    >();
    const store = configureStore({
      reducer: popupReducer,
      middleware: () => new Tuple(epicMiddleware),
    });
    epicMiddleware.run(popupEpic);
    store.dispatch(requestPopupData());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getState()).toEqual({
      popup: {
        feed: data,
        extensionReleaseNotice: null,
        hydrationStatus: "ready",
        activeAction: null,
        notice: null,
        exportUrl: "",
        exportFilename: "",
      },
    });
  });

  it("clears the loading state and shows a notice when popup hydration fails", async () => {
    getPopupFeedSnapshot.mockRejectedValue(new Error("boom"));

    const epicMiddleware = createEpicMiddleware<
      EpicAction,
      EpicAction,
      PopupRootState
    >();
    const store = configureStore({
      reducer: popupReducer,
      middleware: () => new Tuple(epicMiddleware),
    });
    epicMiddleware.run(popupEpic);
    store.dispatch(requestPopupData());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getState()).toEqual({
      popup: {
        feed: {
          update: [],
          subscribe: [],
          history: [],
          continueReading: null,
        },
        extensionReleaseNotice: null,
        hydrationStatus: "ready",
        activeAction: null,
        notice: {
          tone: "error",
          message: "目前無法載入書庫資料，請稍後再試。",
        },
        exportUrl: "",
        exportFilename: "",
      },
    });
  });

  it("clears the remove busy state and shows a notice when removal fails", async () => {
    removeSeriesFromHistory.mockRejectedValue(new Error("boom"));

    const epicMiddleware = createEpicMiddleware<
      EpicAction,
      EpicAction,
      PopupRootState
    >();
    const store = configureStore({
      reducer: popupReducer,
      middleware: () => new Tuple(epicMiddleware),
    });
    epicMiddleware.run(popupEpic);
    store.dispatch(
      requestRemoveCard({
        category: "history",
        index: 0,
        comicsID: "m123",
        site: "dm5",
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getState()).toEqual({
      popup: {
        feed: {
          update: [],
          subscribe: [],
          history: [],
          continueReading: null,
        },
        extensionReleaseNotice: null,
        hydrationStatus: "ready",
        activeAction: null,
        notice: {
          tone: "error",
          message: "移除閱讀紀錄失敗，請稍後再試。",
        },
        exportUrl: "",
        exportFilename: "",
      },
    });
  });
});
