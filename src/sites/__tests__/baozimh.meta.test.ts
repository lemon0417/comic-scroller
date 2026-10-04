import { firstValueFrom } from "rxjs";

import { readSiteFixture } from "../../testUtils/siteFixtures";
import { fetchMeta$, parseBaozimhMeta } from "../baozimh/meta";
import { BAOZIMH_REQUEST_TIMEOUT_MS } from "../baozimh/url";
import { getSiteAdapter, getSiteChapterFetcher } from "../registry";

const slug = "zhongjiedechitianshi-jiyingshe";
const fixture = (id = slug) => readSiteFixture("baozimh", `series-${id}.html`);

describe("Baozimh metadata", () => {
  const originalFetch = globalThis.fetch;
  const originalParser = globalThis.DOMParser;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.DOMParser = originalParser;
    jest.useRealTimers();
  });

  it.each([
    [
      slug,
      "終結的熾天使",
      [158, 157, 25, 24, 23, 22, 1, 0],
      "第159話 戀愛的少女",
    ],
    [
      "yongfenshenzidongshouxi-mongseekmrchaopal",
      "用分身自動狩獵",
      [175, 174, 25, 24, 23, 22, 1, 0],
      "[第176話] 尾音",
    ],
  ] as const)(
    "reads %s including hidden chapters without DOM",
    (id, title, slots, latestTitle) => {
      (globalThis as any).DOMParser = undefined;
      const meta = parseBaozimhMeta(fixture(id), id);
      expect(meta.title).toBe(title);
      expect(meta.cover).toBe(
        `https://static-tw.baozimh.com/cover/${id}.jpg?w=285&h=375&q=100`,
      );
      expect(meta.chapterList).toEqual(
        slots.map((slot) => `comic/chapter/${id}/0_${slot}.html`),
      );
      expect(meta.chapterGroups).toEqual([
        { id: "section:0", chapterList: meta.chapterList },
      ]);
      expect(meta.chapters[meta.chapterList[0]]).toEqual({
        title: latestTitle,
        href: `https://www.twmanga.com/comic/chapter/${id}/0_${slots[0]}.html`,
      });
    },
  );

  it("ignores the latest/recommendation/script lists and deduplicates full-directory chapters", () => {
    // Synthetic anchors added to the real sample exercise directory boundaries.
    const anchor = (id: string, slot: number) =>
      `<a class="comics-chapters__item" href="/user/page_direct?comic_id=${id}&amp;section_slot=0&amp;chapter_slot=${slot}"><div><span>Extra</span></div></a>`;
    const start = /<div id="chapter-items"[^>]*>/.exec(fixture())![0];
    const html = fixture()
      .replace(
        start,
        `${start}${anchor(slug, 0)}${anchor("other-series", 999)}<script>${anchor(slug, 997)}</script><!--${anchor(slug, 996)}-->`,
      )
      .replace("</body>", `${anchor(slug, 998)}</body>`);
    expect(parseBaozimhMeta(html, slug).chapterList).toEqual(
      [158, 157, 25, 24, 23, 22, 1, 0].map(
        (slot) => `comic/chapter/${slug}/0_${slot}.html`,
      ),
    );
  });

  it("keeps separate section slots as stable groups and reverses each directory independently", () => {
    // Synthetic second section; these examples currently have only section 0.
    const start = /<div id="chapters_other_list"[^>]*>/.exec(fixture())![0];
    const extra = [0, 1]
      .map(
        (slot) =>
          `<a class="comics-chapters__item" href="/user/page_direct?comic_id=${slug}&amp;section_slot=2&amp;chapter_slot=${slot}"><span>番外 ${slot}</span></a>`,
      )
      .join("");
    const meta = parseBaozimhMeta(
      fixture().replace(start, start + extra),
      slug,
    );
    expect(meta.chapterGroups).toEqual([
      {
        id: "section:0",
        chapterList: [158, 157, 25, 24, 23, 22, 1, 0].map(
          (slot) => `comic/chapter/${slug}/0_${slot}.html`,
        ),
      },
      {
        id: "section:2",
        chapterList: [1, 0].map(
          (slot) => `comic/chapter/${slug}/2_${slot}.html`,
        ),
      },
    ]);
    expect(meta.chapterList).toEqual(
      meta.chapterGroups!.flatMap((group) => group.chapterList),
    );
  });

  it("decodes metadata entities and accepts a short directory without a hidden list", () => {
    const html = fixture()
      .replace(/<div id="chapters_other_list"[\s\S]*?<\/body>/, "</body>")
      .replace("0_158.html", "0_23.html")
      .replace('content="終結的熾天使"', 'content="A &amp; B"');
    const meta = parseBaozimhMeta(html, slug);
    expect(meta.title).toBe("A & B");
    expect(meta.chapterList).toHaveLength(4);
  });

  it("fetches through twmanga and projects grouped snapshots without cover validation", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        text: async () =>
          fixture().replace(
            "https://static-tw.baozimh.com/cover/",
            "https://evil.test/cover/",
          ),
      });
    const snapshot = await firstValueFrom(
      getSiteChapterFetcher("baozimh")!(
        `https://www.baozimh.com/comic/${slug}`,
      ),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `https://www.twmanga.com/comic/${slug}`,
      { redirect: "error", signal: expect.any(AbortSignal) },
    );
    expect(snapshot.chapterList).toHaveLength(8);
    expect(snapshot.chapterGroups).toHaveLength(1);
    expect(snapshot).not.toHaveProperty("cover");
    expect(snapshot).not.toHaveProperty("title");
    expect(getSiteAdapter("baozimh")?.baseURL).toBe("https://www.baozimh.com");
  });

  it.each([
    `https://www.baozimh.com.evil.test/comic/${slug}`,
    `http://www.baozimh.com/comic/${slug}`,
    `https://user:pass@www.twmanga.com/comic/${slug}`,
    `https://www.twmanga.com/comic/chapter/${slug}/0_0.html`,
  ])("rejects unsupported metadata URL before HTTP: %s", (url) => {
    globalThis.fetch = jest.fn();
    expect(() => fetchMeta$(url)).toThrow();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["challenge", "<html>正在验证浏览器</html>"],
    [
      "identity mismatch",
      fixture().replace(
        `content="https://www.twmanga.com/comic/${slug}"`,
        'content="https://www.twmanga.com/comic/other-series"',
      ),
    ],
    [
      "missing full directory",
      fixture().replace('id="chapter-items"', 'id="recommendations"'),
    ],
    [
      "missing hidden latest",
      fixture().replace('id="chapters_other_list"', 'id="other"'),
    ],
    [
      "invalid cover",
      fixture().replace("https://static-tw.baozimh.com/", "https://evil.test/"),
    ],
    [
      "untrusted chapter host",
      fixture().replaceAll(
        'href="/user/page_direct',
        'href="https://evil.test/user/page_direct',
      ),
    ],
    ["incomplete container", fixture().replace(/<\/div>/g, "")],
    ["oversized", "x".repeat(2 * 1024 * 1024 + 1)],
  ])("rejects %s", (_label, html) => {
    expect(() => parseBaozimhMeta(html, slug)).toThrow();
  });

  it("rejects an HTTP challenge without retrying or writing an empty snapshot", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(
      firstValueFrom(fetchMeta$(`https://www.baozimh.com/comic/${slug}`)),
    ).rejects.toThrow("403");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("aborts an unsubscribed metadata request", () => {
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn((_url, options) => {
      signal = options?.signal as AbortSignal;
      return new Promise(() => undefined);
    });
    const subscription = fetchMeta$(
      `https://www.twmanga.com/comic/${slug}`,
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
      fetchMeta$(`https://www.baozimh.com/comic/${slug}`),
    );
    const expectation = expect(result).rejects.toThrow("Timeout");
    await jest.advanceTimersByTimeAsync(BAOZIMH_REQUEST_TIMEOUT_MS);
    await expectation;
    expect(signal?.aborted).toBe(true);
  });
});
