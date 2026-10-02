import { fetchImgList } from "@domain/actions/reader";
import {
  updateChapterLatestIndex,
  updateSubscribe,
} from "@domain/reducers/comics";
import { Subject } from "rxjs";

import readerSyncEpic from "./readerSyncEpic";

jest.mock("@infra/services/library/reader", () => ({
  getReaderSeriesState: jest.fn(),
  getReaderSeriesSyncState: jest.fn(),
  subscribeToLibrarySignal: jest.fn(),
}));
jest.mock("@utils/devLog", () => ({
  devLog: jest.fn(),
}));
jest.mock("@utils/navigation", () => ({
  closeCurrentTab: jest.fn(),
}));

const {
  getReaderSeriesState,
  getReaderSeriesSyncState,
  subscribeToLibrarySignal,
} = jest.requireMock("@infra/services/library/reader");
const { closeCurrentTab } = jest.requireMock("@utils/navigation");

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createSignal(
  seriesKeys: string[] = ["dm5:m123"],
  scopes: Array<"chapters" | "series" | "subscriptions" | "updates"> = [
    "updates",
  ],
) {
  return {
    revision: "rev-1",
    changedAt: 1,
    source: "test",
    dbSchemaVersion: 1,
    scopes,
    seriesKeys,
  };
}

describe("readerSyncEpic", () => {
  let listener: ((signal: ReturnType<typeof createSignal>) => void) | null;
  let unsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    listener = null;
    unsubscribe = jest.fn();
    subscribeToLibrarySignal.mockImplementation((nextListener: typeof listener) => {
      listener = nextListener;
      return unsubscribe;
    });
    closeCurrentTab.mockResolvedValue(undefined);
  });

  it("ignores unrelated signals and updates subscription state for the current series", async () => {
    getReaderSeriesSyncState.mockResolvedValue({
      exists: true,
      subscribed: false,
    });
    const actions: unknown[] = [];
    const subscription = readerSyncEpic(new Subject(), {
      value: { comics: { seriesKey: "dm5:m123" } } as never,
    }).subscribe((action) => actions.push(action));

    listener?.(createSignal(["dm5:m999"]));
    expect(getReaderSeriesSyncState).not.toHaveBeenCalled();

    listener?.(createSignal());
    await flushPromises();

    expect(getReaderSeriesSyncState).toHaveBeenCalledWith("dm5:m123");
    expect(actions).toEqual([updateSubscribe(false)]);

    subscription.unsubscribe();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("hydrates newly refreshed chapters and preloads the next live chapter", async () => {
    getReaderSeriesState.mockResolvedValue({
      series: {
        site: "dm5",
        comicsID: "m123",
        title: "Series",
        cover: "",
        url: "https://www.dm5.com/manhua-series/",
        chapterList: ["c4", "c3", "c2"],
        chapters: {
          c4: { title: "Chapter 4", href: "https://example.com/c4" },
          c3: { title: "Chapter 3", href: "https://example.com/c3" },
          c2: { title: "Chapter 2", href: "https://example.com/c2" },
        },
        lastRead: "c3",
        read: ["c2", "c3"],
      },
      subscribed: true,
    });
    const actions: unknown[] = [];
    const subscription = readerSyncEpic(new Subject(), {
      value: {
        comics: {
          canPreloadPreviousChapter: true,
          chapterLatestIndex: -1,
          chapterList: ["c3", "c2"],
          chapterNowIndex: 0,
          imageList: {
            result: [0, 1],
            entity: {
              0: { chapter: "c3", type: "image" },
              1: { chapter: "c3", type: "end" },
            },
          },
          pendingChapterGate: null,
          seriesKey: "dm5:m123",
        },
      } as never,
    }).subscribe((action) => actions.push(action));

    listener?.(createSignal(["dm5:m123"], ["chapters", "series", "updates"]));
    await flushPromises();

    expect(getReaderSeriesState).toHaveBeenCalledWith("dm5:m123");
    expect(getReaderSeriesSyncState).not.toHaveBeenCalled();
    expect(actions).toEqual([
      {
        type: "SYNC_READER_SERIES_STATE",
        readerSeries: {
          chapterList: ["c4", "c3", "c2"],
          chapters: {
            c4: { title: "Chapter 4" },
            c3: { title: "Chapter 3" },
            c2: { title: "Chapter 2" },
          },
          read: ["c2", "c3"],
          subscribed: true,
          title: "Series",
        },
      },
      fetchImgList(0),
      updateChapterLatestIndex(0),
    ]);

    subscription.unsubscribe();
  });

  it("recovers from query failures and closes the tab when the current series is removed", async () => {
    getReaderSeriesSyncState
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce({ exists: false, subscribed: false });
    const actions: unknown[] = [];
    const subscription = readerSyncEpic(new Subject(), {
      value: { comics: { seriesKey: "dm5:m123" } } as never,
    }).subscribe((action) => actions.push(action));

    listener?.(createSignal());
    await flushPromises();
    listener?.(createSignal());
    await flushPromises();

    expect(closeCurrentTab).toHaveBeenCalledTimes(1);
    expect(actions).toEqual([]);
    subscription.unsubscribe();
  });

  it("ignores an older query result after a newer signal", async () => {
    const first = createDeferred<{ exists: true; subscribed: boolean }>();
    const second = createDeferred<{ exists: true; subscribed: boolean }>();
    getReaderSeriesSyncState
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const actions: unknown[] = [];
    const subscription = readerSyncEpic(new Subject(), {
      value: { comics: { seriesKey: "dm5:m123" } } as never,
    }).subscribe((action) => actions.push(action));

    listener?.(createSignal());
    listener?.(createSignal());
    second.resolve({ exists: true, subscribed: false });
    await flushPromises();
    first.resolve({ exists: true, subscribed: true });
    await flushPromises();

    expect(actions).toEqual([updateSubscribe(false)]);
    subscription.unsubscribe();
  });

  it("does not let a subscription signal cancel an in-flight chapter sync", async () => {
    const chapterSync = createDeferred<any>();
    getReaderSeriesState.mockImplementationOnce(() => chapterSync.promise);
    getReaderSeriesSyncState.mockResolvedValue({
      exists: true,
      subscribed: false,
    });
    const actions: any[] = [];
    const subscription = readerSyncEpic(new Subject(), {
      value: {
        comics: {
          canPreloadPreviousChapter: true,
          chapterLatestIndex: 0,
          chapterList: ["c3"],
          chapterNowIndex: 0,
          imageList: { result: [], entity: {} },
          pendingChapterGate: null,
          seriesKey: "dm5:m123",
        },
      } as never,
    }).subscribe((action) => actions.push(action));

    listener?.(createSignal(["dm5:m123"], ["chapters"]));
    listener?.(createSignal(["dm5:m123"], ["subscriptions"]));
    await flushPromises();
    expect(actions).toEqual([updateSubscribe(false)]);

    chapterSync.resolve({
      series: {
        site: "dm5",
        comicsID: "m123",
        title: "Series",
        cover: "",
        url: "https://www.dm5.com/manhua-series/",
        chapterList: ["c4", "c3"],
        chapters: {
          c4: { title: "Chapter 4", href: "https://example.com/c4" },
          c3: { title: "Chapter 3", href: "https://example.com/c3" },
        },
        lastRead: "c3",
        read: ["c3"],
      },
      subscribed: true,
    });
    await flushPromises();

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "SYNC_READER_SERIES_STATE" }),
      ]),
    );
    subscription.unsubscribe();
  });

  it("keeps listening when closing a removed series tab fails", async () => {
    getReaderSeriesSyncState
      .mockResolvedValueOnce({ exists: false, subscribed: false })
      .mockResolvedValueOnce({ exists: true, subscribed: true });
    closeCurrentTab.mockRejectedValueOnce(new Error("cannot close"));
    const actions: unknown[] = [];
    const subscription = readerSyncEpic(new Subject(), {
      value: { comics: { seriesKey: "dm5:m123" } } as never,
    }).subscribe((action) => actions.push(action));

    listener?.(createSignal());
    await flushPromises();
    listener?.(createSignal());
    await flushPromises();

    expect(actions).toEqual([updateSubscribe(true)]);
    subscription.unsubscribe();
  });
});
