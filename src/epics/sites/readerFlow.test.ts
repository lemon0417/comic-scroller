import {
  fetchChapter,
  fetchImgList,
  fetchImgSrc,
  updateRead,
} from "@domain/actions/reader";
import comicsReducer, {
  clearPendingChapterGate,
  concatImageList,
  receivePendingChapterGate,
  setChapterLoadFailed,
  startPendingChapterGate,
  updateCanPreloadPreviousChapter,
  updateChapterLatestIndex,
  updateChapterList,
  updateChapterNowIndex,
  updateSiteInfo,
} from "@domain/reducers/comics";
import {
  applyReaderSeriesState,
  applyReadProgress,
} from "@infra/services/library/reader";
import { getNativeChapterURL } from "@sites/registry";
import { lastValueFrom, of, Subject, throwError } from "rxjs";
import { toArray } from "rxjs/operators";

import {
  createFetchChapterEpic,
  createFetchImgListEpic,
  createUpdateReadEpic,
  getRequestedImageIds,
  normalizeReaderSiteMeta,
} from "./readerFlow";

jest.mock("@infra/services/library/reader", () => ({
  applyReaderSeriesState: jest.fn(async () => ({
    seriesKey: "dm5:demo-series",
    readChapterIDs: [],
    subscribed: false,
    updatesCount: 0,
  })),
  applyReadProgress: jest.fn(),
}));

describe("readerFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).chrome = {
      action: {
        setBadgeText: jest.fn(),
      },
    };
  });

  it("dedupes repeated chapter ids in reader metadata", () => {
    expect(
      normalizeReaderSiteMeta({
        title: "Demo",
        cover: "",
        chapterList: ["c3", "c2", "c2", "c1"],
        chapters: {
          c3: { title: "C3", href: "https://example.com/c3" },
          c2: { title: "C2", href: "https://example.com/c2" },
          c1: { title: "C1", href: "https://example.com/c1" },
        },
      }).chapterList,
    ).toEqual(["c3", "c2", "c1"]);
  });

  it("only reads image ids inside the requested range", () => {
    const result = [0, 1, 2, 3];
    Object.defineProperty(result, "3", {
      configurable: true,
      get() {
        throw new Error(
          "should not read image ids outside the requested range",
        );
      },
    });

    expect(getRequestedImageIds({ begin: 0, end: 1, result })).toEqual([0, 1]);
  });

  it("uses the deduped chapter list when hydrating reader metadata", async () => {
    const fetchChapterImages$ = jest.fn(() =>
      of({
        chapterID: "c2",
        seriesID: "demo-series",
        comicUrl: "https://example.com/demo",
        imgList: [{ chapter: "c2", src: "https://example.com/c2-1.jpg" }],
      }),
    );
    const fetchMeta$ = jest.fn(() =>
      of({
        title: "Demo",
        cover: "",
        chapterList: ["c3", "c2", "c2", "c1"],
        chapters: {
          c3: { title: "C3", href: "https://example.com/c3" },
          c2: { title: "C2", href: "https://example.com/c2" },
          c1: { title: "C1", href: "https://example.com/c1" },
        },
      }),
    );

    const output = await lastValueFrom(
      createFetchChapterEpic({
        site: "dm5",
        baseURL: "https://www.dm5.com",
        fetchChapterImages$,
        fetchMeta$,
      })(of(fetchChapter("c2")), {} as any).pipe(toArray()),
    );

    expect(applyReaderSeriesState).toHaveBeenCalledWith(
      "dm5",
      "demo-series",
      expect.objectContaining({
        chapterList: ["c3", "c2", "c1"],
      }),
      "c2",
      { requireExistingSeries: false },
    );
    expect(output).toEqual(
      expect.arrayContaining([
        updateChapterList(["c3", "c2", "c1"]),
        updateChapterNowIndex(1),
        fetchImgList(0),
        updateChapterLatestIndex(1),
      ]),
    );
  });

  it.each([
    ["dm5", "https://www.dm5.com", "m100"],
    ["8comic", "https://www.8comic.com", "online/new-105.html?ch=420"],
    ["manhuagui", "https://www.manhuagui.com", "comic/49169/910633.html"],
    ["baozimh", "https://www.baozimh.com", "comic/chapter/demo/0_0.html"],
    ["mycomic", "https://mycomic.com", "chapters/790421"],
  ] as const)(
    "keeps a native link on the first failed %s request",
    async (site, baseURL, chapterID) => {
      const fetchChapterImages$ = jest.fn(() => of());
      const fetchMeta$ = jest.fn();
      const initialState = comicsReducer(
        undefined,
        fetchChapter(chapterID),
      );

      const output = await lastValueFrom(
        createFetchChapterEpic({
          site,
          baseURL,
          fetchChapterImages$,
          fetchMeta$,
        })(of(fetchChapter(chapterID)), {
          value: { comics: initialState },
        } as any).pipe(toArray()),
      );

      expect(fetchMeta$).not.toHaveBeenCalled();
      expect(output).toEqual([
        updateSiteInfo(site, baseURL),
        setChapterLoadFailed(),
      ]);
      const failedState = output.reduce(
        (state, action) => comicsReducer(state, action as any),
        initialState,
      );
      expect(failedState.chapterLoadStatus).toBe("failed");
      expect(failedState.imageList.result).toEqual([]);
      expect(
        getNativeChapterURL(failedState.site, failedState.requestedChapter),
      ).toContain("cs_open_native=1");
    },
  );

  it("discards metadata that arrives after cleanup invalidates the reader", () => {
    const metadata = new Subject<any>();
    const state$ = {
      value: {
        comics: {
          seriesKey: "dm5:demo-series",
          readerGeneration: 3,
          persistenceInvalidated: false,
        },
      },
    };
    const subscription = createFetchChapterEpic({
      site: "dm5",
      baseURL: "https://www.dm5.com",
      fetchChapterImages$: () =>
        of({
          chapterID: "c1",
          seriesID: "demo-series",
          comicUrl: "https://example.com/demo",
          imgList: [],
        }),
      fetchMeta$: () => metadata,
    })(of(fetchChapter("c1")), state$ as any).subscribe();
    state$.value.comics.readerGeneration += 1;
    state$.value.comics.persistenceInvalidated = true;
    metadata.next({ title: "Late", chapters: {}, chapterList: [] });
    metadata.complete();
    expect(applyReaderSeriesState).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it("does not write reading progress once persistence is invalidated", async () => {
    const result = await lastValueFrom(
      createUpdateReadEpic("dm5")(of(updateRead(0)), {
        value: {
          comics: {
            comicsID: "123",
            chapterList: ["c1"],
            persistenceInvalidated: true,
          },
        },
      } as any).pipe(toArray()),
    );
    expect(result).toEqual([]);
    expect(applyReadProgress).not.toHaveBeenCalled();
  });

  it("keeps handling chapters after a chapter request errors", async () => {
    const fetchChapterImages$ = jest
      .fn()
      .mockReturnValueOnce(throwError(() => new Error("chapter failed")))
      .mockReturnValueOnce(
        of({
          chapterID: "c1",
          seriesID: "demo-series",
          comicUrl: "https://example.com/demo",
          imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
        }),
      );
    const fetchMeta$ = jest.fn(() =>
      of({
        title: "Demo",
        cover: "",
        chapterList: ["c1"],
        chapters: {
          c1: { title: "C1", href: "https://example.com/c1" },
        },
      }),
    );
    const action$ = new Subject<any>();
    const outputPromise = lastValueFrom(
      createFetchChapterEpic({
        site: "dm5",
        baseURL: "https://www.dm5.com",
        fetchChapterImages$,
        fetchMeta$,
      })(action$, {} as any).pipe(toArray()),
    );

    action$.next(fetchChapter("c0"));
    action$.next(fetchChapter("c1"));
    action$.complete();

    const output = await outputPromise;
    expect(output).toEqual(
      expect.arrayContaining([
        updateSiteInfo("dm5", "https://www.dm5.com"),
        setChapterLoadFailed(),
      ]),
    );
    expect(output).toEqual(expect.arrayContaining([updateChapterList(["c1"])]));
    expect(fetchChapterImages$).toHaveBeenCalledTimes(2);
  });

  it("keeps handling chapters after metadata fetch errors", async () => {
    const fetchChapterImages$ = jest.fn((chapterID: string) =>
      of({
        chapterID,
        seriesID: "demo-series",
        comicUrl: "https://example.com/demo",
        imgList: [
          { chapter: chapterID, src: `https://example.com/${chapterID}-1.jpg` },
        ],
      }),
    );
    const fetchMeta$ = jest
      .fn()
      .mockReturnValueOnce(throwError(() => new Error("metadata failed")))
      .mockReturnValueOnce(
        of({
          title: "Demo",
          cover: "",
          chapterList: ["c2", "c1"],
          chapters: {
            c2: { title: "C2", href: "https://example.com/c2" },
            c1: { title: "C1", href: "https://example.com/c1" },
          },
        }),
      );
    const action$ = new Subject<any>();
    const outputPromise = lastValueFrom(
      createFetchChapterEpic({
        site: "dm5",
        baseURL: "https://www.dm5.com",
        fetchChapterImages$,
        fetchMeta$,
      })(action$, {} as any).pipe(toArray()),
    );

    action$.next(fetchChapter("c1"));
    action$.next(fetchChapter("c2"));
    action$.complete();

    const output = await outputPromise;
    expect(output).not.toContainEqual(setChapterLoadFailed());
    expect(output).toEqual(
      expect.arrayContaining([
        updateChapterList(["c2", "c1"]),
        updateChapterNowIndex(0),
      ]),
    );
    expect(fetchMeta$).toHaveBeenCalledTimes(2);
  });

  it("keeps handling chapters after reader persistence errors", async () => {
    const applyReaderSeriesStateMock = applyReaderSeriesState as jest.Mock;
    applyReaderSeriesStateMock
      .mockRejectedValueOnce(new Error("persistence failed"))
      .mockResolvedValueOnce({
        seriesKey: "dm5:demo-series",
        readChapterIDs: [],
        subscribed: false,
        updatesCount: 0,
      });
    const fetchChapterImages$ = jest.fn((chapterID: string) =>
      of({
        chapterID,
        seriesID: "demo-series",
        comicUrl: "https://example.com/demo",
        imgList: [
          { chapter: chapterID, src: `https://example.com/${chapterID}-1.jpg` },
        ],
      }),
    );
    const fetchMeta$ = jest.fn(() =>
      of({
        title: "Demo",
        cover: "",
        chapterList: ["c2", "c1"],
        chapters: {
          c2: { title: "C2", href: "https://example.com/c2" },
          c1: { title: "C1", href: "https://example.com/c1" },
        },
      }),
    );
    const action$ = new Subject<any>();
    const outputPromise = lastValueFrom(
      createFetchChapterEpic({
        site: "dm5",
        baseURL: "https://www.dm5.com",
        fetchChapterImages$,
        fetchMeta$,
      })(action$, {} as any).pipe(toArray()),
    );

    action$.next(fetchChapter("c1"));
    action$.next(fetchChapter("c2"));
    action$.complete();

    const output = await outputPromise;
    expect(output).not.toContainEqual(setChapterLoadFailed());
    expect(output).toEqual(
      expect.arrayContaining([updateChapterList(["c2", "c1"])]),
    );
    expect(applyReaderSeriesStateMock).toHaveBeenCalledTimes(2);
  });

  it("dedupes in-flight preload requests for the same chapter", async () => {
    const chapterImages$ = new Subject<{
      chapterID: string;
      seriesID: string;
      comicUrl: string;
      imgList: Array<{ chapter: string; src: string }>;
    }>();
    const fetchChapterImages$ = jest.fn(() => chapterImages$);
    const epic = createFetchImgListEpic(fetchChapterImages$);
    const state$ = {
      value: {
        comics: {
          chapterList: ["c2", "c1"],
          imageList: {
            result: [0],
            entity: {
              0: { chapter: "c2" },
            },
          },
        },
      },
    };

    const outputPromise = lastValueFrom(
      epic(of(fetchImgList(1), fetchImgList(1)), state$ as any).pipe(toArray()),
    );

    expect(fetchChapterImages$).toHaveBeenCalledTimes(1);
    expect(fetchChapterImages$).toHaveBeenCalledWith("c1");

    chapterImages$.next({
      chapterID: "c1",
      seriesID: "demo-series",
      comicUrl: "https://example.com/demo",
      imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
    });
    chapterImages$.complete();

    await expect(outputPromise).resolves.toEqual([
      startPendingChapterGate({
        blockingChapterId: "c2",
        chapterId: "c1",
        chapterIndex: 1,
        readerGeneration: 0,
        status: "fetching",
      }),
      receivePendingChapterGate({
        blockingChapterId: "c2",
        chapterId: "c1",
        chapterIndex: 1,
        readerGeneration: 0,
        status: "queued",
        canPreloadPreviousChapter: true,
        imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
      }),
      updateChapterLatestIndex(1),
    ]);
  });

  it("skips preloading a chapter that is already in the reader image list", async () => {
    const fetchChapterImages$ = jest.fn(() =>
      of({
        chapterID: "c1",
        seriesID: "demo-series",
        comicUrl: "https://example.com/demo",
        imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
      }),
    );
    const epic = createFetchImgListEpic(fetchChapterImages$);
    const state$ = {
      value: {
        comics: {
          chapterList: ["c2", "c1"],
          imageList: {
            result: [0, 1],
            entity: {
              0: { chapter: "c2" },
              1: { chapter: "c1" },
            },
          },
        },
      },
    };

    const output = await lastValueFrom(
      epic(of(fetchImgList(1)), state$ as any).pipe(toArray()),
    );

    expect(fetchChapterImages$).not.toHaveBeenCalled();
    expect(output).toEqual([]);
  });

  it("preloads the first image range when the reader has no existing images", async () => {
    const fetchChapterImages$ = jest.fn(() =>
      of({
        chapterID: "c1",
        seriesID: "demo-series",
        comicUrl: "https://example.com/demo",
        imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
      }),
    );
    const epic = createFetchImgListEpic(fetchChapterImages$);
    const state$ = {
      value: {
        comics: {
          chapterList: ["c1"],
          imageList: {
            result: [],
            entity: {},
          },
        },
      },
    };

    const output = await lastValueFrom(
      epic(of(fetchImgList(0)), state$ as any).pipe(toArray()),
    );

    expect(output).toEqual([
      concatImageList([{ chapter: "c1", src: "https://example.com/c1-1.jpg" }]),
      updateCanPreloadPreviousChapter(true),
      fetchImgSrc(0, 6),
      updateChapterLatestIndex(0),
    ]);
  });

  it("clears an active chapter gate when the preload request yields no payload", async () => {
    const fetchChapterImages$ = jest.fn(() => of());
    const epic = createFetchImgListEpic(fetchChapterImages$);
    const state$ = {
      value: {
        comics: {
          chapterList: ["c2", "c1"],
          imageList: {
            result: [0, 1],
            entity: {
              0: { chapter: "c2" },
              1: { chapter: "c2" },
            },
          },
          pendingChapterGate: null,
        },
      },
    };

    const output = await lastValueFrom(
      epic(of(fetchImgList(1)), state$ as any).pipe(toArray()),
    );

    expect(output).toEqual([
      startPendingChapterGate({
        blockingChapterId: "c2",
        chapterId: "c1",
        chapterIndex: 1,
        readerGeneration: 0,
        status: "fetching",
      }),
      clearPendingChapterGate(),
    ]);
  });

  it.each([
    ["empty images", () => of({ chapterID: "c1", imgList: [] })],
    ["an error", () => throwError(() => new Error("preload failed"))],
  ])(
    "does not advance the preload frontier after %s",
    async (_label, response$) => {
      const epic = createFetchImgListEpic(response$ as any);
      const state$ = {
        value: {
          comics: {
            chapterList: ["c2", "c1"],
            imageList: {
              result: [0],
              entity: { 0: { chapter: "c2" } },
            },
            pendingChapterGate: null,
          },
        },
      };

    const output = await lastValueFrom(
      epic(of(fetchImgList(1)), state$ as any).pipe(toArray()),
    );

      expect(output).toEqual([
        startPendingChapterGate({
          blockingChapterId: "c2",
          chapterId: "c1",
          chapterIndex: 1,
          readerGeneration: 0,
          status: "fetching",
        }),
        clearPendingChapterGate(),
      ]);
      expect(output).not.toContainEqual(updateChapterLatestIndex(1));
    },
  );

  it("ignores preload responses from an older reader generation", () => {
    const chapterStreams = {
      c2: new Subject<any>(),
      c1: new Subject<any>(),
    };
    const fetchChapterImages$ = jest.fn(
      (chapterID: string) =>
        chapterStreams[chapterID as keyof typeof chapterStreams],
    );
    const epic = createFetchImgListEpic(fetchChapterImages$);
    const action$ = new Subject<any>();
    const state$ = {
      value: {
        comics: {
          readerGeneration: 1,
          chapterList: ["c2", "c1"],
          imageList: {
            result: [],
            entity: {},
          },
          pendingChapterGate: null,
        },
      },
    };
    const output: any[] = [];
    const subscription = epic(action$, state$ as any).subscribe((action) => {
      output.push(action);
    });

    action$.next(fetchImgList(0));
    state$.value.comics.readerGeneration = 2;
    action$.next(fetchImgList(1));
    chapterStreams.c2.next({
      chapterID: "c2",
      seriesID: "demo-series",
      comicUrl: "https://example.com/demo",
      imgList: [{ chapter: "c2", src: "https://example.com/c2-1.jpg" }],
    });
    chapterStreams.c2.complete();
    chapterStreams.c1.next({
      chapterID: "c1",
      seriesID: "demo-series",
      comicUrl: "https://example.com/demo",
      imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
    });
    chapterStreams.c1.complete();
    action$.complete();

    expect(output).toEqual([
      concatImageList([{ chapter: "c1", src: "https://example.com/c1-1.jpg" }]),
      updateCanPreloadPreviousChapter(true),
      fetchImgSrc(0, 6),
      updateChapterLatestIndex(1),
    ]);
    subscription.unsubscribe();
  });

  it("resolves the preload frontier against the latest chapter list", async () => {
    const chapterImages$ = new Subject<any>();
    const fetchChapterImages$ = jest.fn(() => chapterImages$);
    const epic = createFetchImgListEpic(fetchChapterImages$);
    const state$ = {
      value: {
        comics: {
          chapterList: ["c2", "c1"],
          imageList: {
            result: [0],
            entity: { 0: { chapter: "c2" } },
          },
          pendingChapterGate: null,
        },
      },
    };
    const outputPromise = lastValueFrom(
      epic(of(fetchImgList(1)), state$ as any).pipe(toArray()),
    );

    state$.value.comics.chapterList = ["c3", "c2", "c1"];
    chapterImages$.next({
      chapterID: "c1",
      seriesID: "demo-series",
      comicUrl: "https://example.com/demo",
      imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
    });
    chapterImages$.complete();

    await expect(outputPromise).resolves.toEqual([
      startPendingChapterGate({
        blockingChapterId: "c2",
        chapterId: "c1",
        chapterIndex: 1,
        readerGeneration: 0,
        status: "fetching",
      }),
      receivePendingChapterGate({
        blockingChapterId: "c2",
        chapterId: "c1",
        chapterIndex: 2,
        readerGeneration: 0,
        status: "queued",
        canPreloadPreviousChapter: true,
        imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
      }),
      updateChapterLatestIndex(2),
    ]);
  });
});
