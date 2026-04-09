import {
  fetchChapter,
  fetchImgList,
  fetchImgSrc,
} from "@domain/actions/reader";
import {
  concatImageList,
  updateCanPreloadPreviousChapter,
  updateChapterLatestIndex,
  updateChapterList,
  updateChapterNowIndex,
} from "@domain/reducers/comics";
import { applyReaderSeriesState } from "@infra/services/library/reader";
import { lastValueFrom, of, Subject } from "rxjs";
import { toArray } from "rxjs/operators";

import {
  createFetchChapterEpic,
  createFetchImgListEpic,
  normalizeReaderSiteMeta,
} from "./readerFlow";

jest.mock("@infra/services/library/reader", () => ({
  applyReaderSeriesState: jest.fn(async () => ({
    series: { read: [] },
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
    );
    expect(output).toEqual(
      expect.arrayContaining([
        updateChapterList(["c3", "c2", "c1"]),
        updateChapterNowIndex(1),
        fetchImgList(0),
        updateChapterLatestIndex(0),
      ]),
    );
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
      concatImageList([
        { chapter: "c1", src: "https://example.com/c1-1.jpg" },
      ]),
      updateCanPreloadPreviousChapter(true),
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
      concatImageList([
        { chapter: "c1", src: "https://example.com/c1-1.jpg" },
      ]),
      updateCanPreloadPreviousChapter(true),
      fetchImgSrc(0, 6),
    ]);
  });
});
