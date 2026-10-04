import {
  applyBackgroundSeriesRefresh,
  applyReadProgress,
  removeSeriesCascade,
  removeSeriesFromHistory,
  setSeriesSubscriptionByKey,
  toggleSeriesSubscriptionByKey,
} from "./mutations";
import {
  CHAPTERS_STORE,
  HISTORY_STORE,
  READS_STORE,
  SERIES_STORE,
  SUBSCRIPTIONS_STORE,
  UPDATES_STORE,
} from "./schema";

jest.mock("./db", () => ({
  openLibraryDb: jest.fn(),
  requestToPromise: jest.fn((value) => Promise.resolve(value)),
  transactionDone: jest.fn(() => Promise.resolve()),
}));

jest.mock("./rows", () => {
  const actual = jest.requireActual("./rows");
  return {
    ...actual,
    addReadChapterInTransaction: jest.fn(() => Promise.resolve()),
    loadReadChapterIDsInTransaction: jest.fn(() => Promise.resolve([])),
    loadOrderedSeriesKeysInTransaction: jest.fn(),
    loadOrderedSubscriptionRowsInTransaction: jest.fn(),
    loadRowsByPositionInTransaction: jest.fn(),
    loadUpdatesInTransaction: jest.fn(),
    replaceSeriesChaptersInTransaction: jest.fn(() => Promise.resolve()),
    replaceSeriesReadsInTransaction: jest.fn(() => Promise.resolve()),
    writeOrderedSeriesKeysInTransaction: jest.fn(() => Promise.resolve()),
  };
});

jest.mock("./shared", () => {
  const actual = jest.requireActual("./shared");
  return {
    ...actual,
    emitLibrarySignal: jest.fn(() => Promise.resolve()),
    ensureLibraryReady: jest.fn(() => Promise.resolve()),
  };
});

const dbModule = jest.requireMock("./db") as {
  openLibraryDb: jest.Mock;
};

const rows = jest.requireMock("./rows") as {
  addReadChapterInTransaction: jest.Mock;
  loadReadChapterIDsInTransaction: jest.Mock;
  loadOrderedSeriesKeysInTransaction: jest.Mock;
  loadOrderedSubscriptionRowsInTransaction: jest.Mock;
  loadRowsByPositionInTransaction: jest.Mock;
  loadUpdatesInTransaction: jest.Mock;
  replaceSeriesChaptersInTransaction: jest.Mock;
  replaceSeriesReadsInTransaction: jest.Mock;
  writeOrderedSeriesKeysInTransaction: jest.Mock;
};

const shared = jest.requireMock("./shared") as {
  emitLibrarySignal: jest.Mock;
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
    const subscriptionsStore = {
      delete: jest.fn(() => undefined),
    };
    const historyStore = {
      delete: jest.fn(() => undefined),
    };
    const readsStore = {
      index: jest.fn(() => ({
        getAllKeys: jest.fn(() => [
          ["dm5:m123", "m1"],
          ["dm5:m123", "m2"],
        ]),
      })),
      delete: jest.fn(() => undefined),
    };
    const updatesStore = {
      delete: jest.fn(() => undefined),
      count: jest.fn(() => 1),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
      [READS_STORE]: readsStore,
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
    dbModule.openLibraryDb.mockResolvedValue(db);
    rows.loadUpdatesInTransaction.mockResolvedValue([
      { seriesKey: "dm5:m123", chapterID: "m2", position: 0 },
      { seriesKey: "8comic:77", chapterID: "c7", position: 1 },
    ]);

    const result = await removeSeriesCascade("dm5", "m123");

    expect(result).toBe(1);
    expect(seriesStore.delete).toHaveBeenCalledWith("dm5:m123");
    expect(chaptersStore.delete).toHaveBeenCalledWith(["dm5:m123", "m1"]);
    expect(chaptersStore.delete).toHaveBeenCalledWith(["dm5:m123", "m2"]);
    expect(readsStore.delete).toHaveBeenCalledWith(["dm5:m123", "m1"]);
    expect(readsStore.delete).toHaveBeenCalledWith(["dm5:m123", "m2"]);
    expect(subscriptionsStore.delete).toHaveBeenCalledWith("dm5:m123");
    expect(historyStore.delete).toHaveBeenCalledWith("dm5:m123");
    expect(rows.writeOrderedSeriesKeysInTransaction).not.toHaveBeenCalled();
    expect(updatesStore.delete).toHaveBeenCalledWith(["dm5:m123", "m2"]);
    expect(shared.emitLibrarySignal).toHaveBeenCalledWith(
      "removeSeries",
      ["series", "subscriptions", "history", "updates"],
      ["dm5:m123"],
    );
  });

  it("toggles subscription state in a single mutation and preserves checkedAt", async () => {
    const subscriptionsStore = {
      get: jest.fn(() => undefined),
      put: jest.fn(() => undefined),
      delete: jest.fn(() => undefined),
    };
    const seriesStore = {
      get: jest.fn((): any => undefined),
    };
    const chaptersStore = {
      index: jest.fn(() => ({
        getAllKeys: jest.fn(() => []),
      })),
      delete: jest.fn(() => undefined),
    };
    const readsStore = {
      index: jest.fn(() => ({
        getAllKeys: jest.fn(() => []),
      })),
      delete: jest.fn(() => undefined),
    };
    const historyStore = {
      get: jest.fn(() => undefined),
    };
    const updatesStore = {
      count: jest.fn(() => 0),
      getAll: jest.fn(() => []),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
      [READS_STORE]: readsStore,
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

    dbModule.openLibraryDb.mockResolvedValue(db);
    rows.loadOrderedSubscriptionRowsInTransaction.mockResolvedValue([
      { seriesKey: "dm5:m123", position: 0, checkedAt: 200 },
      { seriesKey: "8comic:77", position: 1, checkedAt: 100 },
    ]);

    await expect(toggleSeriesSubscriptionByKey("dm5:m123")).resolves.toBe(false);
    expect(subscriptionsStore.delete).toHaveBeenCalledWith("dm5:m123");
    expect(rows.writeOrderedSeriesKeysInTransaction).not.toHaveBeenCalled();
    expect(shared.emitLibrarySignal).toHaveBeenCalledWith(
      "toggleSubscription",
      ["subscriptions"],
      ["dm5:m123"],
    );

    jest.clearAllMocks();

    dbModule.openLibraryDb.mockResolvedValue(db);
    rows.loadOrderedSubscriptionRowsInTransaction.mockResolvedValue([
      { seriesKey: "8comic:77", position: 0, checkedAt: 100 },
    ]);
    seriesStore.get.mockReturnValue({
      seriesKey: "dm5:m123",
      site: "dm5",
      comicsID: "m123",
    });

    await expect(toggleSeriesSubscriptionByKey("dm5:m123")).resolves.toBe(true);
    expect(subscriptionsStore.put).toHaveBeenCalledWith({
      seriesKey: "dm5:m123",
      position: -1,
      checkedAt: 0,
    });
    expect(rows.writeOrderedSeriesKeysInTransaction).not.toHaveBeenCalled();
  });

  it("does not create subscriptions for missing series and cleans dangling rows", async () => {
    const seriesStore = {
      get: jest.fn(() => undefined),
    };
    const subscriptionsStore = {
      put: jest.fn(() => undefined),
      delete: jest.fn(() => undefined),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [SUBSCRIPTIONS_STORE]: subscriptionsStore,
    };
    const transaction = {
      objectStore: jest.fn(
        (storeName: keyof typeof stores) => stores[storeName],
      ),
    };
    dbModule.openLibraryDb.mockResolvedValue({
      transaction: jest.fn(() => transaction),
    });
    rows.loadOrderedSubscriptionRowsInTransaction.mockResolvedValueOnce([]);

    await expect(
      setSeriesSubscriptionByKey("dm5:missing", true),
    ).resolves.toBe(false);
    expect(subscriptionsStore.put).not.toHaveBeenCalled();
    expect(subscriptionsStore.delete).not.toHaveBeenCalled();
    expect(shared.emitLibrarySignal).not.toHaveBeenCalled();

    rows.loadOrderedSubscriptionRowsInTransaction.mockResolvedValueOnce([
      { seriesKey: "dm5:missing", position: 0, checkedAt: 0 },
    ]);

    await expect(
      setSeriesSubscriptionByKey("dm5:missing", true),
    ).resolves.toBe(false);
    expect(subscriptionsStore.delete).toHaveBeenCalledWith("dm5:missing");
    expect(shared.emitLibrarySignal).toHaveBeenCalledWith(
      "setSubscription",
      ["subscriptions"],
      ["dm5:missing"],
    );
  });

  it("removes only history entries without touching series data", async () => {
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
        latestChapterID: "m1",
        latestChapterTitle: "Ch 1",
        latestChapterHref: "https://www.dm5.com/m123/1.html",
      })),
      delete: jest.fn(() => undefined),
    };
    const chaptersStore = {
      index: jest.fn(() => ({
        getAllKeys: jest.fn(() => []),
      })),
      delete: jest.fn(() => undefined),
    };
    const readsStore = {
      index: jest.fn(() => ({
        getAllKeys: jest.fn(() => []),
      })),
      delete: jest.fn(() => undefined),
    };
    const subscriptionsStore = {
      get: jest.fn(() => ({ seriesKey: "dm5:m123", position: 0, checkedAt: 100 })),
    };
    const historyStore = {
      delete: jest.fn(() => undefined),
      get: jest.fn(() => undefined),
    };
    const updatesStore = {
      count: jest.fn(() => 0),
      getAll: jest.fn(() => []),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
      [READS_STORE]: readsStore,
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

    dbModule.openLibraryDb.mockResolvedValue(db);
    rows.loadRowsByPositionInTransaction.mockResolvedValue([
      { seriesKey: "dm5:m123", position: 0 },
      { seriesKey: "8comic:77", position: 1 },
    ]);

    await removeSeriesFromHistory("dm5", "m123");

    expect(historyStore.delete).toHaveBeenCalledWith("dm5:m123");
    expect(rows.writeOrderedSeriesKeysInTransaction).not.toHaveBeenCalled();
    expect(shared.emitLibrarySignal).toHaveBeenCalledWith(
      "removeHistory",
      ["history"],
      ["dm5:m123"],
    );
    expect(seriesStore.delete).not.toHaveBeenCalled();
    expect(chaptersStore.delete).not.toHaveBeenCalled();
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
    const readsStore = {};
    const updatesStore = {
      delete: jest.fn(() => undefined),
      count: jest.fn(() => 0),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
      [READS_STORE]: readsStore,
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

    dbModule.openLibraryDb.mockResolvedValue(db);
    rows.loadReadChapterIDsInTransaction.mockResolvedValue(["m1"]);
    const result = await applyReadProgress("dm5", "m123", "m2");

    expect(db.transaction).toHaveBeenCalledWith(
      [SERIES_STORE, CHAPTERS_STORE, READS_STORE, UPDATES_STORE],
      "readwrite",
    );
    expect(rows.replaceSeriesChaptersInTransaction).not.toHaveBeenCalled();
    expect(seriesStore.put).toHaveBeenCalledWith(
      expect.objectContaining({
        seriesKey: "dm5:m123",
        lastRead: "m2",
        lastReadTitle: "Ch 2",
        lastReadHref: "https://www.dm5.com/m123/2.html",
        latestChapterID: "m3",
        latestChapterTitle: "Ch 3",
        latestChapterHref: "https://www.dm5.com/m123/3.html",
      }),
    );
    expect(updatesStore.delete).toHaveBeenCalledWith(["dm5:m123", "m2"]);
    expect(rows.addReadChapterInTransaction).toHaveBeenCalledWith(
      readsStore,
      "dm5:m123",
      "m2",
    );
    expect(shared.emitLibrarySignal).toHaveBeenCalledWith(
      "seriesMutation",
      ["series", "updates"],
      ["dm5:m123"],
    );
    expect(result).toEqual(
      expect.objectContaining({
        seriesKey: "dm5:m123",
        readChapterIDs: ["m1", "m2"],
        updatesCount: 0,
      }),
    );
    expect(result).not.toHaveProperty("subscribed");
  });

  it("prepends only new background updates without rewriting the entire store", async () => {
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
        latestChapterID: "m2",
        latestChapterTitle: "Ch 2",
        latestChapterHref: "https://www.dm5.com/m123/2.html",
      })),
      put: jest.fn(() => undefined),
    };
    const chaptersStore = {
      index: jest.fn(() => ({
        getAll: jest.fn(() => [
          {
            seriesKey: "dm5:m123",
            chapterID: "m2",
            title: "Ch 2",
            href: "https://www.dm5.com/m123/2.html",
            orderIndex: 0,
          },
        ]),
      })),
    };
    const readsStore = {
      index: jest.fn(() => ({
        getAllKeys: jest.fn(() => [["dm5:m123", "m1"]]),
      })),
    };
    const updatesStore = {
      delete: jest.fn(() => undefined),
      put: jest.fn(() => undefined),
      count: jest.fn(() => 3),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
      [READS_STORE]: readsStore,
      [UPDATES_STORE]: updatesStore,
      [SUBSCRIPTIONS_STORE]: { get: jest.fn(() => ({ seriesKey: "dm5:m123" })) },
    };
    const transaction = {
      objectStore: jest.fn(
        (storeName: keyof typeof stores) => stores[storeName],
      ),
    };
    const db = {
      transaction: jest.fn(() => transaction),
    };

    dbModule.openLibraryDb.mockResolvedValue(db);
    rows.loadUpdatesInTransaction.mockResolvedValue([
      { seriesKey: "8comic:77", chapterID: "c9", position: 0 },
      { seriesKey: "dm5:m123", chapterID: "m2", position: 1 },
    ]);

    const result = await applyBackgroundSeriesRefresh(
      "dm5",
      "m123",
      {
        chapterList: ["m3", "m2", "m1"],
        chapters: {
          m1: {
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
          },
          m2: {
            title: "Ch 2",
            href: "https://www.dm5.com/m123/2.html",
          },
          m3: {
            title: "Ch 3",
            href: "https://www.dm5.com/m123/3.html",
          },
        },
      },
      ["m3", "m2"],
    );

    expect(rows.loadReadChapterIDsInTransaction).toHaveBeenCalledWith(
      readsStore,
      "dm5:m123",
    );
    expect(seriesStore.put).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Demo",
        cover: "cover.jpg",
        url: "https://www.dm5.com/m123/",
        lastRead: "m1",
        latestChapterID: "m3",
        latestChapterTitle: "Ch 3",
      }),
    );
    expect(chaptersStore.index).not.toHaveBeenCalled();
    expect(rows.replaceSeriesChaptersInTransaction).toHaveBeenCalled();
    expect(updatesStore.delete).toHaveBeenNthCalledWith(1, ["dm5:m123", "m3"]);
    expect(updatesStore.delete).toHaveBeenNthCalledWith(2, ["dm5:m123", "m2"]);
    expect(updatesStore.put).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        seriesKey: "dm5:m123",
        chapterID: "m3",
        position: -2,
      }),
    );
    expect(updatesStore.put).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        seriesKey: "dm5:m123",
        chapterID: "m2",
        position: -1,
      }),
    );
    expect(shared.emitLibrarySignal).toHaveBeenCalledWith(
      "backgroundRefresh",
      ["series", "chapters", "updates"],
      ["dm5:m123"],
    );
    expect(result).toEqual({ updatesCount: 3 });
  });

  it("rebalances sparse update positions after repeated prepends cross the threshold", async () => {
    const seriesStore = {
      get: jest.fn(() => ({
        seriesKey: "dm5:m123",
        site: "dm5",
        comicsID: "m123",
        title: "Demo",
        cover: "cover.jpg",
        url: "https://www.dm5.com/m123/",
        lastRead: "",
        read: [],
        lastReadTitle: "",
        lastReadHref: "",
        latestChapterID: "m1",
        latestChapterTitle: "Ch 1",
        latestChapterHref: "https://www.dm5.com/m123/1.html",
      })),
      put: jest.fn(() => undefined),
    };
    const chaptersStore = {
      index: jest.fn(() => ({
        getAll: jest.fn(() => [
          {
            seriesKey: "dm5:m123",
            chapterID: "m1",
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
            orderIndex: 0,
          },
        ]),
      })),
    };
    const updatesStore = {
      delete: jest.fn(() => undefined),
      clear: jest.fn(() => undefined),
      put: jest.fn(() => undefined),
      count: jest.fn(() => 3),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
      [UPDATES_STORE]: updatesStore,
      [SUBSCRIPTIONS_STORE]: { get: jest.fn(() => ({ seriesKey: "dm5:m123" })) },
    };
    const transaction = {
      objectStore: jest.fn(
        (storeName: keyof typeof stores) => stores[storeName],
      ),
    };
    const db = {
      transaction: jest.fn(() => transaction),
    };

    dbModule.openLibraryDb.mockResolvedValue(db);
    rows.loadUpdatesInTransaction
      .mockResolvedValueOnce([
        { seriesKey: "8comic:77", chapterID: "c9", position: -1023 },
        { seriesKey: "dm5:m123", chapterID: "m1", position: -1022 },
      ])
      .mockResolvedValueOnce([
        { seriesKey: "dm5:m123", chapterID: "m2", position: -1024 },
        { seriesKey: "8comic:77", chapterID: "c9", position: -1023 },
        { seriesKey: "dm5:m123", chapterID: "m1", position: -1022 },
      ]);

    await applyBackgroundSeriesRefresh(
      "dm5",
      "m123",
      {
        chapterList: ["m2", "m1"],
        chapters: {
          m1: {
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
          },
          m2: {
            title: "Ch 2",
            href: "https://www.dm5.com/m123/2.html",
          },
        },
      },
      ["m2"],
    );

    expect(updatesStore.clear).toHaveBeenCalledTimes(1);
    expect(updatesStore.put).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        seriesKey: "dm5:m123",
        chapterID: "m2",
        position: 0,
      }),
    );
    expect(updatesStore.put).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        seriesKey: "8comic:77",
        chapterID: "c9",
        position: 1,
      }),
    );
    expect(updatesStore.put).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        seriesKey: "dm5:m123",
        chapterID: "m1",
        position: 2,
      }),
    );
  });
});
