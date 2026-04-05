import { lastValueFrom, of } from "rxjs";
import { toArray } from "rxjs/operators";
import {
  requestExportConfig,
  requestImportConfig,
  requestPopupData,
  requestResetConfig,
} from "@domain/actions/popup";
import {
  hydratePopupFeed,
  setExportConfig,
} from "@domain/reducers/popupState";
import type {
  PopupFeedEntry,
  PopupFeedSnapshot,
} from "@infra/services/library/models";

jest.mock("@infra/services/library/popup", () => ({
  exportLibraryDump: jest.fn(),
  getPopupFeedSnapshot: jest.fn(),
  importLibraryDump: jest.fn(),
  resetLibrary: jest.fn(),
}));

const { exportLibraryDump, getPopupFeedSnapshot, importLibraryDump, resetLibrary } = jest.requireMock(
  "@infra/services/library/popup",
);

const emptyFeed: PopupFeedSnapshot = {
  update: [],
  subscribe: [],
  history: [],
  continueReading: null,
};

function buildFeedEntry(
  overrides: Partial<PopupFeedEntry> = {},
): PopupFeedEntry {
  return {
    category: "update",
    key: "update_dm5:m1_m1",
    index: 0,
    site: "dm5",
    siteLabel: "DM5",
    comicsID: "m1",
    chapterID: "m1",
    lastReadChapterID: "",
    lastChapterID: "m1",
    updateChapterID: "m1",
    continueChapterID: "m1",
    title: "Demo",
    url: "",
    cover: "",
    lastReadTitle: "Not started",
    lastReadHref: "",
    lastChapterTitle: "Ch 1",
    lastChapterHref: "",
    updateChapterTitle: "Ch 1",
    updateChapterHref: "",
    continueHref: "",
    ...overrides,
  };
}

describe("popupConfigEpic", () => {
  let popupConfigEpic: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).chrome = {
      action: { setBadgeText: jest.fn() },
    };
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = jest.fn(() => "blob:mock");
    } else {
      jest
        .spyOn(window.URL, "createObjectURL")
        .mockImplementation(() => "blob:mock");
    }

    jest.isolateModules(() => {
      popupConfigEpic = require("./configEpic").default;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads popup data", async () => {
    getPopupFeedSnapshot.mockResolvedValue(emptyFeed);

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestPopupData())).pipe(toArray()),
    );

    expect(actions).toEqual([hydratePopupFeed(emptyFeed, "load")]);
  });

  it("imports config and updates badge", async () => {
    const data: PopupFeedSnapshot = {
      ...emptyFeed,
      update: [
        buildFeedEntry(),
        buildFeedEntry({
          key: "update_dm5:m2_m2",
          index: 1,
          comicsID: "m2",
          chapterID: "m2",
          updateChapterID: "m2",
        }),
      ],
    };
    importLibraryDump.mockResolvedValue(data);
    getPopupFeedSnapshot.mockResolvedValue(data);

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestImportConfig({}))).pipe(toArray()),
    );

    expect(actions).toEqual([hydratePopupFeed(data, "import")]);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "2" });
  });

  it("resets config and updates badge", async () => {
    resetLibrary.mockResolvedValue(emptyFeed);
    getPopupFeedSnapshot.mockResolvedValue(emptyFeed);

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestResetConfig())).pipe(toArray()),
    );

    expect(actions).toEqual([hydratePopupFeed(emptyFeed, "reset")]);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
  });

  it("exports config url", async () => {
    exportLibraryDump.mockResolvedValue({
      format: "comic-scroller-db-dump",
      formatVersion: 1,
      exportedAt: 1,
      dbSchemaVersion: 1,
      data: {
        series: [],
        chapters: [],
        subscriptions: [],
        history: [],
        updates: [],
      },
    });

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestExportConfig())).pipe(toArray()),
    );

    expect(actions).toEqual([
      setExportConfig("blob:mock", "comic-scroller-library.json"),
    ]);
  });
});
