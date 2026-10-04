import { firstValueFrom } from "rxjs";

import { readSiteFixture } from "../../testUtils/siteFixtures";
import { fetchMeta$, parseEightComicMeta } from "../8comic/meta";
import { EIGHT_COMIC_REQUEST_TIMEOUT_MS } from "../8comic/url";
import { getSiteAdapter, getSiteChapterFetcher } from "../registry";

const fixture = (id: string) => readSiteFixture("8comic", `series-${id}.html`);

describe("8comic metadata", () => {
  const originalFetch = globalThis.fetch;
  const originalParser = globalThis.DOMParser;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.DOMParser = originalParser;
    jest.useRealTimers();
  });

  it.each([
    ["105", "全職獵人", [420, 419, 262, 261, 32, 31, 2, 1]],
    ["1551", "銀魂", [704, 703, 168, 167, 40, 39, 2, 1]],
  ])("parses the actual %s series without DOM", (id, title, numbers) => {
    (globalThis as any).DOMParser = undefined;
    const meta = parseEightComicMeta(fixture(id), id);
    expect(meta.title).toBe(title);
    expect(meta.cover).toBe(`https://www.8comic.com/pics/0/${id}m.jpg`);
    expect(meta.chapterList).toEqual(
      (numbers as number[]).map(
        (number) => `online/new-${id}.html?ch=${number}`,
      ),
    );
    expect(meta.chapterGroups).toEqual([
      { id: "single", chapterList: meta.chapterList.slice(0, 4) },
      { id: "volume", chapterList: meta.chapterList.slice(4) },
    ]);
    expect(meta.chapters[meta.chapterList[0]]).toEqual({
      title: id === "105" ? "第420話 試看" : "704話",
      href: `https://articles.onemoreplace.tw/${meta.chapterList[0]}`,
    });
    expect(JSON.stringify(meta)).not.toContain("document.getElementById");
  });

  it("ignores recommendations, anime, script anchors and other series; deduplicates real chapters", () => {
    const injected = `<a class="Ch" onclick="cview('105-999.html',6,1);return false;">Other</a>`;
    const html = fixture("105")
      .replace("</body>", `${injected}</body>`)
      .replace(
        '<div id="chapters">',
        `<div id="chapters"><script>${injected}</script><a class="Ch" onclick="cview('1551-999.html',6,1);return false;">Other series</a><a class="Anime" onclick="cview('105-998.html',6,1);return false;">Anime</a>`,
      )
      .replace(
        "</div>",
        `<a class="Ch" onclick="cview('105-419.html',6,1);return false;">Duplicate</a></div>`,
      );
    const meta = parseEightComicMeta(html, "105");
    expect(meta.chapterList).toHaveLength(8);
    expect(meta.chapterList).not.toContain("online/new-105.html?ch=999");
  });

  it("preserves split chapter suffixes and decodes text entities", () => {
    const meta = parseEightComicMeta(
      fixture("105")
        .replace("105-419.html", "105-419a.html")
        .replace("全職獵人", "A &amp; B"),
      "105",
    );
    expect(meta.title).toBe("A & B");
    expect(meta.chapterList[1]).toBe("online/new-105.html?ch=419a");
  });

  it("projects grouped chapters for background checks and skips cover validation when omitted", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        fixture("105").replace(
          "/pics/0/105m.jpg",
          "https://evil.test/cover.jpg",
        ),
    });
    const snapshot = await firstValueFrom(
      getSiteChapterFetcher("8comic")!("https://www.8comic.com/html/105.html"),
    );
    expect(snapshot.chapterGroups).toHaveLength(2);
    expect(snapshot.chapterList).toHaveLength(8);
    expect(snapshot).not.toHaveProperty("cover");
    expect(snapshot).not.toHaveProperty("title");
    expect(getSiteAdapter("comicbus")).toBeUndefined();
  });

  it.each([
    "https://evil.test/html/105.html",
    "http://www.8comic.com/html/105.html",
    "https://www.8comic.com/view/105.html?ch=420",
  ])("rejects unsupported metadata URL %s before HTTP", (url) => {
    globalThis.fetch = jest.fn();
    expect(() => fetchMeta$(url)).toThrow("Invalid 8comic series URL");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    "<html>Access denied</html>",
    fixture("105").replace('content="105"', 'content="1551"'),
    fixture("105").replace('id="chapters"', 'id="anime"'),
    fixture("105").replace("/pics/0/105m.jpg", "https://evil.test/cover.jpg"),
  ])("rejects incomplete or untrusted series data (%#)", (html) => {
    expect(() => parseEightComicMeta(html, "105")).toThrow();
  });

  it("rejects HTTP failures", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(
      firstValueFrom(fetchMeta$("https://www.8comic.com/html/105.html")),
    ).rejects.toThrow("503");
  });

  it("aborts a pending metadata request on unsubscribe", () => {
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn((_url, options) => {
      signal = options?.signal as AbortSignal;
      return new Promise(() => undefined);
    });
    const subscription = fetchMeta$(
      "https://www.8comic.com/html/105.html",
    ).subscribe();
    subscription.unsubscribe();
    expect(signal?.aborted).toBe(true);
  });

  it("times out and aborts stalled metadata requests", async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn((_url, options) => {
      signal = options?.signal as AbortSignal;
      return new Promise(() => undefined);
    });
    const result = firstValueFrom(
      fetchMeta$("https://www.8comic.com/html/105.html"),
    );
    const expectation = expect(result).rejects.toThrow("Timeout");
    await jest.advanceTimersByTimeAsync(EIGHT_COMIC_REQUEST_TIMEOUT_MS);
    await expectation;
    expect(signal?.aborted).toBe(true);
  });
});
