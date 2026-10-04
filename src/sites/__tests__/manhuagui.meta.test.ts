import { compressToBase64 } from "lz-string";
import { firstValueFrom } from "rxjs";

import { readSiteFixture } from "../../testUtils/siteFixtures";
import { fetchMeta$, parseManhuaguiMeta } from "../manhuagui/meta";
import { MANHUAGUI_REQUEST_TIMEOUT_MS } from "../manhuagui/url";
import { getSiteChapterFetcher } from "../registry";

const fixture = (id: string) =>
  readSiteFixture("manhuagui", `${id}.series.html`);

const expectedChapterNumbers: Record<string, string[]> = {
  "49169": [
    "910633",
    "910632",
    "760171",
    "760170",
    "760169",
    "760168",
    "760086",
    "760085",
    "766748",
    "760084",
    "760078",
    "705046",
    "760077",
  ],
  "28004": [
    "844724",
    "833736",
    "528964",
    "569206",
    "796021",
    "701835",
    "390446",
    "379497",
    "778267",
    "777161",
    "631833",
    "630677",
    "628277",
    "627065",
    "477573",
    "475810",
    "475809",
    "472938",
    "370447",
    "370153",
    "370061",
    "369737",
    "369532",
  ],
};

describe("Manhuagui metadata", () => {
  const originalFetch = globalThis.fetch;
  const originalParser = globalThis.DOMParser;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.DOMParser = originalParser;
    jest.useRealTimers();
  });

  it.each([
    ["49169", 13, ["单话", "单行本", "番外篇"], "comic/49169/910633.html"],
    ["28004", 23, ["单行本", "番外篇", "单话"], "comic/28004/844724.html"],
  ])(
    "parses the actual %s response without DOM, including all hidden chapter pages",
    (id, count, groups, first) => {
      (globalThis as any).DOMParser = undefined;
      const meta = parseManhuaguiMeta(fixture(id), id);
      expect(meta.chapterList).toHaveLength(count);
      expect(meta.chapterList).toEqual(
        expectedChapterNumbers[id].map(
          (number) => `comic/${id}/${number}.html`,
        ),
      );
      expect(meta.chapterList[0]).toBe(first);
      expect(meta.chapterGroups?.map((group) => group.id)).toEqual(groups);
      expect(
        meta.chapterGroups?.map((group) => group.chapterList.length),
      ).toEqual(id === "49169" ? [8, 4, 1] : [4, 4, 15]);
      expect(new Set(meta.chapterList).size).toBe(count);
      expect(meta.cover).toBe(`https://cf.mhgui.com/cpic/h/${id}.jpg`);
      expect(meta.chapterList).not.toContain(`comic/${id}/999999.html`);
      expect(meta.chapters[first].title).not.toMatch(/\d+p$/);
    },
  );

  it("preserves the site's page and chapter ordering rather than sorting opaque chapter IDs", () => {
    const meta = parseManhuaguiMeta(fixture("28004"), "28004");
    const volumes = meta.chapterGroups![0].chapterList;
    expect(volumes.slice(-2)).toEqual([
      "comic/28004/528964.html",
      "comic/28004/569206.html",
    ]);
    const singles = meta.chapterGroups![2].chapterList;
    expect(singles[0]).toBe("comic/28004/778267.html");
    expect(singles.at(-1)).toBe("comic/28004/369532.html");
    expect(parseManhuaguiMeta(fixture("49169"), "49169").title).toContain(
      "转生贵族",
    );
    expect(meta.title).toBe("咒术回战");
  });

  it("supports the __VIEWSTATE chapter HTML consumed by the site's main script", () => {
    const html = fixture("49169");
    const start = html.indexOf("<h4>");
    const end = html.indexOf("<aside>");
    const compressed = compressToBase64(html.slice(start, end));
    const meta = parseManhuaguiMeta(
      `${html.slice(0, start)}<input id="__VIEWSTATE" value="${compressed}" /></body></html>`,
      "49169",
    );
    expect(meta.chapterList).toHaveLength(13);
    expect(meta.chapterList[0]).toBe("comic/49169/910633.html");
  });

  it("projects groups into the background chapter snapshot and omits the cover", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, text: async () => fixture("49169") });
    const snapshot = await firstValueFrom(
      getSiteChapterFetcher("manhuagui")!(
        "https://www.manhuagui.com/comic/49169/",
      ),
    );
    expect(snapshot).not.toHaveProperty("title");
    expect(snapshot).not.toHaveProperty("cover");
    expect(snapshot.chapterGroups).toHaveLength(3);
    expect(snapshot.chapterList).toHaveLength(13);
  });

  it.each([
    "https://evil.test/comic/49169/",
    "https://www.manhuagui.com/comic/49169/1.html",
  ])("rejects unsupported metadata URL %s before making a request", (url) => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    expect(() => fetchMeta$(url)).toThrow("Invalid Manhuagui series URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects pages with no usable chapter groups", () => {
    expect(() =>
      parseManhuaguiMeta("<html>Access denied</html>", "49169"),
    ).toThrow();
  });

  it("rejects unsuccessful HTTP responses", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(
      firstValueFrom(fetchMeta$("https://www.manhuagui.com/comic/49169/")),
    ).rejects.toThrow("403");
  });

  it("aborts a pending metadata fetch when unsubscribed", () => {
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn((_url, options) => {
      signal = options?.signal as AbortSignal;
      return new Promise(() => undefined);
    });
    const subscription = fetchMeta$(
      "https://www.manhuagui.com/comic/49169/",
    ).subscribe();
    subscription.unsubscribe();
    expect(signal?.aborted).toBe(true);
  });

  it("times out and aborts a stalled metadata fetch", async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn((_url, options) => {
      signal = options?.signal as AbortSignal;
      return new Promise(() => undefined);
    });
    const result = firstValueFrom(
      fetchMeta$("https://www.manhuagui.com/comic/49169/"),
    );
    const expectation = expect(result).rejects.toThrow("Timeout");
    await jest.advanceTimersByTimeAsync(MANHUAGUI_REQUEST_TIMEOUT_MS);
    await expectation;
    expect(signal?.aborted).toBe(true);
  });
});
