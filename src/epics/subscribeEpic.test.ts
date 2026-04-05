import { toggleSubscribe } from "@domain/actions/reader";
import { updateSubscribe } from "@domain/reducers/comics";
import { lastValueFrom, of } from "rxjs";
import { toArray } from "rxjs/operators";

import subscribeEpic from "./subscribeEpic";

jest.mock("@infra/services/library/reader", () => {
  const actual = jest.requireActual("@infra/services/library/reader");
  return {
    ...actual,
    toggleSeriesSubscriptionByKey: jest.fn(),
  };
});

const { toggleSeriesSubscriptionByKey } = jest.requireMock(
  "@infra/services/library/reader",
);

describe("subscribeEpic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds subscribe and updates state", async () => {
    toggleSeriesSubscriptionByKey.mockResolvedValue(true);

    const state$ = { value: { comics: { seriesKey: "dm5:m123" } } };
    const actions = await lastValueFrom(
      subscribeEpic(of(toggleSubscribe()), state$ as any).pipe(toArray()),
    );

    expect(actions).toEqual([updateSubscribe(true)]);
    expect(toggleSeriesSubscriptionByKey).toHaveBeenCalledWith("dm5:m123");
  });
});
