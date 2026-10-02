import {
  fetchChapter,
  imageLoadFailed,
  retryImage,
  updateRead,
  updateVisibleImageRange,
} from "@domain/actions/reader";

import comics, {
  adjustReaderImageScale,
  appendPendingChapterGate,
  clearLeadingEvictionRestore,
  concatImageList,
  evictLeadingImageChapters,
  MAX_IMAGE_AUTO_RETRY_COUNT,
  receivePendingChapterGate,
  resetImg,
  resetReaderImageScale,
  setChapterLoadFailed,
  setReaderZoomTarget,
  syncReaderSeriesState,
  updateCanPreloadPreviousChapter,
  updateChapterList,
  updateChapterNowIndex,
  updateChapters,
  updateComicsID,
  updateImgType,
  updateInnerHeight,
  updateInnerWidth,
  updateSiteInfo,
} from "./comics";

describe("comics reducer", () => {
  it("updates innerHeight", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const nextState = comics(prevState, updateInnerHeight(720) as any);

    expect(nextState.innerHeight).toBe(720);
  });

  it("updates innerWidth", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const nextState = comics(prevState, updateInnerWidth(1280) as any);

    expect(nextState.innerWidth).toBe(1280);
  });

  it("resets imageList on resetImg", () => {
    const seededState = {
      ...(comics(undefined, { type: "@@INIT" } as any) as any),
      readerGlobalScale: 0.7,
      readerZoomTarget: "selected",
      selectedImageId: 0,
      imageScaleOverrides: {
        0: 0.6,
      },
      nextImageId: 2,
      readerGeneration: 3,
      imageList: {
        result: [0, 1],
        entity: {
          0: { src: "a", loading: false },
          1: { src: "b", loading: false },
        },
      },
    };

    const nextState = comics(seededState as any, resetImg() as any);

    expect(nextState.imageList).toEqual({ result: [], entity: {} });
    expect(nextState.readyChapters).toEqual({});
    expect(nextState.pendingChapterGate).toBeNull();
    expect(nextState.leadingEvictionRestore).toBeNull();
    expect(nextState.readerGlobalScale).toBe(1);
    expect(nextState.readerZoomTarget).toBe("all");
    expect(nextState.selectedImageId).toBeNull();
    expect(nextState.imageScaleOverrides).toEqual({});
    expect(nextState.nextImageId).toBe(2);
    expect(nextState.readerGeneration).toBe(4);

    const staleImageEventState = comics(
      nextState,
      updateImgType(1200, 0, "natural", 900, 1600) as any,
    );
    expect(staleImageEventState.imageList).toEqual({ result: [], entity: {} });
  });

  it("builds a canonical seriesKey when site and comicsID are set", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const withSite = comics(
      prevState,
      updateSiteInfo("dm5", "https://www.dm5.com") as any,
    );
    const nextState = comics(withSite, updateComicsID("123") as any);

    expect(nextState.seriesKey).toBe("dm5:m123");
  });

  it("keeps DM5 series slugs unchanged when building seriesKey", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const withSite = comics(
      prevState,
      updateSiteInfo("dm5", "https://www.dm5.com") as any,
    );
    const nextState = comics(
      withSite,
      updateComicsID("manhua-bailianchengshen") as any,
    );

    expect(nextState.seriesKey).toBe("dm5:manhua-bailianchengshen");
  });

  it("updates canPreloadPreviousChapter explicitly", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const nextState = comics(
      prevState,
      updateCanPreloadPreviousChapter(false) as any,
    );

    expect(nextState.canPreloadPreviousChapter).toBe(false);
  });

  it("keeps paywall placeholder images non-loading", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const nextState = comics(
      prevState,
      concatImageList([
        {
          chapter: "m1655813",
          href: "https://www.dm5.com/m1655813/",
          src: "",
          type: "paywall",
        },
      ]) as any,
    );

    expect(nextState.imageList.entity[0]).toEqual(
      expect.objectContaining({
        autoRetryCount: 0,
        chapter: "m1655813",
        href: "https://www.dm5.com/m1655813/",
        loadError: null,
        loading: false,
        requestSrc: "",
        type: "paywall",
      }),
    );
  });

  it("tracks chapter load lifecycle for the current request", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const loadingState = comics(prevState, fetchChapter("m100") as any);
    const failedState = comics(loadingState, setChapterLoadFailed() as any);
    const readyState = comics(
      failedState,
      concatImageList([
        {
          chapter: "m100",
          src: "https://example.com/chapterfun.ashx?page=1",
        },
      ]) as any,
    );

    expect(loadingState).toEqual(
      expect.objectContaining({
        chapterLoadStatus: "loading",
        requestedChapter: "m100",
      }),
    );
    expect(failedState.chapterLoadStatus).toBe("failed");
    expect(readyState.chapterLoadStatus).toBe("ready");
  });

  it("tracks request sources for retryable images", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const nextState = comics(
      prevState,
      concatImageList([
        {
          chapter: "c1",
          src: "https://example.com/chapterfun.ashx?page=1",
        },
      ]) as any,
    );

    expect(nextState.imageList.entity[0]).toEqual(
      expect.objectContaining({
        autoRetryCount: 0,
        loadError: null,
        loading: true,
        requestSrc: "https://example.com/chapterfun.ashx?page=1",
        src: "https://example.com/chapterfun.ashx?page=1",
      }),
    );
  });

  it("adjusts global reader zoom and recalculates loaded image heights", () => {
    let nextState = comics(
      comics(
        comics(undefined, { type: "@@INIT" } as any) as any,
        updateInnerWidth(1280) as any,
      ) as any,
      updateInnerHeight(900) as any,
    ) as any;

    nextState = comics(
      nextState,
      concatImageList([
        {
          chapter: "c1",
          src: "https://example.com/c1-1.jpg",
        },
      ]) as any,
    ) as any;
    nextState = comics(
      nextState,
      updateImgType(2240, 0, "natural", 1000, 2000) as any,
    ) as any;
    nextState = comics(nextState, adjustReaderImageScale(-0.1) as any) as any;

    expect(nextState.readerGlobalScale).toBe(0.9);
    expect(nextState.imageList.entity[0].height).toBe(2016);
  });

  it("selects the first readable image in the visible range for page zoom", () => {
    let nextState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c1",
          href: "https://example.com/paywall",
          src: "",
          type: "paywall",
        },
        {
          chapter: "c1",
          src: "https://example.com/c1-1.jpg",
        },
      ]) as any,
    ) as any;

    nextState = comics(nextState, updateVisibleImageRange(0, 2) as any) as any;

    expect(nextState.selectedImageId).toBe(1);
  });

  it("overrides and resets the current visible reader image scale", () => {
    let nextState = comics(
      comics(
        comics(undefined, { type: "@@INIT" } as any) as any,
        updateInnerWidth(1280) as any,
      ) as any,
      updateInnerHeight(900) as any,
    ) as any;

    nextState = comics(
      nextState,
      concatImageList([
        {
          chapter: "c1",
          src: "https://example.com/c1-1.jpg",
        },
        {
          chapter: "c1",
          src: "https://example.com/c1-2.jpg",
        },
      ]) as any,
    ) as any;
    nextState = comics(
      nextState,
      updateImgType(2240, 0, "natural", 1000, 2000) as any,
    ) as any;
    nextState = comics(
      nextState,
      updateImgType(2240, 1, "natural", 1000, 2000) as any,
    ) as any;
    nextState = comics(nextState, updateVisibleImageRange(1, 1) as any) as any;
    nextState = comics(
      nextState,
      setReaderZoomTarget("selected") as any,
    ) as any;
    nextState = comics(nextState, adjustReaderImageScale(-0.1) as any) as any;

    expect(nextState.selectedImageId).toBe(1);
    expect(nextState.readerZoomTarget).toBe("selected");
    expect(nextState.imageScaleOverrides).toEqual({ 1: 0.9 });
    expect(nextState.imageList.entity[0].height).toBe(2240);
    expect(nextState.imageList.entity[1].height).toBe(2016);

    nextState = comics(
      nextState,
      resetReaderImageScale("selected") as any,
    ) as any;

    expect(nextState.imageScaleOverrides).toEqual({});
    expect(nextState.imageList.entity[1].height).toBe(2240);
  });

  it("does not enter selected zoom mode before an image is selected", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const nextState = comics(prevState, setReaderZoomTarget("selected") as any);

    expect(nextState.readerZoomTarget).toBe("all");
  });

  it("keeps images in loading while auto retries remain", () => {
    const prevState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c1",
          src: "https://example.com/chapterfun.ashx?page=1",
        },
      ]) as any,
    ) as any;

    const nextState = comics(prevState, imageLoadFailed(0, "resolve") as any);

    expect(nextState.imageList.entity[0]).toEqual(
      expect.objectContaining({
        autoRetryCount: 1,
        loadError: null,
        loading: true,
        src: "https://example.com/chapterfun.ashx?page=1",
      }),
    );
  });

  it("marks the image as failed after exhausting auto retries", () => {
    let nextState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c1",
          src: "https://example.com/chapterfun.ashx?page=1",
        },
      ]) as any,
    ) as any;

    for (let attempt = 0; attempt <= MAX_IMAGE_AUTO_RETRY_COUNT; attempt += 1) {
      nextState = comics(nextState, imageLoadFailed(0, "image") as any);
    }

    expect(nextState.imageList.entity[0]).toEqual(
      expect.objectContaining({
        autoRetryCount: MAX_IMAGE_AUTO_RETRY_COUNT,
        loadError: "image",
        loading: false,
      }),
    );
  });

  it("resets terminal image failures on manual retry", () => {
    let nextState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c1",
          src: "https://example.com/chapterfun.ashx?page=1",
        },
      ]) as any,
    ) as any;

    for (let attempt = 0; attempt <= MAX_IMAGE_AUTO_RETRY_COUNT; attempt += 1) {
      nextState = comics(nextState, imageLoadFailed(0, "image") as any);
    }
    nextState = comics(nextState, retryImage(0) as any);

    expect(nextState.imageList.entity[0]).toEqual(
      expect.objectContaining({
        autoRetryCount: 0,
        loadError: null,
        loading: true,
        src: "https://example.com/chapterfun.ashx?page=1",
      }),
    );
  });

  it("tracks currentChapterTitle from chapter metadata and navigation", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const withChapters = comics(
      prevState,
      updateChapters({
        c1: { title: "Chapter 1" },
        c2: { title: "Chapter 2" },
      }) as any,
    );
    const withChapterList = comics(
      withChapters,
      updateChapterList(["c2", "c1"]) as any,
    );

    expect(withChapterList.currentChapterTitle).toBe("Chapter 2");

    const nextState = comics(withChapterList, updateChapterNowIndex(1) as any);

    expect(nextState.currentChapterTitle).toBe("Chapter 1");
  });

  it("syncs refreshed chapters without moving the active reader chapter", () => {
    const imageList = {
      result: [10, 11],
      entity: {
        10: { chapter: "c3", type: "image" },
        11: { chapter: "c3", type: "end" },
      },
    };
    const prevState = {
      ...(comics(undefined, { type: "@@INIT" } as any) as any),
      title: "Old title",
      subscribe: false,
      chapterList: ["c3", "c2"],
      chapters: {
        c3: { title: "Chapter 3" },
        c2: { title: "Chapter 2" },
      },
      chapterNowIndex: 0,
      chapterLatestIndex: -1,
      currentChapterTitle: "Chapter 3",
      imageList,
      pendingChapterGate: {
        blockingChapterId: "c3",
        chapterId: "c2",
        chapterIndex: 1,
        readerGeneration: 0,
        status: "fetching",
      },
    };

    const nextState = comics(
      prevState,
      syncReaderSeriesState({
        title: "Series",
        chapterList: ["c4", "c3", "c2"],
        chapters: {
          c4: { title: "Chapter 4" },
          c3: { title: "Chapter 3" },
          c2: { title: "Chapter 2" },
        },
        read: ["c3"],
        subscribed: true,
      }) as any,
    );

    expect(nextState).toEqual(
      expect.objectContaining({
        title: "Series",
        subscribe: true,
        read: ["c3"],
        chapterList: ["c4", "c3", "c2"],
        chapterNowIndex: 1,
        chapterLatestIndex: 1,
        currentChapterTitle: "Chapter 3",
      }),
    );
    expect(nextState.imageList).toBe(imageList);
    expect(nextState.pendingChapterGate).toEqual(
      expect.objectContaining({ chapterId: "c2", chapterIndex: 2 }),
    );
  });

  it("retains an active loaded chapter omitted by a live snapshot", () => {
    const prevState = {
      ...(comics(undefined, { type: "@@INIT" } as any) as any),
      chapterList: ["c3", "c2"],
      chapters: {
        c3: { title: "Chapter 3" },
        c2: { title: "Chapter 2" },
      },
      chapterNowIndex: 0,
      currentChapterTitle: "Chapter 3",
      imageList: {
        result: [10],
        entity: { 10: { chapter: "c3", type: "image" } },
      },
    };

    const nextState = comics(
      prevState,
      syncReaderSeriesState({
        title: "Series",
        chapterList: ["c4", "c2"],
        chapters: {
          c4: { title: "Chapter 4" },
          c2: { title: "Chapter 2" },
        },
        read: [],
        subscribed: false,
      }) as any,
    );

    expect(nextState.chapterList).toEqual(["c4", "c3", "c2"]);
    expect(nextState.chapterNowIndex).toBe(1);
    expect(nextState.currentChapterTitle).toBe("Chapter 3");
  });

  it("updates the visible chapter synchronously with read progress", () => {
    let state = comics(undefined, { type: "@@INIT" } as any) as any;
    state = comics(state, updateChapterList(["c2", "c1"]) as any);
    state = comics(
      state,
      updateChapters({
        c2: { title: "Chapter 2" },
        c1: { title: "Chapter 1" },
      }) as any,
    );

    const nextState = comics(state, updateRead(1) as any);

    expect(nextState.chapterNowIndex).toBe(1);
    expect(nextState.currentChapterTitle).toBe("Chapter 1");
  });

  it("marks a chapter as ready after the tail readable image resolves", () => {
    let nextState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c1",
          src: "https://example.com/c1-1.jpg",
        },
        {
          chapter: "c1",
          src: "https://example.com/c1-2.jpg",
        },
      ]) as any,
    ) as any;

    nextState = comics(
      nextState,
      updateImgType(1200, 0, "natural", 900, 1600) as any,
    );
    expect(nextState.readyChapters).toEqual({});

    nextState = comics(
      nextState,
      updateImgType(1200, 1, "natural", 900, 1600) as any,
    );
    expect(nextState.readyChapters).toEqual({ c1: true });
  });

  it("allows skipped earlier images when the tail readable image is settled", () => {
    let nextState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c1",
          src: "https://example.com/c1-1.jpg",
        },
        {
          chapter: "c1",
          src: "https://example.com/c1-2.jpg",
        },
      ]) as any,
    ) as any;

    nextState = comics(
      nextState,
      updateImgType(1200, 1, "natural", 900, 1600) as any,
    );

    expect(nextState.readyChapters).toEqual({ c1: true });
  });

  it("treats terminal image failures as settled for chapter readiness", () => {
    let nextState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c1",
          src: "https://example.com/c1-1.jpg",
        },
        {
          chapter: "c1",
          src: "https://example.com/c1-2.jpg",
        },
      ]) as any,
    ) as any;

    nextState = comics(
      nextState,
      updateImgType(1200, 0, "natural", 900, 1600) as any,
    );
    for (let attempt = 0; attempt <= MAX_IMAGE_AUTO_RETRY_COUNT; attempt += 1) {
      nextState = comics(nextState, imageLoadFailed(1, "image") as any);
    }

    expect(nextState.readyChapters).toEqual({ c1: true });

    nextState = comics(nextState, retryImage(1) as any);
    expect(nextState.readyChapters).toEqual({});
  });

  it("keeps a queued chapter blocked until the tail readable image settles", () => {
    let nextState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c2",
          src: "https://example.com/c2-1.jpg",
        },
        {
          chapter: "c2",
          src: "https://example.com/c2-2.jpg",
        },
      ]) as any,
    ) as any;

    nextState = comics(
      nextState,
      receivePendingChapterGate({
        blockingChapterId: "c2",
        chapterId: "c1",
        chapterIndex: 0,
        readerGeneration: 0,
        status: "queued",
        canPreloadPreviousChapter: true,
        imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
      }) as any,
    );
    nextState = comics(
      nextState,
      updateImgType(1200, 0, "natural", 900, 1600) as any,
    );
    nextState = comics(nextState, appendPendingChapterGate() as any);

    expect(nextState.pendingChapterGate).toEqual(
      expect.objectContaining({
        blockingChapterId: "c2",
        chapterId: "c1",
      }),
    );
    expect(nextState.imageList.result).toEqual([0, 1, 2]);

    nextState = comics(
      nextState,
      updateImgType(1200, 1, "natural", 900, 1600) as any,
    );
    nextState = comics(nextState, appendPendingChapterGate() as any);

    expect(nextState.pendingChapterGate).toBeNull();
    expect(nextState.imageList.result).toEqual([0, 1, 2, 3, 4]);
  });

  it("appends a queued chapter when only the blocking chapter tail image settled", () => {
    let nextState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c2",
          src: "https://example.com/c2-1.jpg",
        },
        {
          chapter: "c2",
          src: "https://example.com/c2-2.jpg",
        },
      ]) as any,
    ) as any;

    nextState = comics(
      nextState,
      receivePendingChapterGate({
        blockingChapterId: "c2",
        chapterId: "c1",
        chapterIndex: 0,
        readerGeneration: 0,
        status: "queued",
        canPreloadPreviousChapter: true,
        imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
      }) as any,
    );
    nextState = comics(
      nextState,
      updateImgType(1200, 1, "natural", 900, 1600) as any,
    );
    nextState = comics(nextState, appendPendingChapterGate() as any);

    expect(nextState.pendingChapterGate).toBeNull();
    expect(nextState.imageList.result).toEqual([0, 1, 2, 3, 4]);
  });

  it("queues the next chapter until the blocking chapter is ready", () => {
    const prevState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c2",
          src: "https://example.com/c2-1.jpg",
        },
      ]) as any,
    ) as any;

    const nextState = comics(
      prevState,
      receivePendingChapterGate({
        blockingChapterId: "c2",
        chapterId: "c1",
        chapterIndex: 0,
        readerGeneration: 0,
        status: "queued",
        canPreloadPreviousChapter: true,
        imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
      }) as any,
    );

    expect(nextState.pendingChapterGate).toEqual(
      expect.objectContaining({
        blockingChapterId: "c2",
        chapterId: "c1",
        status: "queued",
      }),
    );
    expect(nextState.imageList.result).toEqual([0, 1]);
  });

  it("appends the queued chapter once the blocking chapter is ready", () => {
    let nextState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c2",
          src: "https://example.com/c2-1.jpg",
        },
      ]) as any,
    ) as any;

    nextState = comics(
      nextState,
      receivePendingChapterGate({
        blockingChapterId: "c2",
        chapterId: "c1",
        chapterIndex: 0,
        readerGeneration: 0,
        status: "queued",
        canPreloadPreviousChapter: false,
        imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
      }) as any,
    );
    nextState = comics(
      nextState,
      updateImgType(1200, 0, "natural", 900, 1600) as any,
    );
    nextState = comics(nextState, appendPendingChapterGate() as any);

    expect(nextState.pendingChapterGate).toBeNull();
    expect(nextState.canPreloadPreviousChapter).toBe(false);
    expect(nextState.imageList.result).toEqual([0, 1, 2, 3]);
    expect(nextState.imageList.entity[2]).toEqual(
      expect.objectContaining({ chapter: "c1" }),
    );
  });

  it("appends the next chapter immediately when the blocking chapter is already ready", () => {
    let nextState = comics(
      comics(undefined, { type: "@@INIT" } as any) as any,
      concatImageList([
        {
          chapter: "c2",
          src: "https://example.com/c2-1.jpg",
        },
      ]) as any,
    ) as any;

    nextState = comics(
      nextState,
      updateImgType(1200, 0, "natural", 900, 1600) as any,
    );
    nextState = comics(
      nextState,
      receivePendingChapterGate({
        blockingChapterId: "c2",
        chapterId: "c1",
        chapterIndex: 0,
        readerGeneration: 0,
        status: "queued",
        canPreloadPreviousChapter: true,
        imgList: [{ chapter: "c1", src: "https://example.com/c1-1.jpg" }],
      }) as any,
    );

    expect(nextState.pendingChapterGate).toBeNull();
    expect(nextState.imageList.result).toEqual([0, 1, 2, 3]);
    expect(nextState.imageList.entity[2]).toEqual(
      expect.objectContaining({ chapter: "c1" }),
    );
  });

  it("evicts only one leading chapter boundary per action", () => {
    const prevState = {
      ...(comics(undefined, { type: "@@INIT" } as any) as any),
      chapterList: ["c0", "c1", "c2", "c3", "c4", "c5"],
      readerZoomTarget: "selected",
      selectedImageId: 10,
      imageScaleOverrides: {
        10: 0.8,
        12: 0.9,
      },
      readyChapters: {
        c5: true,
        c4: true,
      },
      imageList: {
        result: [10, 11, 12, 13, 14, 15, 16, 17],
        entity: {
          10: { chapter: "c5", height: 100, loading: false, type: "image" },
          11: { chapter: "c5", height: 100, loading: false, type: "end" },
          12: { chapter: "c4", height: 100, loading: false, type: "image" },
          13: { chapter: "c4", height: 100, loading: false, type: "end" },
          14: { chapter: "c3", height: 100, loading: false, type: "image" },
          15: { chapter: "c3", height: 100, loading: false, type: "end" },
          16: { chapter: "c2", height: 100, loading: false, type: "image" },
          17: { chapter: "c2", height: 100, loading: false, type: "end" },
        },
      },
    };

    const nextState = comics(
      prevState as any,
      evictLeadingImageChapters(3) as any,
    );

    expect(nextState.imageList.result).toEqual([12, 13, 14, 15, 16, 17]);
    expect(nextState.imageList.entity[10]).toBeUndefined();
    expect(nextState.imageList.entity[11]).toBeUndefined();
    expect(nextState.imageList.entity[12]).toEqual(
      expect.objectContaining({ chapter: "c4" }),
    );
    expect(nextState.leadingEvictionRestore).toEqual({
      sequence: 1,
      firstRetainedImageId: 12,
      removedScrollHeight: 180,
    });
    expect(nextState.readerZoomTarget).toBe("all");
    expect(nextState.selectedImageId).toBeNull();
    expect(nextState.imageScaleOverrides).toEqual({ 12: 0.9 });
    expect(nextState.readyChapters).toEqual({ c4: true });
  });

  it("keeps retained image ids unique when appending after a leading eviction", () => {
    let state = comics(undefined, { type: "@@INIT" } as any) as any;
    state = comics(
      state,
      updateChapterList(["c1", "c2", "c3", "c4", "c5"]) as any,
    );

    for (const chapter of ["c5", "c4", "c3", "c2"]) {
      state = comics(
        state,
        concatImageList([
          { chapter, src: `https://example.com/${chapter}.jpg` },
        ]) as any,
      );
    }

    state = comics(state, evictLeadingImageChapters(3) as any);
    const retainedEntries = state.imageList.result.map((imageId: number) => [
      imageId,
      state.imageList.entity[imageId],
    ]);
    state = comics(
      state,
      concatImageList([
        { chapter: "c1", src: "https://example.com/c1.jpg" },
      ]) as any,
    );

    expect(new Set(state.imageList.result).size).toBe(
      state.imageList.result.length,
    );
    for (const [imageId, record] of retainedEntries) {
      expect(state.imageList.entity[imageId]).toBe(record);
    }
    expect(
      state.imageList.result.map(
        (imageId: number) => state.imageList.entity[imageId]?.chapter,
      ),
    ).toEqual(["c4", "c4", "c3", "c3", "c2", "c2", "c1", "c1"]);
  });

  it("clears only the matching leading eviction restore sequence", () => {
    const prevState = {
      ...(comics(undefined, { type: "@@INIT" } as any) as any),
      leadingEvictionRestore: {
        sequence: 3,
        firstRetainedImageId: 12,
        removedScrollHeight: 264,
      },
      leadingEvictionRestoreSequence: 3,
    };

    const mismatchedState = comics(
      prevState as any,
      clearLeadingEvictionRestore(2) as any,
    );
    const clearedState = comics(
      mismatchedState as any,
      clearLeadingEvictionRestore(3) as any,
    );

    expect(mismatchedState.leadingEvictionRestore).toEqual(
      prevState.leadingEvictionRestore,
    );
    expect(clearedState.leadingEvictionRestoreSequence).toBe(3);
    expect(clearedState.leadingEvictionRestore).toBeNull();
  });
});
