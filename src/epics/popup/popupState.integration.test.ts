import { configureStore, Tuple } from "@reduxjs/toolkit";
import { createEpicMiddleware } from "redux-observable";
import popupReducer from "@domain/reducers/popup";
import popupEpic from "@epics/popup";
import type { EpicAction, PopupRootState } from "@epics/types";
import { requestPopupData } from "@domain/actions/popup";

jest.mock("@infra/services/library", () => ({
  createEmptyPopupFeedSnapshot: jest.fn(() => ({
    update: [],
    subscribe: [],
    history: [],
    continueReading: null,
  })),
  getPopupFeedSnapshot: jest.fn(),
  exportLibraryDump: jest.fn(),
  importLibraryDump: jest.fn(),
  resetLibrary: jest.fn(),
  subscribeToLibrarySignal: jest.fn(() => () => undefined),
}));

const { getPopupFeedSnapshot } = jest.requireMock("@infra/services/library");

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
        hydrationStatus: "ready",
        activeAction: null,
        notice: null,
        exportUrl: "",
        exportFilename: "",
      },
    });
  });
});
