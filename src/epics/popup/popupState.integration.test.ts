import { configureStore, Tuple } from "@reduxjs/toolkit";
import { createEpicMiddleware } from "redux-observable";
import popupReducer from "@domain/reducers/popup";
import popupEpic from "@epics/popup";
import { requestPopupData } from "@domain/actions/popup";

jest.mock("@infra/services/library", () => ({
  createEmptyLibrarySnapshot: jest.fn(() => ({
    schemaVersion: 2,
    version: "0.0.0",
    seriesByKey: {},
    subscriptions: [],
    history: [],
    updates: [],
  })),
  loadLibrary: jest.fn(),
  saveLibrary: jest.fn(),
  resetLibrary: jest.fn(),
  migrateLibrary: jest.fn((value) => value),
  subscribeToLibraryChanges: jest.fn(() => () => undefined),
}));

const { loadLibrary } = jest.requireMock("@infra/services/library");

describe("popup state integration", () => {
  it("hydrates popup state from storage", async () => {
    const data = {
      schemaVersion: 2,
      version: "0.0.0",
      updates: [
        { seriesKey: "dm5:m123", chapterID: "m1", createdAt: 1 },
      ],
      subscriptions: ["dm5:m123"],
      history: ["dm5:m123"],
      seriesByKey: {
        "dm5:m123": {
          site: "dm5",
          comicsID: "m123",
          title: "Demo",
          cover: "cover.jpg",
          url: "https://www.dm5.com/m123/",
          lastRead: "m1",
          chapters: {
            m1: { title: "Ch 1", href: "https://dm5.com/m1" },
          },
          chapterList: ["m1"],
          read: ["m1"],
        },
      },
    };

    loadLibrary.mockResolvedValue(data);

    const epicMiddleware = createEpicMiddleware();
    const store = configureStore({
      reducer: popupReducer,
      middleware: () => new Tuple(epicMiddleware),
    });
    epicMiddleware.run(popupEpic);
    store.dispatch(requestPopupData());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getState()).toMatchSnapshot();
  });
});
