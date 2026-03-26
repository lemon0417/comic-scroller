import { lastValueFrom, of } from "rxjs";
import { toArray } from "rxjs/operators";
import subscribeEpic from "./subscribeEpic";
import { toggleSubscribe } from "@domain/actions/reader";
import { updateSubscribe } from "@domain/reducers/comics";

jest.mock("@infra/services/library", () => {
  const actual = jest.requireActual("@infra/services/library");
  return {
    ...actual,
    loadLibrary: jest.fn(),
    saveLibrary: jest.fn(),
  };
});

const { loadLibrary, saveLibrary } = jest.requireMock("@infra/services/library");

describe("subscribeEpic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds subscribe and updates state", async () => {
    const store = {
      schemaVersion: 2,
      version: "0.0.0",
      subscriptions: [],
      history: [],
      updates: [],
      seriesByKey: {
        "dm5:m123": {
          site: "dm5",
          comicsID: "m123",
          title: "t",
          cover: "",
          url: "",
          chapterList: [],
          chapters: {},
          lastRead: "",
          read: [],
        },
      },
    };
    loadLibrary.mockResolvedValue(store);
    saveLibrary.mockResolvedValue({
      ...store,
      subscriptions: ["dm5:m123"],
    });

    const state$ = { value: { comics: { site: "dm5", comicsID: "123" } } };
    const actions = await lastValueFrom(
      subscribeEpic(of(toggleSubscribe()), state$ as any).pipe(toArray()),
    );

    expect(actions).toEqual([updateSubscribe(true)]);
  });
});
