import { of } from "rxjs";
import removeCardEpic from "./removeCardEpic";
import { requestRemoveCard } from "@domain/actions/popup";
import { updatePopupData } from "@containers/PopupApp/reducers/popup";

jest.mock("@infra/services/storage", () => ({
  storageGet: jest.fn(),
  storageSet: jest.fn(),
}));

const { storageGet, storageSet } = jest.requireMock("@infra/services/storage");

describe("removeCardEpic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).chrome = {
      action: { setBadgeText: jest.fn() },
      runtime: { sendMessage: jest.fn() },
    };
  });

  it("removes update card and rehydrates popup state", () => {
    const store = {
      history: [],
      subscribe: [],
      update: [
        { site: "dm5", comicsID: "c1", chapterID: "ch1" },
        { site: "dm5", comicsID: "c2", chapterID: "ch2" },
      ],
    };
    storageGet.mockImplementation((keys: any, cb?: any) => {
      if (typeof keys === "function") return keys(store);
      return cb?.(store);
    });
    storageSet.mockImplementation((_items: any, cb?: any) => cb?.());

    const action$ = of(
      requestRemoveCard({
        category: "update",
        index: "0",
        comicsID: "c1",
        chapterID: "ch1",
      }),
    );
    const output$ = removeCardEpic(action$);
    const actions: any[] = [];
    output$.subscribe((action: any) => actions.push(action));

    expect(actions).toEqual([updatePopupData(store, "load")]);
    expect(chrome.action.setBadgeText).toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ msg: "UPDATE" });
  });
});
