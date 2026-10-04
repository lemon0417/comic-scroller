import {
  fetchChapter,
  fetchImgSrc,
  imageLoadFailed,
} from "@domain/actions/reader";
import comicsReducer, {
  loadImgSrc,
  setChapterLoadFailed,
  updateCanPreloadPreviousChapter,
} from "@domain/reducers/comics";
import {
  applyReaderSeriesState,
  getSeriesCover,
} from "@infra/services/library/reader";
import { lastValueFrom, NEVER, of, Subject } from "rxjs";
import { ajax } from "rxjs/ajax";
import { tap, toArray } from "rxjs/operators";

import { readSiteFixture } from "../../testUtils/siteFixtures";
import {
  DM5_CHAPTER_REQUEST_TIMEOUT_MS,
  DM5_IMAGE_REQUEST_TIMEOUT_MS,
  fetchChapterEpic,
  fetchImgSrcEpic,
} from "./dm5";

jest.mock("rxjs/ajax", () => ({
  ajax: jest.fn(),
}));

jest.mock("@infra/services/library/reader", () => ({
  applyReaderSeriesState: jest.fn(),
  applyReadProgress: jest.fn(),
  getSeriesCover: jest.fn(),
}));

describe("dm5 fetchImgSrcEpic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dedupes in-flight chapterfun requests for the same image", async () => {
    const response$ = new Subject<{ response: string }>();
    const ajaxMock = ajax as unknown as jest.Mock;
    ajaxMock.mockReturnValue(response$);

    const state$ = {
      value: {
        comics: {
          imageList: {
            result: [0],
            entity: {
              0: {
                autoRetryCount: 0,
                requestSrc:
                  "https://www.dm5.com/manhua-demo/chapterfun.ashx?cid=1&page=1",
                src: "https://www.dm5.com/manhua-demo/chapterfun.ashx?cid=1&page=1",
                loading: true,
                loadError: null,
                type: "image",
                cid: "1",
                key: "deadbeef",
              },
            },
          },
        },
      },
    };

    const outputPromise = lastValueFrom(
      fetchImgSrcEpic(
        of(fetchImgSrc(0, 0), fetchImgSrc(0, 0)),
        state$ as any,
      ).pipe(toArray()),
    );

    expect(ajaxMock).toHaveBeenCalledTimes(1);

    response$.next({
      response:
        "var d=['/1_4253.jpg']; var base='https://example.com/85/84472/1753397';",
    });
    response$.complete();

    await expect(outputPromise).resolves.toEqual([
      loadImgSrc(
        "https://example.com/85/84472/1753397/1_4253.jpg?cid=1&key=deadbeef",
        0,
      ),
    ]);
  });

  it("surfaces a resolve failure so the retry flow can recover", async () => {
    const ajaxMock = ajax as unknown as jest.Mock;
    ajaxMock.mockReturnValueOnce(
      of({
        response: "",
      }),
    );

    const state$ = {
      value: {
        comics: {
          imageList: {
            result: [0],
            entity: {
              0: {
                autoRetryCount: 0,
                requestSrc:
                  "https://www.dm5.com/manhua-demo/chapterfun.ashx?cid=1&page=1",
                src: "https://www.dm5.com/manhua-demo/chapterfun.ashx?cid=1&page=1",
                loading: true,
                loadError: null,
                type: "image",
                cid: "1",
                key: "deadbeef",
              },
            },
          },
        },
      },
    };

    await expect(
      lastValueFrom(
        fetchImgSrcEpic(of(fetchImgSrc(0, 0)), state$ as any).pipe(toArray()),
      ),
    ).resolves.toEqual([imageLoadFailed(0, "resolve")]);
  });

  it("times out stalled chapterfun requests", async () => {
    jest.useFakeTimers();
    try {
      const ajaxMock = ajax as unknown as jest.Mock;
      ajaxMock.mockReturnValueOnce(NEVER);

      const state$ = {
        value: {
          comics: {
            imageList: {
              result: [0],
              entity: {
                0: {
                  autoRetryCount: 0,
                  requestSrc:
                    "https://www.dm5.com/manhua-demo/chapterfun.ashx?cid=1&page=1",
                  src: "https://www.dm5.com/manhua-demo/chapterfun.ashx?cid=1&page=1",
                  loading: true,
                  loadError: null,
                  type: "image",
                  cid: "1",
                  key: "deadbeef",
                },
              },
            },
          },
        },
      };

      const outputPromise = lastValueFrom(
        fetchImgSrcEpic(of(fetchImgSrc(0, 0)), state$ as any).pipe(toArray()),
      );

      await jest.advanceTimersByTimeAsync(DM5_IMAGE_REQUEST_TIMEOUT_MS);

      await expect(outputPromise).resolves.toEqual([
        imageLoadFailed(0, "resolve"),
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("surfaces a retryable chapter failure when the chapter page request times out", async () => {
    jest.useFakeTimers();
    try {
      const ajaxMock = ajax as unknown as jest.Mock;
      ajaxMock.mockReturnValueOnce(NEVER);

      const outputPromise = lastValueFrom(
        fetchChapterEpic(of(fetchChapter("m100")), {} as any).pipe(toArray()),
      );

      await jest.advanceTimersByTimeAsync(DM5_CHAPTER_REQUEST_TIMEOUT_MS);

      await expect(outputPromise).resolves.toEqual([setChapterLoadFailed()]);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("dm5 captured reader flows", () => {
  const originalFetch = globalThis.fetch;
  const originalChrome = globalThis.chrome;
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).chrome = {
      ...originalChrome,
      action: { setBadgeText: jest.fn() },
    };
    (getSeriesCover as jest.Mock).mockResolvedValue("");
    (applyReaderSeriesState as jest.Mock).mockResolvedValue({
      readChapterIDs: [],
      subscribed: true,
      updatesCount: 0,
    });
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.chrome = originalChrome;
  });

  async function hydrate(chapterID: string, slug: string) {
    const state$ = {
      value: { comics: comicsReducer(undefined, fetchChapter(chapterID)) },
    };
    globalThis.fetch = jest.fn((url) =>
      Promise.resolve({
        ok: true,
        text: async () =>
          readSiteFixture(
            "dm5",
            `${slug}.${String(url).includes("/rss-") ? "rss.xml" : "series.html"}`,
          ),
      } as Response),
    );
    const ajaxMock = ajax as unknown as jest.Mock;
    ajaxMock.mockReturnValueOnce(
      of({
        response: readSiteFixture("dm5", `${chapterID}.chapter.html`),
      }),
    );
    const actions = await lastValueFrom(
      fetchChapterEpic(of(fetchChapter(chapterID)), state$).pipe(
        tap((action) => {
          state$.value.comics = comicsReducer(state$.value.comics, action);
        }),
        toArray(),
      ),
    );
    expect(actions).not.toContainEqual(setChapterLoadFailed());
    expect(applyReaderSeriesState).toHaveBeenCalledWith(
      "dm5",
      `manhua-${slug}`,
      expect.objectContaining({ url: `https://www.dm5.com/manhua-${slug}/` }),
      chapterID,
      expect.any(Object),
    );
    return { actions, state$, ajaxMock };
  }

  it("hydrates the free reader and resolves a visible image using captured chapterfun", async () => {
    const { state$, ajaxMock } = await hydrate("m1768478", "dianjuren");
    const firstID = state$.value.comics.imageList.result[0];
    expect(state$.value.comics.title).toBe("电锯人");
    expect(state$.value.comics.chapterList).toEqual([
      "m1768478",
      "m1764103",
      "m1300155",
    ]);
    expect(state$.value.comics.imageList.entity[firstID]).toMatchObject({
      type: "image",
      cid: "1768478",
      key: "",
      loading: true,
    });
    ajaxMock.mockReturnValueOnce(
      of({ response: readSiteFixture("dm5", "m1768478.page-1.js") }),
    );
    const imageActions = await lastValueFrom(
      fetchImgSrcEpic(of(fetchImgSrc(0, 0)), state$).pipe(toArray()),
    );
    expect(imageActions).toEqual([
      loadImgSrc(
        "https://manhua1040zjcdn63.cdndm5.com/47/46568/1768478/1_2322.jpg?cid=1768478&key=228f25b9fb27a9418f4a919e2f010a37",
        firstID,
      ),
    ]);
    expect(ajaxMock).toHaveBeenCalledTimes(2);
  });

  it("hydrates the VIP card without preloading another chapter or requesting images", async () => {
    const { actions, state$, ajaxMock } = await hydrate(
      "m462489",
      "bailianchengshen",
    );
    expect(state$.value.comics.chapterNowIndex).toBe(1);
    expect(state$.value.comics.title).toBe("百炼成神");
    expect(actions).toContainEqual(updateCanPreloadPreviousChapter(false));
    expect(actions.some((action) => action.type === "FETCH_IMG_LIST")).toBe(
      false,
    );
    const firstID = state$.value.comics.imageList.result[0];
    expect(state$.value.comics.imageList.entity[firstID]).toMatchObject({
      type: "paywall",
      loading: false,
      src: "",
      href: "https://www.dm5.com/m462489/?cs_open_native=1",
    });
    await expect(
      lastValueFrom(
        fetchImgSrcEpic(of(fetchImgSrc(0, 6)), state$).pipe(toArray()),
      ),
    ).resolves.toEqual([]);
    expect(ajaxMock).toHaveBeenCalledTimes(1);
    expect(ajaxMock).toHaveBeenCalledWith({
      url: "https://www.dm5.com/m462489/",
      responseType: "text",
    });
  });
});
