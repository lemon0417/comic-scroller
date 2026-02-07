import { of } from "rxjs";
import {
  requestExportConfig,
  requestImportConfig,
  requestPopupData,
  requestResetConfig,
} from "@domain/actions/popup";
import {
  setExportConfig,
  updatePopupData,
} from "@containers/PopupApp/reducers/popup";

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

const { storageGet, storageSet, storageClear } = jest.requireMock(
  "@infra/services/storage",
);

describe("popupConfigEpic", () => {
  let popupConfigEpic: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).chrome = {
      action: { setBadgeText: jest.fn() },
      runtime: { sendMessage: jest.fn() },
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

  it("loads popup data", () => {
    const data = { update: [], subscribe: [], history: [] };
    storageGet.mockImplementation((keys: any, cb?: any) => {
      if (typeof keys === "function") return keys(data);
      return cb?.(data);
    });

    const action$ = of(requestPopupData());
    const output$ = popupConfigEpic(action$);
    const actions: any[] = [];
    output$.subscribe((action: any) => actions.push(action));

    expect(actions).toEqual([updatePopupData(data)]);
  });

  it("imports config and updates badge", () => {
    const data = { update: [1, 2], subscribe: [], history: [] };
    storageSet.mockImplementation((_items: any, cb?: any) => cb?.());
    storageGet.mockImplementation((keys: any, cb?: any) => {
      if (typeof keys === "function") return keys(data);
      return cb?.(data);
    });

    const action$ = of(requestImportConfig({}));
    const output$ = popupConfigEpic(action$);
    const actions: any[] = [];
    output$.subscribe((action: any) => actions.push(action));

    expect(actions).toEqual([updatePopupData(data)]);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "2" });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ msg: "UPDATE" });
  });

  it("resets config and updates badge", () => {
    const data = { update: [], subscribe: [], history: [] };
    storageClear.mockImplementation((cb?: any) => cb?.());
    storageSet.mockImplementation((_items: any, cb?: any) => cb?.());
    storageGet.mockImplementation((keys: any, cb?: any) => {
      if (typeof keys === "function") return keys(data);
      return cb?.(data);
    });

    const action$ = of(requestResetConfig());
    const output$ = popupConfigEpic(action$);
    const actions: any[] = [];
    output$.subscribe((action: any) => actions.push(action));

    expect(actions).toEqual([updatePopupData(data)]);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ msg: "UPDATE" });
  });

  it("exports config url", () => {
    const data = { update: [], subscribe: [], history: [] };
    storageGet.mockImplementation((keys: any, cb?: any) => {
      if (typeof keys === "function") return keys(data);
      return cb?.(data);
    });

    const action$ = of(requestExportConfig());
    const output$ = popupConfigEpic(action$);
    const actions: any[] = [];
    output$.subscribe((action: any) => actions.push(action));

    expect(actions).toEqual([
      setExportConfig("blob:mock", "comic-scroller-config.json"),
    ]);
  });
});
