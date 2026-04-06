import {
  applyReadProgress,
  removeSeriesCascade,
  removeSeriesFromHistory,
  toggleSeriesSubscriptionByKey,
} from "./mutations";
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
    replaceSeriesChaptersInTransaction: jest.fn(() => Promise.resolve()),
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
  replaceSeriesChaptersInTransaction: jest.Mock;
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

  it("toggles subscription state in a single mutation and preserves checkedAt", async () => {
    const subscriptionsStore = {
      getAll: jest.fn(() => [
        { seriesKey: "dm5:m123", position: 0, checkedAt: 200 },
        { seriesKey: "sf:77", position: 1, checkedAt: 100 },
      ]),
    };
    const stores = {
      [SUBSCRIPTIONS_STORE]: subscriptionsStore,
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
    shared.loadOrderedSeriesKeysInTransaction.mockResolvedValue([
      "dm5:m123",
      "sf:77",
    ]);

    await expect(toggleSeriesSubscriptionByKey("dm5:m123")).resolves.toBe(false);
    expect(shared.writeOrderedSeriesKeysInTransaction).toHaveBeenCalledWith(
      subscriptionsStore,
      ["sf:77"],
      expect.any(Function),
    );
    expect(shared.emitLibrarySignal).toHaveBeenCalledWith(
      "toggleSubscription",
      ["subscriptions"],
      ["dm5:m123"],
    );

    jest.clearAllMocks();

    shared.openLibraryDb.mockResolvedValue(db);
    shared.loadOrderedSeriesKeysInTransaction.mockResolvedValue(["sf:77"]);
    subscriptionsStore.getAll.mockReturnValue([{ seriesKey: "sf:77", position: 0, checkedAt: 100 }]);

    await expect(toggleSeriesSubscriptionByKey("dm5:m123")).resolves.toBe(true);
    expect(shared.writeOrderedSeriesKeysInTransaction).toHaveBeenCalledWith(
      subscriptionsStore,
      ["dm5:m123", "sf:77"],
      expect.any(Function),
    );
  });

  it("removes only history entries without touching series data", async () => {
    const historyStore = {};
    const stores = {
      [HISTORY_STORE]: historyStore,
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
    shared.loadOrderedSeriesKeysInTransaction.mockResolvedValue([
      "dm5:m123",
      "sf:77",
    ]);

    await removeSeriesFromHistory("dm5", "m123");

    expect(shared.writeOrderedSeriesKeysInTransaction).toHaveBeenCalledWith(
      historyStore,
      ["sf:77"],
    );
    expect(shared.emitLibrarySignal).toHaveBeenCalledWith(
      "removeHistory",
      ["history"],
      ["dm5:m123"],
    );
  });

  it("updates read progress without rewriting chapter cache", async () => {
    const seriesStore = {
      get: jest.fn(() => ({
        seriesKey: "dm5:m123",
        site: "dm5",
        comicsID: "m123",
        title: "Demo",
        cover: "cover.jpg",
        url: "https://www.dm5.com/m123/",
        lastRead: "m1",
        read: ["m1"],
        lastReadTitle: "Ch 1",
        lastReadHref: "https://www.dm5.com/m123/1.html",
        latestChapterID: "m3",
        latestChapterTitle: "Ch 3",
        latestChapterHref: "https://www.dm5.com/m123/3.html",
      })),
      put: jest.fn(() => undefined),
    };
    const chaptersStore = {
      get: jest.fn(() => ({
        seriesKey: "dm5:m123",
        chapterID: "m2",
        title: "Ch 2",
        href: "https://www.dm5.com/m123/2.html",
        orderIndex: 1,
      })),
    };
    const updatesStore = {
      count: jest.fn(() => 0),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
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
    shared.loadUpdatesInTransaction.mockResolvedValue([
      { seriesKey: "dm5:m123", chapterID: "m2", createdAt: 2, position: 0 },
    ]);

    const result = await applyReadProgress("dm5", "m123", "m2");

    expect(db.transaction).toHaveBeenCalledWith(
      [SERIES_STORE, CHAPTERS_STORE, UPDATES_STORE],
      "readwrite",
    );
    expect(shared.replaceSeriesChaptersInTransaction).not.toHaveBeenCalled();
    expect(seriesStore.put).toHaveBeenCalledWith(
      expect.objectContaining({
        seriesKey: "dm5:m123",
        lastRead: "m2",
        read: ["m1", "m2"],
        lastReadTitle: "Ch 2",
        lastReadHref: "https://www.dm5.com/m123/2.html",
        latestChapterID: "m3",
        latestChapterTitle: "Ch 3",
        latestChapterHref: "https://www.dm5.com/m123/3.html",
      }),
    );
    expect(shared.writeUpdatesInTransaction).toHaveBeenCalledWith(
      updatesStore,
      [],
    );
    expect(shared.emitLibrarySignal).toHaveBeenCalledWith(
      "seriesMutation",
      ["series", "updates"],
      ["dm5:m123"],
    );
    expect(result).toEqual(
      expect.objectContaining({
        updatesCount: 0,
        subscribed: false,
      }),
    );
  });
});
