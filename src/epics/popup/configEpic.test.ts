import {
  POPUP_UPDATE_LIMIT,
  requestExportConfig,
  requestImportConfig,
  requestPopupData,
  requestResetConfig,
} from "@domain/actions/popup";
import {
  hydratePopupFeed,
  setExportConfig,
  setExtensionReleaseNotice,
  setPopupNotice,
} from "@domain/reducers/popupState";
import type { ExtensionReleaseNotice } from "@infra/services/extensionRelease";
import type {
  PopupFeedEntry,
  PopupFeedSnapshot,
} from "@infra/services/library/models";
import { lastValueFrom, of } from "rxjs";
import { toArray } from "rxjs/operators";

jest.mock("@infra/services/library/popup", () => ({
  exportLibraryArchive: jest.fn(),
  getPopupFeedSnapshot: jest.fn(),
  importLibraryDump: jest.fn(),
  resetLibrary: jest.fn(),
}));
jest.mock("@infra/services/extensionRelease", () => ({
  getExtensionReleaseNotice: jest.fn(),
}));

const { exportLibraryArchive, getPopupFeedSnapshot, importLibraryDump, resetLibrary } = jest.requireMock(
  "@infra/services/library/popup",
);
const { getExtensionReleaseNotice } = jest.requireMock(
  "@infra/services/extensionRelease",
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
  const releaseNotice: ExtensionReleaseNotice = {
    latestVersion: "4.2.0",
    releaseUrl:
      "https://github.com/lemon0417/comic-scroller/releases/tag/v4.2.0",
    instructionsUrl: "https://lemon0417.github.io/comic-scroller/install/",
    publishedAt: "2026-04-09T12:00:00.000Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getExtensionReleaseNotice.mockResolvedValue(null);
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

    expect(actions).toEqual([
      hydratePopupFeed(emptyFeed, "load"),
      setExtensionReleaseNotice(null),
    ]);
    expect(getPopupFeedSnapshot).toHaveBeenCalledWith({});
  });

  it("loads a limited update feed for the popup view", async () => {
    getPopupFeedSnapshot.mockResolvedValue(emptyFeed);
    getExtensionReleaseNotice.mockResolvedValue(releaseNotice);

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestPopupData("popup"))).pipe(toArray()),
    );

    expect(actions).toEqual([
      hydratePopupFeed(emptyFeed, "load"),
      setExtensionReleaseNotice(releaseNotice),
    ]);
    expect(getPopupFeedSnapshot).toHaveBeenCalledWith({
      updateLimit: POPUP_UPDATE_LIMIT,
    });
  });

  it("loads the full feed for the manage view", async () => {
    getPopupFeedSnapshot.mockResolvedValue(emptyFeed);

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestPopupData("manage"))).pipe(toArray()),
    );

    expect(actions).toEqual([
      hydratePopupFeed(emptyFeed, "load"),
      setExtensionReleaseNotice(null),
    ]);
    expect(getPopupFeedSnapshot).toHaveBeenCalledWith({});
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
      updateCount: 61,
    };
    importLibraryDump.mockResolvedValue(data);
    getPopupFeedSnapshot.mockResolvedValue(data);

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestImportConfig({}))).pipe(toArray()),
    );

    expect(actions).toEqual([
      hydratePopupFeed(data, "import"),
      setExtensionReleaseNotice(null),
    ]);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "61" });
  });

  it("resets config and updates badge", async () => {
    resetLibrary.mockResolvedValue(emptyFeed);
    getPopupFeedSnapshot.mockResolvedValue(emptyFeed);

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestResetConfig())).pipe(toArray()),
    );

    expect(actions).toEqual([
      hydratePopupFeed(emptyFeed, "reset"),
      setExtensionReleaseNotice(null),
    ]);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
  });

  it("exports config url", async () => {
    exportLibraryArchive.mockResolvedValue({
      blob: new Blob(["gzip"], { type: "application/gzip" }),
      filename: "comic-scroller-library.json.gz",
    });

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestExportConfig())).pipe(toArray()),
    );

    expect(actions).toEqual([
      setExportConfig("blob:mock", "comic-scroller-library.json.gz"),
    ]);
  });

  it("surfaces a notice when popup data loading fails", async () => {
    getPopupFeedSnapshot.mockRejectedValue(new Error("boom"));

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestPopupData("popup"))).pipe(toArray()),
    );

    expect(actions).toEqual([
      setPopupNotice("目前無法載入書庫資料，請稍後再試。"),
    ]);
    expect(getPopupFeedSnapshot).toHaveBeenCalledWith({
      updateLimit: POPUP_UPDATE_LIMIT,
    });
  });

  it("surfaces a notice when export fails", async () => {
    exportLibraryArchive.mockRejectedValue(new Error("boom"));

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestExportConfig())).pipe(toArray()),
    );

    expect(actions).toEqual([setPopupNotice("匯出失敗，請稍後再試。")]);
  });
});
