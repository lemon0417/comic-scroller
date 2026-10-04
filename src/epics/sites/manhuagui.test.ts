import { fetchChapter, fetchImgList } from "@domain/actions/reader";
import {
  clearPendingChapterGate,
  setChapterLoadFailed,
  updateChapterLatestIndex,
  updateSiteInfo,
} from "@domain/reducers/comics";
import { applyReaderSeriesState } from "@infra/services/library/reader";
import { MANHUAGUI_REQUEST_TIMEOUT_MS } from "@sites/manhuagui/url";
import { lastValueFrom, of, Subject } from "rxjs";
import { toArray } from "rxjs/operators";

import { readSiteFixture } from "../../testUtils/siteFixtures";
import {
  fetchChapterEpic,
  fetchChapterImages$,
  fetchImgListEpic,
} from "./manhuagui";

jest.mock("@infra/services/library/reader", () => ({
  applyReaderSeriesState: jest.fn(),
  applyReadProgress: jest.fn(),
}));

const chapterID = "comic/49169/910633.html";
const fixture = (suffix: string) =>
  readSiteFixture(
    "manhuagui",
    suffix === ".chapter" ? "910633.chapter.html" : "49169.series.html",
  );

describe("Manhuagui reader", () => {
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

  it("hydrates the reader, persistence and group baselines through the shared flow", async () => {
    globalThis.fetch = jest.fn((url) =>
      Promise.resolve({
        ok: true,
        text: async () =>
          fixture(String(url).endsWith(".html") ? ".chapter" : ""),
      } as Response),
    );
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
    expect(applyReaderSeriesState).toHaveBeenCalledWith(
      "manhuagui",
      "49169",
      expect.objectContaining({
        chapterList: expect.any(Array),
        url: "https://www.manhuagui.com/comic/49169/",
      }),
      chapterID,
      expect.objectContaining({
        chapterGroups: expect.arrayContaining([
          expect.objectContaining({ id: "番外篇" }),
        ]),
      }),
    );
    expect(actions).not.toContainEqual(setChapterLoadFailed());
    expect(actions).toContainEqual(
      expect.objectContaining({ type: "UPDATE_SITE_INFO", site: "manhuagui" }),
    );
  });

  it("cancels a previous chapter fetch when navigation changes", () => {
    const signals: AbortSignal[] = [];
    globalThis.fetch = jest.fn((_url, options) => {
      signals.push(options?.signal as AbortSignal);
      return new Promise(() => undefined);
    });
    const action$ = new Subject<ReturnType<typeof fetchChapter>>();
    const subscription = fetchChapterEpic(action$, {} as any).subscribe();
    action$.next(fetchChapter(chapterID));
    action$.next(fetchChapter("comic/49169/910632.html"));
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
    await jest.advanceTimersByTimeAsync(MANHUAGUI_REQUEST_TIMEOUT_MS);
    await expect(output).resolves.toEqual([
      updateSiteInfo("manhuagui", "https://www.manhuagui.com"),
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
            entity: { 0: { chapter: "comic/49169/910632.html" } },
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
    ).rejects.toThrow("Invalid Manhuagui chapter ID");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
