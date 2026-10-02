import {
  finishReaderSubscription,
  requestUnsubscribeSeries,
  toggleSubscribe,
} from "@domain/actions/reader";
import { updateSubscribe } from "@domain/reducers/comics";
import { lastValueFrom, of, Subject } from "rxjs";
import { toArray } from "rxjs/operators";

import subscribeEpic from "./subscribeEpic";

jest.mock("@infra/services/library/reader", () => ({
  getReaderSeriesSyncState: jest.fn(),
  pushLibrarySyncIfEnabled: jest.fn(),
  setSeriesSubscriptionByKey: jest.fn(),
  unsubscribeSeriesByKey: jest.fn(),
}));
jest.mock("@utils/navigation", () => ({ closeCurrentTab: jest.fn() }));

const {
  getReaderSeriesSyncState,
  pushLibrarySyncIfEnabled,
  setSeriesSubscriptionByKey,
  unsubscribeSeriesByKey,
} = jest.requireMock("@infra/services/library/reader");
const { closeCurrentTab } = jest.requireMock("@utils/navigation");

const seriesKey = "dm5:m123";
const state$ = { value: { comics: { seriesKey } } };
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function run(
  action:
    | ReturnType<typeof toggleSubscribe>
    | ReturnType<typeof requestUnsubscribeSeries>,
) {
  return lastValueFrom(
    subscribeEpic(of(action), state$ as any).pipe(toArray()),
  );
}

describe("subscribeEpic", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).chrome = { action: { setBadgeText: jest.fn() } };
    setSeriesSubscriptionByKey.mockResolvedValue(true);
    unsubscribeSeriesByKey.mockResolvedValue(0);
    getReaderSeriesSyncState.mockResolvedValue({
      exists: true,
      subscribed: false,
    });
    pushLibrarySyncIfEnabled.mockResolvedValue({ enabled: false });
    closeCurrentTab.mockResolvedValue(undefined);
  });

  it("adds a subscription explicitly and pushes sync", async () => {
    getReaderSeriesSyncState.mockResolvedValue({
      exists: true,
      subscribed: true,
    });
    expect(await run(toggleSubscribe())).toEqual([
      updateSubscribe(true),
      finishReaderSubscription(seriesKey),
    ]);
    expect(setSeriesSubscriptionByKey).toHaveBeenCalledWith(seriesKey, true);
    expect(pushLibrarySyncIfEnabled).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    "unsubscribes with an explicit cleanup choice (%s)",
    async (clearSeriesData) => {
      unsubscribeSeriesByKey.mockResolvedValue(2);
      expect(
        await run(requestUnsubscribeSeries(seriesKey, clearSeriesData)),
      ).toEqual([updateSubscribe(false), finishReaderSubscription(seriesKey)]);
      expect(unsubscribeSeriesByKey).toHaveBeenCalledWith(seriesKey, {
        clearSeriesData,
      });
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "2" });
      expect(closeCurrentTab).not.toHaveBeenCalled();
    },
  );

  it("finishes the sync attempt before closing a deleted series tab", async () => {
    let finishSync!: (value: any) => void;
    pushLibrarySyncIfEnabled.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSync = resolve;
        }),
    );
    getReaderSeriesSyncState.mockResolvedValue({
      exists: false,
      subscribed: false,
    });
    const result = run(requestUnsubscribeSeries(seriesKey, true));
    await flushPromises();
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    expect(closeCurrentTab).not.toHaveBeenCalled();
    finishSync({ lastError: "quota" });
    const actions = await result;
    expect(closeCurrentTab).toHaveBeenCalledTimes(1);
    expect(actions).toContainEqual(updateSubscribe(false));
    expect(actions.at(-1)).toEqual(
      finishReaderSubscription(
        seriesKey,
        "本機資料已更新，但同步失敗，請到書庫選項重試。",
      ),
    );
  });

  it("ignores repeated requests while a mutation is pending", async () => {
    let finishMutation!: (value: number) => void;
    unsubscribeSeriesByKey.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishMutation = resolve;
        }),
    );
    const input = new Subject<any>();
    const actions: any[] = [];
    const subscription = subscribeEpic(input, state$ as any).subscribe(
      (action) => actions.push(action),
    );
    input.next(requestUnsubscribeSeries(seriesKey, true));
    input.next(requestUnsubscribeSeries(seriesKey, true));
    expect(unsubscribeSeriesByKey).toHaveBeenCalledTimes(1);
    finishMutation(0);
    await flushPromises();
    expect(actions).toContainEqual(finishReaderSubscription(seriesKey));
    subscription.unsubscribe();
  });

  it("reports mutation failure and remains usable for retry", async () => {
    unsubscribeSeriesByKey.mockRejectedValueOnce(new Error("storage"));
    expect(await run(requestUnsubscribeSeries(seriesKey, true))).toEqual([
      finishReaderSubscription(seriesKey, "取消追蹤失敗，請稍後再試。", true),
    ]);
    expect(closeCurrentTab).not.toHaveBeenCalled();
    expect(
      await run(requestUnsubscribeSeries(seriesKey, false)),
    ).toContainEqual(updateSubscribe(false));
  });

  it("keeps persistence invalidated if closing a deleted tab fails", async () => {
    getReaderSeriesSyncState.mockResolvedValue({ exists: false });
    closeCurrentTab.mockRejectedValue(new Error("tabs"));
    expect(await run(requestUnsubscribeSeries(seriesKey, true))).toContainEqual(
      finishReaderSubscription(
        seriesKey,
        "已取消追蹤，但無法確認或關閉閱讀分頁，請手動關閉。",
      ),
    );
  });

  it("continues sync and closes a deleted reader even when badge updates fail", async () => {
    (chrome.action.setBadgeText as jest.Mock).mockRejectedValueOnce(
      new Error("badge"),
    );
    getReaderSeriesSyncState.mockResolvedValue({
      exists: false,
      subscribed: false,
    });
    const actions = await run(requestUnsubscribeSeries(seriesKey, true));
    expect(pushLibrarySyncIfEnabled).toHaveBeenCalledTimes(1);
    expect(closeCurrentTab).toHaveBeenCalledTimes(1);
    expect(actions).toContainEqual(updateSubscribe(false));
  });

  it("closes a reader removed elsewhere during a pending subscription", async () => {
    getReaderSeriesSyncState.mockResolvedValue({
      exists: false,
      subscribed: false,
    });
    const actions = await run(toggleSubscribe());
    expect(actions).toContainEqual(updateSubscribe(false));
    expect(closeCurrentTab).toHaveBeenCalledTimes(1);
  });
});
