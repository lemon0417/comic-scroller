import { fetchChapter, fetchImgList } from "@domain/actions/reader";
import {
  clearPendingChapterGate,
  setChapterLoadFailed,
  updateChapterLatestIndex,
  updateSiteInfo,
} from "@domain/reducers/comics";
import { applyReaderSeriesState } from "@infra/services/library/reader";
import {
  MYCOMIC_REQUEST_OPTIONS,
  MYCOMIC_REQUEST_TIMEOUT_MS,
} from "@sites/mycomic/url";
import { firstValueFrom, lastValueFrom, of, Subject } from "rxjs";
import { toArray } from "rxjs/operators";

import { readSiteFixture } from "../../testUtils/siteFixtures";
import {
  fetchChapterEpic,
  fetchChapterImages$,
  fetchImgListEpic,
} from "./mycomic";
import { getSiteReaderEpics } from "./registry";

jest.mock("@infra/services/library/reader", () => ({
  applyReaderSeriesState: jest.fn(),
  applyReadProgress: jest.fn(),
}));
const chapterID = "chapters/790421";
function mockFixtureFetch() {
  const fetchMock = jest.fn((url: string | URL | Request) => {
    const [, kind, id] = new URL(String(url)).pathname.split("/");
    return Promise.resolve({
      ok: true,
      text: async () =>
        readSiteFixture(
          "mycomic",
          `${kind === "comics" ? "series" : "chapter"}-${id}.html`,
        ),
    } as Response);
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

describe("MyComic reader", () => {
  const originalFetch = globalThis.fetch;
  const originalChrome = globalThis.chrome;
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).chrome = {
      ...originalChrome,
      action: { setBadgeText: jest.fn() },
    };
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.chrome = originalChrome;
    jest.useRealTimers();
  });

  it.each([
    ["790421", "1759", 17],
    ["15296", "1759", 183],
    ["818127", "31379", 8],
    ["423621", "31379", 12],
  ] as const)(
    "fetches all images from %s using the tested HTML request options",
    async (id, seriesID, count) => {
      const fetchMock = mockFixtureFetch();
      const payload = await firstValueFrom(
        fetchChapterImages$(`chapters/${id}`),
      );
      expect(payload).toMatchObject({
        chapterID: `chapters/${id}`,
        seriesID,
        comicUrl: `https://mycomic.com/comics/${seriesID}`,
      });
      expect(payload.imgList).toHaveLength(count);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `https://mycomic.com/chapters/${id}`,
        { ...MYCOMIC_REQUEST_OPTIONS, signal: expect.any(AbortSignal) },
      );
    },
  );

  it("hydrates the library and all group checkpoints through the shared flow", async () => {
    mockFixtureFetch();
    (applyReaderSeriesState as jest.Mock).mockResolvedValue({
      readChapterIDs: [chapterID],
      subscribed: true,
      updatesCount: 0,
    });
    const state$ = { value: { comics: { readerGeneration: 1 } } };
    const actions = await lastValueFrom(
      fetchChapterEpic(of(fetchChapter(chapterID)), state$ as any).pipe(
        toArray(),
      ),
    );
    expect(getSiteReaderEpics("mycomic")?.fetchChapterEpic).toBe(
      fetchChapterEpic,
    );
    expect(applyReaderSeriesState).toHaveBeenCalledWith(
      "mycomic",
      "1759",
      expect.objectContaining({
        url: "https://mycomic.com/comics/1759",
        title: "獵人",
        chapterList: expect.any(Array),
      }),
      chapterID,
      expect.objectContaining({
        chapterGroups: [
          expect.objectContaining({ id: "single" }),
          expect.objectContaining({ id: "volume" }),
          expect.objectContaining({ id: "extra" }),
        ],
      }),
    );
    expect(actions).not.toContainEqual(setChapterLoadFailed());
    expect(actions).toContainEqual(
      expect.objectContaining({
        type: "UPDATE_SITE_INFO",
        site: "mycomic",
        comicUrl: "https://mycomic.com/comics/1759",
      }),
    );
  });

  it("keeps loaded images usable when metadata fails", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => readSiteFixture("mycomic", "chapter-790421.html"),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    const actions = await lastValueFrom(
      fetchChapterEpic(of(fetchChapter(chapterID)), {
        value: { comics: { readerGeneration: 1 } },
      } as any).pipe(toArray()),
    );
    expect(actions).not.toContainEqual(setChapterLoadFailed());
    expect(actions).toContainEqual({
      type: "CONCAT_IMAGE_LIST",
      data: expect.arrayContaining([
        {
          chapter: chapterID,
          src: "https://biccam.com/chapters/790421/1-96801d.jpg",
        },
      ]),
    });
    expect(applyReaderSeriesState).not.toHaveBeenCalled();
  });

  it("enters the failure state for a challenge and allows an explicit retry", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    const actions = await lastValueFrom(
      fetchChapterEpic(of(fetchChapter(chapterID)), {} as any).pipe(toArray()),
    );
    expect(actions).toEqual([
      updateSiteInfo("mycomic", "https://mycomic.com"),
      setChapterLoadFailed(),
    ]);
    expect(applyReaderSeriesState).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    mockFixtureFetch();
    await expect(
      firstValueFrom(fetchChapterImages$(chapterID)),
    ).resolves.toMatchObject({ imgList: expect.any(Array) });
  });

  it("clears a failed preload gate without advancing the frontier", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    const state$ = {
      value: {
        comics: {
          readerGeneration: 1,
          chapterList: [chapterID],
          imageList: {
            result: [0],
            entity: { 0: { chapter: "chapters/788981" } },
          },
        },
      },
    };
    const actions = await lastValueFrom(
      fetchImgListEpic(of(fetchImgList(0)), state$ as any).pipe(toArray()),
    );
    expect(actions).toContainEqual(clearPendingChapterGate());
    expect(actions).not.toContainEqual(updateChapterLatestIndex(0));
  });

  it("aborts previous requests when changing chapters", () => {
    const signals: AbortSignal[] = [];
    globalThis.fetch = jest.fn((_url, options) => {
      signals.push(options?.signal as AbortSignal);
      return new Promise(() => undefined);
    });
    const action$ = new Subject<ReturnType<typeof fetchChapter>>();
    const subscription = fetchChapterEpic(action$, {} as any).subscribe();
    action$.next(fetchChapter(chapterID));
    action$.next(fetchChapter("chapters/818127"));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    subscription.unsubscribe();
    expect(signals[1].aborted).toBe(true);
  });

  it("times out stalled chapters instead of leaving the reader loading", async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn((_url, options) => {
      signal = options?.signal as AbortSignal;
      return new Promise(() => undefined);
    });
    const output = lastValueFrom(
      fetchChapterEpic(of(fetchChapter(chapterID)), {} as any).pipe(toArray()),
    );
    await jest.advanceTimersByTimeAsync(MYCOMIC_REQUEST_TIMEOUT_MS);
    await expect(output).resolves.toEqual([
      updateSiteInfo("mycomic", "https://mycomic.com"),
      setChapterLoadFailed(),
    ]);
    expect(signal?.aborted).toBe(true);
  });

  it.each([
    "790421",
    "chapters/0",
    "chapters/../790421",
    "chapters/790421?to=https://evil.test",
  ])("rejects invalid chapter IDs before HTTP: %s", async (id) => {
    globalThis.fetch = jest.fn();
    await expect(firstValueFrom(fetchChapterImages$(id))).rejects.toThrow();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
