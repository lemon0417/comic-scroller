import { fetchChapter, fetchImgList } from "@domain/actions/reader";
import {
  clearPendingChapterGate,
  setChapterLoadFailed,
  updateChapterLatestIndex,
  updateSiteInfo,
} from "@domain/reducers/comics";
import { applyReaderSeriesState } from "@infra/services/library/reader";
import { EIGHT_COMIC_REQUEST_TIMEOUT_MS } from "@sites/8comic/url";
import { lastValueFrom, of, Subject } from "rxjs";
import { toArray } from "rxjs/operators";

import { readSiteFixture } from "../../testUtils/siteFixtures";
import {
  fetchChapterEpic,
  fetchChapterImages$,
  fetchImgListEpic,
} from "./8comic";

jest.mock("@infra/services/library/reader", () => ({
  applyReaderSeriesState: jest.fn(),
  applyReadProgress: jest.fn(),
}));

const chapterID = "online/new-105.html?ch=420";

describe("8comic reader", () => {
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
    ["105", "420"],
    ["1551", "704"],
  ])(
    "hydrates %s reader, persistence and group baselines through the shared flow",
    async (seriesID, chapterNumber) => {
      const selectedChapterID = `online/new-${seriesID}.html?ch=${chapterNumber}`;
      const comicUrl = `https://www.8comic.com/html/${seriesID}.html`;
      globalThis.fetch = jest.fn((url) =>
        Promise.resolve({
          ok: true,
          text: async () =>
            readSiteFixture(
              "8comic",
              String(url).includes("/online/")
                ? `chapter-${seriesID}-${chapterNumber}.html`
                : `series-${seriesID}.html`,
            ),
        } as Response),
      );
      (applyReaderSeriesState as jest.Mock).mockResolvedValue({
        readChapterIDs: [selectedChapterID],
        subscribed: true,
        updatesCount: 0,
      });
      const state$ = { value: { comics: { readerGeneration: 1 } } };
      const actions = await lastValueFrom(
        fetchChapterEpic(
          of(fetchChapter(selectedChapterID)),
          state$ as any,
        ).pipe(toArray()),
      );
      expect(applyReaderSeriesState).toHaveBeenCalledWith(
        "8comic",
        seriesID,
        expect.objectContaining({
          chapterList: expect.any(Array),
          url: comicUrl,
        }),
        selectedChapterID,
        expect.objectContaining({
          chapterGroups: expect.arrayContaining([
            expect.objectContaining({ id: "single" }),
          ]),
        }),
      );
      expect(actions).not.toContainEqual(setChapterLoadFailed());
      expect(actions).toContainEqual(
        expect.objectContaining({
          type: "UPDATE_SITE_INFO",
          site: "8comic",
          comicUrl: comicUrl,
        }),
      );
    },
  );

  it("cancels a previous chapter fetch when navigation changes", () => {
    const signals: AbortSignal[] = [];
    globalThis.fetch = jest.fn((_url, options) => {
      signals.push(options?.signal as AbortSignal);
      return new Promise(() => undefined);
    });
    const action$ = new Subject<ReturnType<typeof fetchChapter>>();
    const subscription = fetchChapterEpic(action$, {} as any).subscribe();
    action$.next(fetchChapter(chapterID));
    action$.next(fetchChapter("online/new-105.html?ch=419"));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    subscription.unsubscribe();
    expect(signals[1].aborted).toBe(true);
  });

  it("times out and aborts the chapter request with a retryable failure", async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn((_url, options) => {
      signal = options?.signal as AbortSignal;
      return new Promise(() => undefined);
    });
    const output = lastValueFrom(
      fetchChapterEpic(of(fetchChapter(chapterID)), {} as any).pipe(toArray()),
    );
    await jest.advanceTimersByTimeAsync(EIGHT_COMIC_REQUEST_TIMEOUT_MS);
    await expect(output).resolves.toEqual([
      updateSiteInfo("8comic", "https://www.8comic.com"),
      setChapterLoadFailed(),
    ]);
    expect(signal?.aborted).toBe(true);
  });

  it("clears a failed preload gate without advancing its chapter frontier", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const state$ = {
      value: {
        comics: {
          readerGeneration: 1,
          chapterList: [chapterID],
          imageList: {
            result: [0],
            entity: { 0: { chapter: "online/new-105.html?ch=419" } },
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

  it("rejects invalid chapter input without issuing network requests", async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    await expect(
      lastValueFrom(fetchChapterImages$("https://evil.test/page")),
    ).rejects.toThrow("Invalid 8comic chapter ID");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
