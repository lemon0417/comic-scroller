import {
  getPopupFeedSnapshot,
  getReaderSeriesState,
  getReaderSeriesSyncState,
  getSeriesCover,
  listBackgroundRefreshCandidates,
} from "./queries";
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
    loadRowsByPositionInTransaction: jest.fn(),
    loadReadChapterIDsInTransaction: jest.fn(() => Promise.resolve([])),
    loadSubscriptionKeysByCheckedAtInTransaction: jest.fn(),
    loadUpdatesInTransaction: jest.fn(),
  };
});

jest.mock("./shared", () => {
  const actual = jest.requireActual("./shared");
  return {
    ...actual,
    ensureLibraryReady: jest.fn(() => Promise.resolve()),
  };
});

const dbModule = jest.requireMock("./db") as {
  openLibraryDb: jest.Mock;
};

const rows = jest.requireMock("./rows") as {
  loadRowsByPositionInTransaction: jest.Mock;
  loadReadChapterIDsInTransaction: jest.Mock;
  loadSubscriptionKeysByCheckedAtInTransaction: jest.Mock;
  loadUpdatesInTransaction: jest.Mock;
};

describe("library queries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds a popup feed snapshot instead of returning a library snapshot", async () => {
    const seriesRows = {
      "dm5:m123": {
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
      },
      "comicbus:77": {
        seriesKey: "comicbus:77",
        site: "comicbus",
        comicsID: "77",
        title: "Unreferenced",
        cover: "",
        url: "http://www.comicbus.com/html/77.html",
        lastRead: "",
        read: [],
        lastReadTitle: "",
        lastReadHref: "",
        latestChapterID: "c1",
        latestChapterTitle: "Extra Chapter",
        latestChapterHref: "http://www.comicbus.com/online/comic-77.html?ch=1",
      },
    };

    const stores = {
      [SERIES_STORE]: {
        getAll: jest.fn(() => Object.values(seriesRows)),
      },
      [CHAPTERS_STORE]: {
        get: jest.fn((key: [string, string]) =>
          key[0] === "dm5:m123" && key[1] === "m2"
            ? {
                seriesKey: "dm5:m123",
                chapterID: "m2",
                title: "Ch 2",
                href: "https://www.dm5.com/m123/2.html",
                orderIndex: 1,
              }
            : undefined,
        ),
      },
      [SUBSCRIPTIONS_STORE]: {
        getAll: jest.fn(() => [{ seriesKey: "dm5:m123", position: 0 }]),
      },
      [HISTORY_STORE]: {
        getAll: jest.fn(() => [{ seriesKey: "dm5:m123", position: 0 }]),
      },
      [UPDATES_STORE]: {
        getAll: jest.fn(() => [
          { seriesKey: "dm5:m123", chapterID: "m2", position: 0 },
        ]),
      },
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
    rows.loadRowsByPositionInTransaction
      .mockResolvedValueOnce([{ seriesKey: "dm5:m123", position: 0 }])
      .mockResolvedValueOnce([{ seriesKey: "dm5:m123", position: 0 }]);
    rows.loadUpdatesInTransaction.mockResolvedValue([
      { seriesKey: "dm5:m123", chapterID: "m2", position: 0 },
    ]);

    const result = await getPopupFeedSnapshot();

    expect(result).toEqual({
      update: [
        {
          category: "update",
          key: "update_dm5:m123_m2",
          index: 0,
          site: "dm5",
          siteLabel: "DM5",
          comicsID: "m123",
          chapterID: "m2",
          lastReadChapterID: "m1",
          lastChapterID: "m1",
          updateChapterID: "m2",
          continueChapterID: "m1",
          title: "Demo",
          url: "https://www.dm5.com/m123/",
          cover: "cover.jpg",
          lastReadTitle: "Ch 1",
          lastReadHref: "https://www.dm5.com/m123/1.html",
          lastChapterTitle: "Ch 1",
          lastChapterHref: "https://www.dm5.com/m123/1.html",
          updateChapterTitle: "Ch 2",
          updateChapterHref: "https://www.dm5.com/m123/2.html",
          continueHref: "https://www.dm5.com/m123/1.html",
        },
      ],
      updateCount: 1,
      subscribe: [
        {
          category: "subscribe",
          key: "subscribe_dm5:m123_0",
          index: 0,
          site: "dm5",
          siteLabel: "DM5",
          comicsID: "m123",
          chapterID: "",
          lastReadChapterID: "m1",
          lastChapterID: "m1",
          updateChapterID: "",
          continueChapterID: "m1",
          title: "Demo",
          url: "https://www.dm5.com/m123/",
          cover: "cover.jpg",
          lastReadTitle: "Ch 1",
          lastReadHref: "https://www.dm5.com/m123/1.html",
          lastChapterTitle: "Ch 1",
          lastChapterHref: "https://www.dm5.com/m123/1.html",
          updateChapterTitle: "",
          updateChapterHref: "",
          continueHref: "https://www.dm5.com/m123/1.html",
        },
      ],
      history: [
        {
          category: "history",
          key: "history_dm5:m123_0",
          index: 0,
          site: "dm5",
          siteLabel: "DM5",
          comicsID: "m123",
          chapterID: "",
          lastReadChapterID: "m1",
          lastChapterID: "m1",
          updateChapterID: "",
          continueChapterID: "m1",
          title: "Demo",
          url: "https://www.dm5.com/m123/",
          cover: "cover.jpg",
          lastReadTitle: "Ch 1",
          lastReadHref: "https://www.dm5.com/m123/1.html",
          lastChapterTitle: "Ch 1",
          lastChapterHref: "https://www.dm5.com/m123/1.html",
          updateChapterTitle: "",
          updateChapterHref: "",
          continueHref: "https://www.dm5.com/m123/1.html",
        },
      ],
      continueReading: {
        category: "history",
        key: "history_dm5:m123_0",
        index: 0,
        site: "dm5",
        siteLabel: "DM5",
        comicsID: "m123",
        chapterID: "",
        lastReadChapterID: "m1",
        lastChapterID: "m1",
        updateChapterID: "",
        continueChapterID: "m1",
        title: "Demo",
        url: "https://www.dm5.com/m123/",
        cover: "cover.jpg",
        lastReadTitle: "Ch 1",
        lastReadHref: "https://www.dm5.com/m123/1.html",
        lastChapterTitle: "Ch 1",
        lastChapterHref: "https://www.dm5.com/m123/1.html",
        updateChapterTitle: "",
        updateChapterHref: "",
        continueHref: "https://www.dm5.com/m123/1.html",
      },
    });
    expect(stores[SERIES_STORE].getAll).toHaveBeenCalledTimes(1);
    expect(stores[CHAPTERS_STORE].get).toHaveBeenCalledWith(["dm5:m123", "m2"]);
    expect(transaction.objectStore).toHaveBeenCalledWith(SERIES_STORE);
    expect(transaction.objectStore).toHaveBeenCalledWith(CHAPTERS_STORE);
  });

  it("does not read series or chapter stores when the popup feed has no referenced series", async () => {
    const seriesStore = {
      getAll: jest.fn(),
    };
    const chaptersStore = {
      index: jest.fn(),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
      [SUBSCRIPTIONS_STORE]: {
        getAll: jest.fn(() => []),
      },
      [HISTORY_STORE]: {
        getAll: jest.fn(() => []),
      },
      [UPDATES_STORE]: {
        getAll: jest.fn(() => []),
      },
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
    rows.loadRowsByPositionInTransaction
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    rows.loadUpdatesInTransaction.mockResolvedValue([]);

    await expect(getPopupFeedSnapshot()).resolves.toEqual({
      update: [],
      updateCount: 0,
      subscribe: [],
      history: [],
      continueReading: null,
    });

    expect(seriesStore.getAll).not.toHaveBeenCalled();
    expect(chaptersStore.index).not.toHaveBeenCalled();
  });

  it("shares normalized in-flight popup feed queries and clears them after success", async () => {
    let resolveSubscriptions: (rows: []) => void = () => undefined;
    const subscriptionsPromise = new Promise<[]>((resolve) => {
      resolveSubscriptions = resolve;
    });
    const stores = {
      [SERIES_STORE]: { getAll: jest.fn() },
      [CHAPTERS_STORE]: { get: jest.fn() },
      [SUBSCRIPTIONS_STORE]: { getAll: jest.fn() },
      [HISTORY_STORE]: { getAll: jest.fn() },
      [UPDATES_STORE]: { getAll: jest.fn() },
    };
    const transaction = {
      objectStore: jest.fn(
        (storeName: keyof typeof stores) => stores[storeName],
      ),
    };
    const db = { transaction: jest.fn(() => transaction) };
    dbModule.openLibraryDb.mockResolvedValue(db);
    rows.loadRowsByPositionInTransaction
      .mockImplementationOnce(() => subscriptionsPromise)
      .mockResolvedValue([]);
    rows.loadUpdatesInTransaction.mockResolvedValue([]);

    const first = getPopupFeedSnapshot({ updateLimit: 2.9 });
    const overlapping = getPopupFeedSnapshot({ updateLimit: 2 });

    expect(overlapping).toBe(first);
    resolveSubscriptions([]);
    await expect(Promise.all([first, overlapping])).resolves.toHaveLength(2);
    expect(dbModule.openLibraryDb).toHaveBeenCalledTimes(1);

    await getPopupFeedSnapshot({ updateLimit: 2 });
    expect(dbModule.openLibraryDb).toHaveBeenCalledTimes(2);
  });

  it("allows a popup feed query retry after an in-flight rejection", async () => {
    const stores = {
      [SERIES_STORE]: { getAll: jest.fn() },
      [CHAPTERS_STORE]: { get: jest.fn() },
      [SUBSCRIPTIONS_STORE]: { getAll: jest.fn() },
      [HISTORY_STORE]: { getAll: jest.fn() },
      [UPDATES_STORE]: { getAll: jest.fn() },
    };
    const transaction = {
      objectStore: jest.fn(
        (storeName: keyof typeof stores) => stores[storeName],
      ),
    };
    const db = { transaction: jest.fn(() => transaction) };
    dbModule.openLibraryDb.mockResolvedValue(db);
    rows.loadRowsByPositionInTransaction
      .mockRejectedValueOnce(new Error("temporary query failure"))
      .mockResolvedValue([]);
    rows.loadUpdatesInTransaction.mockResolvedValue([]);

    await expect(getPopupFeedSnapshot()).rejects.toThrow(
      "temporary query failure",
    );
    await expect(getPopupFeedSnapshot()).resolves.toMatchObject({
      update: [],
      subscribe: [],
      history: [],
    });
    expect(dbModule.openLibraryDb).toHaveBeenCalledTimes(2);
  });

  it("limits popup updates for the popup view and flags truncated results", async () => {
    const seriesRows = {
      "dm5:m123": {
        seriesKey: "dm5:m123",
        site: "dm5",
        comicsID: "m123",
        title: "Demo",
        cover: "cover.jpg",
        url: "https://www.dm5.com/m123/",
        lastRead: "m1",
        lastReadTitle: "Ch 1",
        lastReadHref: "https://www.dm5.com/m123/1.html",
        latestChapterID: "m3",
        latestChapterTitle: "Ch 3",
        latestChapterHref: "https://www.dm5.com/m123/3.html",
      },
    };
    const stores = {
      [SERIES_STORE]: {
        getAll: jest.fn(() => Object.values(seriesRows)),
      },
      [CHAPTERS_STORE]: {
        get: jest.fn((key: [string, string]) => ({
          seriesKey: key[0],
          chapterID: key[1],
          title: `Ch ${key[1].slice(1)}`,
          href: `https://www.dm5.com/m123/${key[1].slice(1)}.html`,
          orderIndex: Number(key[1].slice(1)) - 1,
        })),
      },
      [SUBSCRIPTIONS_STORE]: {
        getAll: jest.fn(() => []),
      },
      [HISTORY_STORE]: {
        getAll: jest.fn(() => []),
      },
      [UPDATES_STORE]: {
        count: jest.fn(() => 3),
        getAll: jest.fn(() => []),
      },
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
    rows.loadRowsByPositionInTransaction
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    rows.loadUpdatesInTransaction.mockResolvedValue([
      { seriesKey: "dm5:m123", chapterID: "m3", position: 0 },
      { seriesKey: "dm5:m123", chapterID: "m2", position: 1 },
      { seriesKey: "dm5:m123", chapterID: "m1", position: 2 },
    ]);

    const result = await getPopupFeedSnapshot({ updateLimit: 2 });

    expect(rows.loadUpdatesInTransaction).toHaveBeenCalledWith(
      stores[UPDATES_STORE],
      3,
    );
    expect(result.updatesTruncated).toBe(true);
    expect(result.updateCount).toBe(3);
    expect(result.update).toHaveLength(2);
    expect(result.update.map((entry) => entry.chapterID)).toEqual([
      "m3",
      "m2",
    ]);
    expect(stores[UPDATES_STORE].count).toHaveBeenCalled();
    expect(stores[CHAPTERS_STORE].get).toHaveBeenNthCalledWith(1, [
      "dm5:m123",
      "m3",
    ]);
    expect(stores[CHAPTERS_STORE].get).toHaveBeenNthCalledWith(2, [
      "dm5:m123",
      "m2",
    ]);
    expect(stores[CHAPTERS_STORE].get).toHaveBeenCalledTimes(2);
  });

  it("loads series cover without hydrating chapter or read state", async () => {
    const seriesStore = {
      get: jest.fn(() => ({
        seriesKey: "dm5:m123",
        site: "dm5",
        comicsID: "m123",
        title: "Demo",
        cover: "cover.jpg",
        url: "https://www.dm5.com/m123/",
        lastRead: "m1",
        lastReadTitle: "Ch 1",
        lastReadHref: "https://www.dm5.com/m123/1.html",
        latestChapterID: "m2",
        latestChapterTitle: "Ch 2",
        latestChapterHref: "https://www.dm5.com/m123/2.html",
      })),
    };
    const transaction = {
      objectStore: jest.fn(() => seriesStore),
    };
    const db = {
      transaction: jest.fn(() => transaction),
    };
    dbModule.openLibraryDb.mockResolvedValue(db);

    await expect(getSeriesCover("dm5:m123")).resolves.toBe("cover.jpg");

    expect(db.transaction).toHaveBeenCalledWith([SERIES_STORE], "readonly");
    expect(seriesStore.get).toHaveBeenCalledWith("dm5:m123");
    expect(rows.loadReadChapterIDsInTransaction).not.toHaveBeenCalled();
  });

  it("loads reader series state and subscription in a single query", async () => {
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
    const subscriptionsStore = {
      get: jest.fn(() => ({ seriesKey: "dm5:m123", position: 0 })),
    };
    const readsStore = {};
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
      [READS_STORE]: readsStore,
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
    dbModule.openLibraryDb.mockResolvedValue(db);
    rows.loadReadChapterIDsInTransaction.mockResolvedValue(["m1"]);

    const result = await getReaderSeriesState("dm5:m123");

    expect(result).toEqual({
      series: {
        site: "dm5",
        comicsID: "m123",
        title: "Demo",
        cover: "cover.jpg",
        url: "https://www.dm5.com/m123/",
        chapterList: ["m1"],
        chapters: {
          m1: {
            title: "Ch 1",
            href: "https://www.dm5.com/m123/1.html",
          },
        },
        lastRead: "m1",
        read: ["m1"],
      },
      subscribed: true,
    });
    expect(db.transaction).toHaveBeenCalledWith(
      [SERIES_STORE, CHAPTERS_STORE, READS_STORE, SUBSCRIPTIONS_STORE],
      "readonly",
    );
  });

  it("loads reader sync state without hydrating chapters or reads", async () => {
    const chaptersStore = {
      index: jest.fn(),
    };
    const readsStore = {
      index: jest.fn(),
    };
    const seriesStore = {
      get: jest.fn(() => ({
        seriesKey: "dm5:m123",
      })),
    };
    const subscriptionsStore = {
      get: jest.fn(() => ({ seriesKey: "dm5:m123", position: 0 })),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
      [READS_STORE]: readsStore,
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
    dbModule.openLibraryDb.mockResolvedValue(db);

    await expect(getReaderSeriesSyncState("dm5:m123")).resolves.toEqual({
      exists: true,
      subscribed: true,
    });
    expect(db.transaction).toHaveBeenCalledWith(
      [SERIES_STORE, SUBSCRIPTIONS_STORE],
      "readonly",
    );
    expect(chaptersStore.index).not.toHaveBeenCalled();
    expect(readsStore.index).not.toHaveBeenCalled();
    expect(rows.loadReadChapterIDsInTransaction).not.toHaveBeenCalled();
  });

  it("loads refresh candidates in one transaction and preserves dangling subscriptions", async () => {
    const seriesStore = {
      getAll: jest.fn(() => [
        {
          seriesKey: "dm5:m-oldest",
          site: "dm5",
          comicsID: "m-oldest",
          title: "Oldest",
          cover: "cover.jpg",
          url: "https://www.dm5.com/m-oldest/",
          lastRead: "",
          lastReadTitle: "",
          lastReadHref: "",
          latestChapterID: "m2",
          latestChapterTitle: "Ch 2",
          latestChapterHref: "https://www.dm5.com/m2/",
        },
      ]),
    };
    const subscriptionsStore = { getAll: jest.fn() };
    const stores = {
      [SERIES_STORE]: seriesStore,
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
    dbModule.openLibraryDb.mockResolvedValue(db);

    rows.loadSubscriptionKeysByCheckedAtInTransaction.mockResolvedValue([
      "dm5:m-oldest",
      "dm5:m-middle",
    ]);

    await expect(listBackgroundRefreshCandidates(2)).resolves.toEqual([
      {
        seriesKey: "dm5:m-oldest",
        site: "dm5",
        comicsID: "m-oldest",
        url: "https://www.dm5.com/m-oldest/",
        latestChapterID: "m2",
      },
      {
        seriesKey: "dm5:m-middle",
        site: "dm5",
        comicsID: "m-middle",
        url: "",
        latestChapterID: "",
      },
    ]);
    expect(db.transaction).toHaveBeenCalledWith(
      [SUBSCRIPTIONS_STORE, SERIES_STORE],
      "readonly",
    );
    expect(rows.loadSubscriptionKeysByCheckedAtInTransaction).toHaveBeenCalledWith(
      subscriptionsStore,
      2,
    );
    expect(seriesStore.getAll).toHaveBeenCalledTimes(1);
  });
});
