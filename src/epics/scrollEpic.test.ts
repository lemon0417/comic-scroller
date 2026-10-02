import { of, Subject } from "rxjs";

function setup() {
  jest.resetModules();
  Object.defineProperty(document, "URL", {
    value: "http://example.com/?site=dm5&chapter=1",
    configurable: true,
  });
  Object.defineProperty(window, "location", {
    value: { search: "?site=dm5&chapter=1" },
    writable: true,
  });

  const {
    default: scrollEpic,
    READER_CHAPTER_STABILIZE_MS,
  } = require("./scrollEpic");
  const {
    fetchImgList,
    fetchImgSrc,
    updateRead,
    updateVisibleImageRange,
  } = require("@domain/actions/reader");
  const {
    evictLeadingImageChapters,
    updateChapterLatestIndex,
  } = require("@domain/reducers/comics");

  return {
    READER_CHAPTER_STABILIZE_MS,
    evictLeadingImageChapters,
    updateChapterLatestIndex,
    scrollEpic,
    fetchImgSrc,
    fetchImgList,
    updateRead,
    updateVisibleImageRange,
  };
}

describe("scrollEpic", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps image fetching immediate while delaying chapter updates until the range settles", () => {
    const {
      READER_CHAPTER_STABILIZE_MS,
      scrollEpic,
      fetchImgSrc,
      updateRead,
      updateVisibleImageRange,
    } = setup();

    const state$ = {
      value: {
        comics: {
          imageList: {
            result: [0],
            entity: {
              0: {
                chapter: "c2",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
            },
          },
          chapterList: ["c2", "c1"],
          chapterLatestIndex: 1,
          chapterNowIndex: 1,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(window, "pageYOffset", {
      value: 0,
      configurable: true,
    });

    const action$ = of(updateVisibleImageRange(0, 0));
    const output$ = scrollEpic(action$, state$ as any);

    const actions: any[] = [];
    const subscription = output$.subscribe((action: any) =>
      actions.push(action),
    );

    expect(actions).toContainEqual(fetchImgSrc(-6, 6));
    expect(actions).not.toContainEqual(updateRead(0));

    jest.advanceTimersByTime(READER_CHAPTER_STABILIZE_MS);

    expect(actions).toContainEqual(updateRead(0));

    subscription.unsubscribe();
  });

  it("does not auto-preload previous chapter when the preload flag is disabled", () => {
    const {
      READER_CHAPTER_STABILIZE_MS,
      fetchImgList,
      scrollEpic,
      updateVisibleImageRange,
    } = setup();

    const state$ = {
      value: {
        comics: {
          canPreloadPreviousChapter: false,
          imageList: {
            result: [0],
            entity: {
              0: { height: 100, type: "paywall", chapter: "c2" },
            },
          },
          chapterList: ["c1", "c2"],
          chapterLatestIndex: 1,
          chapterNowIndex: 1,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    const actions: any[] = [];
    const subscription = scrollEpic(
      of(updateVisibleImageRange(0, 0)),
      state$ as any,
    ).subscribe((action: any) => actions.push(action));

    jest.advanceTimersByTime(READER_CHAPTER_STABILIZE_MS);

    expect(actions).not.toContainEqual(fetchImgList(0));

    subscription.unsubscribe();
  });

  it("preloads the next chapter only after the visible range settles", () => {
    const {
      READER_CHAPTER_STABILIZE_MS,
      fetchImgList,
      scrollEpic,
      updateVisibleImageRange,
    } = setup();

    const state$ = {
      value: {
        comics: {
          canPreloadPreviousChapter: true,
          pendingChapterGate: null,
          imageList: {
            result: [0],
            entity: {
              0: {
                chapter: "c2",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
            },
          },
          chapterList: ["c1", "c2"],
          chapterLatestIndex: 1,
          chapterNowIndex: 1,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    const actions: any[] = [];
    const subscription = scrollEpic(
      of(updateVisibleImageRange(0, 0)),
      state$ as any,
    ).subscribe((action: any) => actions.push(action));

    expect(actions).not.toContainEqual(fetchImgList(0));

    jest.advanceTimersByTime(READER_CHAPTER_STABILIZE_MS);

    expect(actions).toContainEqual(fetchImgList(0));
    expect(actions).not.toContainEqual({
      type: "UPDATE_CHAPTER_LATEST_INDEX",
      data: 0,
    });

    subscription.unsubscribe();
  });

  it("does not preload from a transient tail chapter before it reaches the top anchor", () => {
    const {
      READER_CHAPTER_STABILIZE_MS,
      fetchImgList,
      scrollEpic,
      updateVisibleImageRange,
    } = setup();

    const state$ = {
      value: {
        comics: {
          canPreloadPreviousChapter: true,
          pendingChapterGate: null,
          imageList: {
            result: [0, 1],
            entity: {
              0: {
                chapter: "c1",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              1: {
                chapter: "c2",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
            },
          },
          chapterList: ["c3", "c2", "c1"],
          chapterLatestIndex: 1,
          chapterNowIndex: 2,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    const actions: any[] = [];
    const subscription = scrollEpic(
      of(updateVisibleImageRange(0, 1)),
      state$ as any,
    ).subscribe((action: any) => actions.push(action));

    jest.advanceTimersByTime(READER_CHAPTER_STABILIZE_MS);

    expect(actions).not.toContainEqual(fetchImgList(0));

    subscription.unsubscribe();
  });

  it("does not request deeper chapters while a pending chapter gate is active", () => {
    const {
      READER_CHAPTER_STABILIZE_MS,
      fetchImgList,
      scrollEpic,
      updateVisibleImageRange,
    } = setup();

    const state$ = {
      value: {
        comics: {
          canPreloadPreviousChapter: true,
          pendingChapterGate: {
            blockingChapterId: "c2",
            chapterId: "c1",
            chapterIndex: 0,
            status: "fetching",
          },
          imageList: {
            result: [0],
            entity: {
              0: {
                chapter: "c2",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
            },
          },
          chapterList: ["c1", "c2"],
          chapterLatestIndex: 1,
          chapterNowIndex: 1,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    const actions: any[] = [];
    const subscription = scrollEpic(
      of(updateVisibleImageRange(0, 0)),
      state$ as any,
    ).subscribe((action: any) => actions.push(action));

    jest.advanceTimersByTime(READER_CHAPTER_STABILIZE_MS);

    expect(actions).not.toContainEqual(fetchImgList(0));

    subscription.unsubscribe();
  });

  it("resolves chapters from image ids after leading chapters were evicted", () => {
    const {
      READER_CHAPTER_STABILIZE_MS,
      scrollEpic,
      updateRead,
      updateVisibleImageRange,
    } = setup();

    const state$ = {
      value: {
        comics: {
          canPreloadPreviousChapter: true,
          imageList: {
            result: [10, 11, 20, 21],
            entity: {
              10: {
                chapter: "c4",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              11: { height: 72, type: "end", chapter: "c4" },
              20: {
                chapter: "c2",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              21: { height: 72, type: "end", chapter: "c2" },
            },
          },
          chapterList: ["c1", "c2", "c3", "c4"],
          chapterLatestIndex: 1,
          chapterNowIndex: 3,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    const actions: any[] = [];
    const subscription = scrollEpic(
      of(updateVisibleImageRange(2, 2)),
      state$ as any,
    ).subscribe((action: any) => actions.push(action));

    jest.advanceTimersByTime(READER_CHAPTER_STABILIZE_MS);

    expect(actions).toContainEqual(updateRead(1));

    subscription.unsubscribe();
  });

  it("evicts leading chapters once the reader is far enough past them", () => {
    const {
      READER_CHAPTER_STABILIZE_MS,
      evictLeadingImageChapters,
      scrollEpic,
      updateVisibleImageRange,
    } = setup();

    const state$ = {
      value: {
        comics: {
          canPreloadPreviousChapter: true,
          imageList: {
            result: [0, 1, 2, 3, 4, 5],
            entity: {
              0: {
                chapter: "c4",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              1: { height: 72, type: "end", chapter: "c4" },
              2: {
                chapter: "c3",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              3: { height: 72, type: "end", chapter: "c3" },
              4: {
                chapter: "c1",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              5: { height: 72, type: "end", chapter: "c1" },
            },
          },
          chapterList: ["c0", "c1", "c2", "c3", "c4"],
          chapterLatestIndex: 1,
          chapterNowIndex: 1,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    const actions: any[] = [];
    const subscription = scrollEpic(
      of(updateVisibleImageRange(4, 4)),
      state$ as any,
    ).subscribe((action: any) => actions.push(action));

    jest.advanceTimersByTime(READER_CHAPTER_STABILIZE_MS);

    expect(actions).toContainEqual(evictLeadingImageChapters(3));

    subscription.unsubscribe();
  });

  it("keeps the head chapter until it is above the top visible chapter buffer", () => {
    const {
      READER_CHAPTER_STABILIZE_MS,
      evictLeadingImageChapters,
      scrollEpic,
      updateVisibleImageRange,
    } = setup();

    const state$ = {
      value: {
        comics: {
          canPreloadPreviousChapter: true,
          imageList: {
            result: [0, 1, 2, 3, 4, 5, 6],
            entity: {
              0: {
                chapter: "c4",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              1: { height: 72, type: "end", chapter: "c4" },
              2: {
                chapter: "c3",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              3: { height: 72, type: "end", chapter: "c3" },
              4: {
                chapter: "c2",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              5: { height: 72, type: "end", chapter: "c2" },
              6: {
                chapter: "c1",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
            },
          },
          chapterList: ["c1", "c2", "c3", "c4"],
          chapterLatestIndex: 1,
          chapterNowIndex: 2,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    const actions: any[] = [];
    const subscription = scrollEpic(
      of(updateVisibleImageRange(4, 6)),
      state$ as any,
    ).subscribe((action: any) => actions.push(action));

    jest.advanceTimersByTime(READER_CHAPTER_STABILIZE_MS);

    expect(actions).not.toContainEqual(evictLeadingImageChapters(2));

    subscription.unsubscribe();
  });

  it("ignores transient chapter spikes caused by repeated layout recalculation", () => {
    const {
      READER_CHAPTER_STABILIZE_MS,
      scrollEpic,
      updateRead,
      updateVisibleImageRange,
    } = setup();

    const state$ = {
      value: {
        comics: {
          canPreloadPreviousChapter: true,
          imageList: {
            result: [70, 60, 50, 40, 30],
            entity: {
              70: {
                chapter: "c7",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              60: {
                chapter: "c6",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              50: {
                chapter: "c5",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              40: {
                chapter: "c4",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
              30: {
                chapter: "c3",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
            },
          },
          chapterList: ["c7", "c6", "c5", "c4", "c3"],
          chapterLatestIndex: 4,
          chapterNowIndex: 4,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    const actions: any[] = [];
    const subscription = scrollEpic(
      of(
        updateVisibleImageRange(3, 3),
        updateVisibleImageRange(2, 2),
        updateVisibleImageRange(1, 1),
        updateVisibleImageRange(0, 0),
        updateVisibleImageRange(3, 3),
      ),
      state$ as any,
    ).subscribe((action: any) => actions.push(action));

    jest.advanceTimersByTime(READER_CHAPTER_STABILIZE_MS);

    expect(actions).toContainEqual(updateRead(3));
    expect(actions).not.toContainEqual(updateRead(0));
    expect(actions).not.toContainEqual(updateRead(1));
    expect(actions).not.toContainEqual(updateRead(2));

    subscription.unsubscribe();
  });

  it("does not promote an unresolved placeholder chapter to the current chapter", () => {
    const {
      READER_CHAPTER_STABILIZE_MS,
      scrollEpic,
      updateRead,
      updateVisibleImageRange,
    } = setup();

    const state$ = {
      value: {
        comics: {
          canPreloadPreviousChapter: true,
          imageList: {
            result: [40, 30],
            entity: {
              40: {
                chapter: "c4",
                height: 1400,
                naturalHeight: 0,
                naturalWidth: 0,
                type: "image",
              },
              30: {
                chapter: "c3",
                height: 1200,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
            },
          },
          chapterList: ["c4", "c3"],
          chapterLatestIndex: 1,
          chapterNowIndex: 1,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    const actions: any[] = [];
    const subscription = scrollEpic(
      of(updateVisibleImageRange(0, 0)),
      state$ as any,
    ).subscribe((action: any) => actions.push(action));

    jest.advanceTimersByTime(READER_CHAPTER_STABILIZE_MS);

    expect(actions).not.toContainEqual(updateRead(0));

    subscription.unsubscribe();
  });

  it("drops a pending stabilized range after the reader generation changes", () => {
    const {
      READER_CHAPTER_STABILIZE_MS,
      scrollEpic,
      updateRead,
      updateVisibleImageRange,
    } = setup();
    const action$ = new Subject<any>();
    const state$ = {
      value: {
        comics: {
          readerGeneration: 1,
          canPreloadPreviousChapter: false,
          pendingChapterGate: null,
          imageList: {
            result: [0],
            entity: {
              0: {
                chapter: "c1",
                height: 1000,
                naturalHeight: 1600,
                naturalWidth: 900,
                type: "natural",
              },
            },
          },
          chapterList: ["c1", "c0"],
          chapterLatestIndex: 0,
          chapterNowIndex: 1,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };
    const actions: any[] = [];
    const subscription = scrollEpic(action$, state$ as any).subscribe(
      (action: any) => actions.push(action),
    );

    action$.next(updateVisibleImageRange(0, 0));
    state$.value.comics.readerGeneration = 2;
    jest.advanceTimersByTime(READER_CHAPTER_STABILIZE_MS);

    expect(actions).not.toContainEqual(updateRead(0));
    subscription.unsubscribe();
  });
});
