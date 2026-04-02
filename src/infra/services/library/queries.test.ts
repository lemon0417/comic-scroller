import {
  CHAPTERS_STORE,
  HISTORY_STORE,
  SERIES_STORE,
  SUBSCRIPTIONS_STORE,
  UPDATES_STORE,
} from "./schema";
import { getPopupFeedSnapshot } from "./queries";

jest.mock("./shared", () => {
  const actual = jest.requireActual("./shared");
  return {
    ...actual,
    ensureLibraryReady: jest.fn(() => Promise.resolve()),
    openLibraryDb: jest.fn(),
    requestToPromise: jest.fn((value) => Promise.resolve(value)),
    transactionDone: jest.fn(() => Promise.resolve()),
  };
});

const shared = jest.requireMock("./shared") as {
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
        updatedAt: 1,
      },
    };
    const chapterRows = {
      "dm5:m123": [
        {
          seriesKey: "dm5:m123",
          chapterID: "m1",
          title: "Ch 1",
          href: "https://www.dm5.com/m123/1.html",
          orderIndex: 0,
        },
        {
          seriesKey: "dm5:m123",
          chapterID: "m2",
          title: "Ch 2",
          href: "https://www.dm5.com/m123/2.html",
          orderIndex: 1,
        },
      ],
    };

    const stores = {
      [SERIES_STORE]: {
        get: jest.fn((seriesKey: string) => seriesRows[seriesKey as keyof typeof seriesRows]),
      },
      [CHAPTERS_STORE]: {
        index: jest.fn(() => ({
          getAll: jest.fn(
            (seriesKey: string) => chapterRows[seriesKey as keyof typeof chapterRows] || [],
          ),
        })),
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
    expect(stores[SERIES_STORE].get).toHaveBeenCalledWith("dm5:m123");
    expect(transaction.objectStore).toHaveBeenCalledWith(SERIES_STORE);
    expect(transaction.objectStore).toHaveBeenCalledWith(CHAPTERS_STORE);
  });
});
