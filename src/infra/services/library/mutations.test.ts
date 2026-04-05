import { removeSeriesCascade } from "./mutations";
import {
  CHAPTERS_STORE,
  HISTORY_STORE,
  SERIES_STORE,
  SUBSCRIPTIONS_STORE,
  UPDATES_STORE,
} from "./schema";

jest.mock("./shared", () => {
  const actual = jest.requireActual("./shared");
  return {
    ...actual,
    emitLibrarySignal: jest.fn(() => Promise.resolve()),
    ensureLibraryReady: jest.fn(() => Promise.resolve()),
    loadOrderedSeriesKeysInTransaction: jest.fn(),
    loadUpdatesInTransaction: jest.fn(),
    openLibraryDb: jest.fn(),
    requestToPromise: jest.fn((value) => Promise.resolve(value)),
    transactionDone: jest.fn(() => Promise.resolve()),
    writeOrderedSeriesKeysInTransaction: jest.fn(() => Promise.resolve()),
    writeUpdatesInTransaction: jest.fn(() => Promise.resolve()),
  };
});

const shared = jest.requireMock("./shared") as {
  emitLibrarySignal: jest.Mock;
  loadOrderedSeriesKeysInTransaction: jest.Mock;
  loadUpdatesInTransaction: jest.Mock;
  openLibraryDb: jest.Mock;
  writeOrderedSeriesKeysInTransaction: jest.Mock;
  writeUpdatesInTransaction: jest.Mock;
};

describe("library mutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("removes a series and all related rows without touching unrelated series", async () => {
    const seriesStore = {
      delete: jest.fn(() => undefined),
    };
    const chaptersStore = {
      delete: jest.fn(() => undefined),
      index: jest.fn(() => ({
        getAllKeys: jest.fn(() => [
          ["dm5:m123", "m1"],
          ["dm5:m123", "m2"],
        ]),
      })),
    };
    const subscriptionsStore = {};
    const historyStore = {};
    const updatesStore = {
      count: jest.fn(() => 1),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
      [SUBSCRIPTIONS_STORE]: subscriptionsStore,
      [HISTORY_STORE]: historyStore,
      [UPDATES_STORE]: updatesStore,
    };
    const transaction = {
      objectStore: jest.fn(
        (storeName: keyof typeof stores) => stores[storeName],
      ),
    };
    const db = {
      transaction: jest.fn(() => transaction),
    };

    shared.openLibraryDb.mockResolvedValue(db);
    shared.loadOrderedSeriesKeysInTransaction
      .mockResolvedValueOnce(["dm5:m123", "sf:77"])
      .mockResolvedValueOnce(["dm5:m123", "comicbus:88"]);
    shared.loadUpdatesInTransaction.mockResolvedValue([
      { seriesKey: "dm5:m123", chapterID: "m2", createdAt: 1, position: 0 },
      { seriesKey: "sf:77", chapterID: "c7", createdAt: 2, position: 1 },
    ]);

    const result = await removeSeriesCascade("dm5", "m123");

    expect(result).toBe(1);
    expect(seriesStore.delete).toHaveBeenCalledWith("dm5:m123");
    expect(chaptersStore.delete).toHaveBeenCalledWith(["dm5:m123", "m1"]);
    expect(chaptersStore.delete).toHaveBeenCalledWith(["dm5:m123", "m2"]);
    expect(shared.writeOrderedSeriesKeysInTransaction).toHaveBeenNthCalledWith(
      1,
      subscriptionsStore,
      ["sf:77"],
    );
    expect(shared.writeOrderedSeriesKeysInTransaction).toHaveBeenNthCalledWith(
      2,
      historyStore,
      ["comicbus:88"],
    );
    expect(shared.writeUpdatesInTransaction).toHaveBeenCalledWith(updatesStore, [
      { seriesKey: "sf:77", chapterID: "c7", createdAt: 2 },
    ]);
    expect(shared.emitLibrarySignal).toHaveBeenCalledWith(
      "removeSeries",
      ["series", "subscriptions", "history", "updates"],
      ["dm5:m123"],
    );
  });
});
