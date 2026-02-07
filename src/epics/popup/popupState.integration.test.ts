import { configureStore, Tuple } from "@reduxjs/toolkit";
import { createEpicMiddleware } from "redux-observable";
import popupReducer from "@domain/reducers/popup";
import popupEpic from "@epics/popup";
import { requestPopupData } from "@domain/actions/popup";

jest.mock("@utils/initObject", () => ({
  __esModule: true,
  default: {
    history: [],
    subscribe: [],
    update: [],
    dm5: {},
    sf: {},
    comicbus: {},
    version: "0.0.0",
  },
}));

jest.mock("@infra/services/storage", () => ({
  storageGet: jest.fn(),
  storageSet: jest.fn(),
  storageClear: jest.fn(),
}));

const { storageGet } = jest.requireMock("@infra/services/storage");

describe("popup state integration", () => {
  it("hydrates popup state from storage", async () => {
    const data = {
      update: [
        {
          site: "dm5",
          comicsID: "123",
          chapterID: "m1",
          updateChapter: { title: "Ch 1", href: "https://dm5.com/m1" },
        },
      ],
      subscribe: [
        {
          site: "dm5",
          comicsID: "123",
        },
      ],
      history: [
        {
          site: "dm5",
          comicsID: "123",
        },
      ],
      dm5: {
        baseURL: "https://www.dm5.com",
        "123": {
          title: "Demo",
          cover: "cover.jpg",
          url: "https://www.dm5.com/123/",
          lastRead: "m1",
          chapters: {
            m1: { title: "Ch 1", href: "https://dm5.com/m1" },
          },
          chapterList: ["m1"],
          read: ["m1"],
        },
      },
      sf: { baseURL: "http://comic.sfacg.com" },
      comicbus: { baseURL: "http://www.comicbus.com" },
    };

    storageGet.mockImplementation((keys: any, cb?: any) => {
      if (typeof keys === "function") return keys(data);
      return cb?.(data);
    });

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
