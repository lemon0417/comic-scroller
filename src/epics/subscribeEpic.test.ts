import { of } from "rxjs";
import subscribeEpic from "./subscribeEpic";
import { toggleSubscribe } from "@domain/actions/reader";
import { updateSubscribe } from "@domain/reducers/comics";

jest.mock("@infra/services/storage", () => ({
  storageGet: jest.fn(),
  storageSet: jest.fn(),
}));

const { storageGet, storageSet } = jest.requireMock("@infra/services/storage");

describe("subscribeEpic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds subscribe and updates state", () => {
    const store = {
      subscribe: [],
      dm5: { "123": { title: "t" } },
    };
    storageGet.mockImplementation((keys: any, cb?: any) => {
      if (typeof keys === "function") return keys(store);
      return cb?.(store);
    });
    storageSet.mockImplementation((_items: any, cb?: any) => cb?.());

    const state$ = { value: { comics: { site: "dm5", comicsID: "123" } } };
    const action$ = of(toggleSubscribe());
    const output$ = subscribeEpic(action$, state$ as any);

    const actions: any[] = [];
    output$.subscribe((action) => actions.push(action));

    expect(actions).toEqual([updateSubscribe(true)]);
  });
});
