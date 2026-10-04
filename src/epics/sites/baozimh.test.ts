import { fetchChapter, fetchImgList } from "@domain/actions/reader";
import {
  clearPendingChapterGate,
  setChapterLoadFailed,
  updateChapterLatestIndex,
} from "@domain/reducers/comics";
import { applyReaderSeriesState } from "@infra/services/library/reader";
import { BAOZIMH_REQUEST_TIMEOUT_MS } from "@sites/baozimh/url";
import { firstValueFrom, lastValueFrom, of, Subject } from "rxjs";
import { toArray } from "rxjs/operators";

import { readSiteFixture } from "../../testUtils/siteFixtures";
import {
  fetchChapterEpic,
  fetchChapterImages$,
  fetchImgListEpic,
} from "./baozimh";
import { getSiteReaderEpics } from "./registry";

jest.mock("@infra/services/library/reader", () => ({
  applyReaderSeriesState: jest.fn(),
  applyReadProgress: jest.fn(),
}));

const first = "zhongjiedechitianshi-jiyingshe";
const second = "yongfenshenzidongshouxi-mongseekmrchaopal";
const chapterID = `comic/chapter/${first}/0_0.html`;
function mockFixtureFetch() {
  const fetchMock = jest.fn((url: string | URL | Request) => {
    const parsed = new URL(String(url));
    const path = parsed.pathname.split("/");
    const filename =
      path[2] === "chapter"
        ? `chapter-${path[3]}-${path[4]}`
        : `series-${path[2]}.html`;
    return Promise.resolve({
      ok: true,
      text: async () => readSiteFixture("baozimh", filename),
    } as Response);
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

describe("Baozimh reader", () => {
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
    [first, "0_0", 80, "s1", "1-9ica", 2],
    [second, "0_175", 131, "s2", "176-5qzk", 3],
    [second, "0_0", 40, "s1", "0-e9xk", 1],
  ] as const)(
    "assembles the complete %s chapter %s with stable image order",
    async (slug, part, count, server, folder, pages) => {
      const fetchMock = mockFixtureFetch();
      const canonicalID = `comic/chapter/${slug}/${part}.html`;
      const payload = await firstValueFrom(fetchChapterImages$(canonicalID));
      expect(payload).toMatchObject({
        chapterID: canonicalID,
        seriesID: slug,
        comicUrl: `https://www.baozimh.com/comic/${slug}`,
      });
      expect(payload.imgList).toEqual(
        Array.from({ length: count }, (_, index) => ({
          chapter: canonicalID,
          src: `https://${server}.bzcdn.net/scomic/${slug}/0/${folder}/${index + 1}.jpg`,
        })),
      );
      expect(fetchMock).toHaveBeenCalledTimes(pages);
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(
        Array.from(
          { length: pages },
          (_, index) =>
            `https://www.twmanga.com/comic/chapter/${slug}/${part}${index === 0 ? "" : `_${index + 1}`}.html`,
        ),
      );
    },
  );

  it("starts from page 1 when opened from a later native page", async () => {
    const fetchMock = mockFixtureFetch();
    const payload = await firstValueFrom(
      fetchChapterImages$(`comic/chapter/${first}/0_0_2.html`),
    );
    expect(payload.chapterID).toBe(chapterID);
    expect(payload.imgList).toHaveLength(80);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://www.twmanga.com/${chapterID}`,
    );
  });

  it("hydrates persistence and group checkpoints through the shared reader flow", async () => {
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
    expect(getSiteReaderEpics("baozimh")?.fetchChapterEpic).toBe(
      fetchChapterEpic,
    );
    expect(applyReaderSeriesState).toHaveBeenCalledWith(
      "baozimh",
      first,
      expect.objectContaining({
        url: `https://www.baozimh.com/comic/${first}`,
        title: "終結的熾天使",
        chapterList: expect.any(Array),
      }),
      chapterID,
      expect.objectContaining({
        chapterGroups: [expect.objectContaining({ id: "section:0" })],
      }),
    );
    expect(actions).not.toContainEqual(setChapterLoadFailed());
    expect(actions).toContainEqual(
      expect.objectContaining({
        type: "UPDATE_SITE_INFO",
        site: "baozimh",
        comicUrl: `https://www.baozimh.com/comic/${first}`,
      }),
    );
  });

  it("fails the whole chapter when a later page fails, then allows an explicit retry", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          readSiteFixture("baozimh", `chapter-${first}-0_0.html`),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    const actions = await lastValueFrom(
      fetchChapterEpic(of(fetchChapter(chapterID)), {} as any).pipe(toArray()),
    );
    expect(actions).toEqual([setChapterLoadFailed()]);
    expect(applyReaderSeriesState).not.toHaveBeenCalled();
    mockFixtureFetch();
    await expect(
      firstValueFrom(fetchChapterImages$(chapterID)),
    ).resolves.toMatchObject({ imgList: expect.any(Array) });
  });

  it("clears a failed preload gate without moving the frontier", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const state$ = {
      value: {
        comics: {
          readerGeneration: 1,
          chapterList: [chapterID],
          imageList: {
            result: [0],
            entity: { 0: { chapter: `comic/chapter/${first}/0_1.html` } },
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

  it("cancels requests when changing chapters", () => {
    const signals: AbortSignal[] = [];
    globalThis.fetch = jest.fn((_url, options) => {
      signals.push(options?.signal as AbortSignal);
      return new Promise(() => undefined);
    });
    const action$ = new Subject<ReturnType<typeof fetchChapter>>();
    const subscription = fetchChapterEpic(action$, {} as any).subscribe();
    action$.next(fetchChapter(chapterID));
    action$.next(fetchChapter(`comic/chapter/${first}/0_1.html`));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    subscription.unsubscribe();
    expect(signals[1].aborted).toBe(true);
  });

  it("applies the timeout to the whole chapter and aborts a stalled later page", async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  text: async () =>
                    readSiteFixture("baozimh", `chapter-${first}-0_0.html`),
                }),
              20_000,
            ),
          ),
      )
      .mockImplementationOnce((_url, options) => {
        signal = options?.signal as AbortSignal;
        return new Promise(() => undefined);
      });
    const output = lastValueFrom(
      fetchChapterEpic(of(fetchChapter(chapterID)), {} as any).pipe(toArray()),
    );
    await jest.advanceTimersByTimeAsync(BAOZIMH_REQUEST_TIMEOUT_MS);
    await expect(output).resolves.toEqual([setChapterLoadFailed()]);
    expect(signal?.aborted).toBe(true);
    expect(applyReaderSeriesState).not.toHaveBeenCalled();
  });

  it("aborts an in-flight later page on unsubscribe", async () => {
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          readSiteFixture("baozimh", `chapter-${first}-0_0.html`),
      })
      .mockImplementationOnce((_url, options) => {
        signal = options?.signal as AbortSignal;
        return new Promise(() => undefined);
      });
    const subscription = fetchChapterImages$(chapterID).subscribe();
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    expect(signal?.aborted).toBe(false);
    subscription.unsubscribe();
    expect(signal?.aborted).toBe(true);
  });

  it("rejects inconsistent page totals", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          readSiteFixture("baozimh", `chapter-${first}-0_0.html`),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          readSiteFixture("baozimh", `chapter-${first}-0_0_2.html`)
            .replace("(2/2)", "(2/3)")
            .replace("下一話", "下一頁")
            .replace("0_1.html", "0_0_3.html"),
      });
    await expect(
      firstValueFrom(fetchChapterImages$(chapterID)),
    ).rejects.toThrow();
  });

  it("rejects invalid input before network access", async () => {
    globalThis.fetch = jest.fn();
    await expect(
      firstValueFrom(fetchChapterImages$("https://evil.test/page")),
    ).rejects.toThrow("Invalid Baozimh chapter ID");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
