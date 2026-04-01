import { lastValueFrom, of } from "rxjs";
import { toArray } from "rxjs/operators";
import subscribeEpic from "./subscribeEpic";
import { toggleSubscribe } from "@domain/actions/reader";
import { updateSubscribe } from "@domain/reducers/comics";

jest.mock("@infra/services/library", () => {
  const actual = jest.requireActual("@infra/services/library");
  return {
    ...actual,
    findExistingSeriesKey: jest.fn(),
    isSeriesSubscribedByKey: jest.fn(),
    setSeriesSubscriptionByKey: jest.fn(),
  };
});

const {
  findExistingSeriesKey,
  isSeriesSubscribedByKey,
  setSeriesSubscriptionByKey,
} = jest.requireMock("@infra/services/library");

describe("subscribeEpic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds subscribe and updates state", async () => {
    findExistingSeriesKey.mockResolvedValue("dm5:m123");
    isSeriesSubscribedByKey.mockResolvedValue(false);
    setSeriesSubscriptionByKey.mockResolvedValue(true);

    const state$ = { value: { comics: { site: "dm5", comicsID: "123" } } };
    const actions = await lastValueFrom(
      subscribeEpic(of(toggleSubscribe()), state$ as any).pipe(toArray()),
    );

    expect(actions).toEqual([updateSubscribe(true)]);
    expect(setSeriesSubscriptionByKey).toHaveBeenCalledWith("dm5:m123", true);
  });
});
