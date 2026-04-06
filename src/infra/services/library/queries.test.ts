import {
  getBackgroundSeriesState,
  getPopupFeedSnapshot,
  getReaderSeriesState,
  listSubscriptionKeys,
} from "./queries";
import {
  CHAPTERS_STORE,
  HISTORY_STORE,
  READS_STORE,
  SERIES_STORE,
  SUBSCRIPTIONS_STORE,
  UPDATES_STORE,
} from "./schema";

jest.mock("./shared", () => {
  const actual = jest.requireActual("./shared");
  return {
    ...actual,
    ensureLibraryReady: jest.fn(() => Promise.resolve()),
    loadRowsByPositionInTransaction: jest.fn(),
    loadReadChapterIDsInTransaction: jest.fn(() => Promise.resolve([])),
    loadSubscriptionKeysByCheckedAtInTransaction: jest.fn(),
    loadUpdatesInTransaction: jest.fn(),
    openLibraryDb: jest.fn(),
    requestToPromise: jest.fn((value) => Promise.resolve(value)),
    transactionDone: jest.fn(() => Promise.resolve()),
  };
});

const shared = jest.requireMock("./shared") as {
  loadRowsByPositionInTransaction: jest.Mock;
  loadReadChapterIDsInTransaction: jest.Mock;
  loadSubscriptionKeysByCheckedAtInTransaction: jest.Mock;
  loadUpdatesInTransaction: jest.Mock;
  openLibraryDb: jest.Mock;
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
      "sf:77": {
        seriesKey: "sf:77",
        site: "sf",
        comicsID: "77",
        title: "Unreferenced",
        cover: "",
        url: "http://comic.sfacg.com/HTML/77/",
        lastRead: "",
        read: [],
        lastReadTitle: "",
        lastReadHref: "",
        latestChapterID: "c1",
        latestChapterTitle: "Extra Chapter",
        latestChapterHref: "http://comic.sfacg.com/HTML/77/c1.html",
      },
    };

    const stores = {
      [SERIES_STORE]: {
        get: jest.fn((seriesKey: keyof typeof seriesRows) => seriesRows[seriesKey]),
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
          { seriesKey: "dm5:m123", chapterID: "m2", createdAt: 2, position: 0 },
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
    shared.openLibraryDb.mockResolvedValue(db);
    shared.loadRowsByPositionInTransaction
      .mockResolvedValueOnce([{ seriesKey: "dm5:m123", position: 0 }])
      .mockResolvedValueOnce([{ seriesKey: "dm5:m123", position: 0 }]);
    shared.loadUpdatesInTransaction.mockResolvedValue([
      { seriesKey: "dm5:m123", chapterID: "m2", createdAt: 2, position: 0 },
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
    expect(stores[SERIES_STORE].get).toHaveBeenCalledTimes(1);
    expect(stores[SERIES_STORE].get).toHaveBeenCalledWith("dm5:m123");
    expect(stores[CHAPTERS_STORE].get).toHaveBeenCalledWith(["dm5:m123", "m2"]);
    expect(transaction.objectStore).toHaveBeenCalledWith(SERIES_STORE);
    expect(transaction.objectStore).toHaveBeenCalledWith(CHAPTERS_STORE);
  });

  it("does not read series or chapter stores when the popup feed has no referenced series", async () => {
    const seriesStore = {
      get: jest.fn(),
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
    shared.openLibraryDb.mockResolvedValue(db);
    shared.loadRowsByPositionInTransaction
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    shared.loadUpdatesInTransaction.mockResolvedValue([]);

    await expect(getPopupFeedSnapshot()).resolves.toEqual({
      update: [],
      subscribe: [],
      history: [],
      continueReading: null,
    });

    expect(seriesStore.get).not.toHaveBeenCalled();
    expect(chaptersStore.index).not.toHaveBeenCalled();
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
    shared.openLibraryDb.mockResolvedValue(db);
    shared.loadReadChapterIDsInTransaction.mockResolvedValue(["m1"]);

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

  it("loads background series state with chapter ids only", async () => {
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
    };
    const chapterIndex = {
      getAllKeys: jest.fn(() => [
        ["dm5:m123", "m2"],
        ["dm5:m123", "m1"],
      ]),
    };
    const chaptersStore = {
      index: jest.fn(() => chapterIndex),
    };
    const stores = {
      [SERIES_STORE]: seriesStore,
      [CHAPTERS_STORE]: chaptersStore,
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

    await expect(getBackgroundSeriesState("dm5:m123")).resolves.toEqual({
      url: "https://www.dm5.com/m123/",
      cover: "cover.jpg",
      knownChapterIDs: ["m2", "m1"],
    });

    expect(chaptersStore.index).toHaveBeenCalledWith("seriesKey");
    expect(chapterIndex.getAllKeys).toHaveBeenCalledWith("dm5:m123");
    expect(db.transaction).toHaveBeenCalledWith(
      [SERIES_STORE, CHAPTERS_STORE],
      "readonly",
    );
  });

  it("returns subscriptions ordered by oldest checkedAt and respects the query limit", async () => {
    const subscriptionsStore = {
      getAll: jest.fn(() => [
        { seriesKey: "dm5:m-newest", position: 0, checkedAt: 300 },
        { seriesKey: "dm5:m-oldest", position: 1, checkedAt: 100 },
        { seriesKey: "dm5:m-middle", position: 2, checkedAt: 200 },
      ]),
    };
    const transaction = {
      objectStore: jest.fn(() => subscriptionsStore),
    };
    const db = {
      transaction: jest.fn(() => transaction),
    };
    shared.openLibraryDb.mockResolvedValue(db);
    shared.loadSubscriptionKeysByCheckedAtInTransaction.mockResolvedValue([
      "dm5:m-oldest",
      "dm5:m-middle",
    ]);

    await expect(listSubscriptionKeys(2)).resolves.toEqual([
      "dm5:m-oldest",
      "dm5:m-middle",
    ]);
  });
});
