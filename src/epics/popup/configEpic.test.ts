import { lastValueFrom, of } from "rxjs";
import { toArray } from "rxjs/operators";
import {
  requestExportConfig,
  requestImportConfig,
  requestPopupData,
  requestResetConfig,
} from "@domain/actions/popup";
import {
  hydratePopupLibrary,
  setExportConfig,
} from "@domain/reducers/popupState";

jest.mock("@infra/services/library", () => ({
  createEmptyLibrarySnapshot: jest.fn(() => ({
    schemaVersion: 2,
    version: "0.0.0",
    seriesByKey: {},
    subscriptions: [],
    history: [],
    updates: [],
  })),
  exportLibraryDump: jest.fn(),
  importLibraryDump: jest.fn(),
  loadLibrary: jest.fn(),
  resetLibrary: jest.fn(),
}));

const { exportLibraryDump, importLibraryDump, loadLibrary, resetLibrary } = jest.requireMock(
  "@infra/services/library",
);

const emptyLibrary = {
  schemaVersion: 2 as const,
  version: "0.0.0",
  seriesByKey: {},
  subscriptions: [],
  history: [],
  updates: [],
};

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
    loadLibrary.mockResolvedValue(emptyLibrary);

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestPopupData())).pipe(toArray()),
    );

    expect(actions).toEqual([hydratePopupLibrary(emptyLibrary, "load")]);
  });

  it("imports config and updates badge", async () => {
    const data = {
      ...emptyLibrary,
      updates: [
        { seriesKey: "dm5:m1", chapterID: "m1", createdAt: 1 },
        { seriesKey: "dm5:m2", chapterID: "m2", createdAt: 2 },
      ],
    };
    importLibraryDump.mockResolvedValue(data);

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestImportConfig({}))).pipe(toArray()),
    );

    expect(actions).toEqual([hydratePopupLibrary(data, "import")]);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "2" });
  });

  it("resets config and updates badge", async () => {
    resetLibrary.mockResolvedValue(emptyLibrary);

    const actions = await lastValueFrom(
      popupConfigEpic(of(requestResetConfig())).pipe(toArray()),
    );

    expect(actions).toEqual([hydratePopupLibrary(emptyLibrary, "reset")]);
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
