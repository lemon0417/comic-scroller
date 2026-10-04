import { fetchMeta$ } from "@sites/dm5/meta";
import { getSiteChapterFetcher } from "@sites/registry";
import { firstValueFrom, lastValueFrom } from "rxjs";
import { toArray } from "rxjs/operators";

import { readSiteFixture } from "../../testUtils/siteFixtures";

describe("dm5 fetchMeta$", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("parses chapter list from RSS XML and fills cover from comic HTML", async () => {
    const rssXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <rss version="2.0">
        <channel>
          <title>可怕的朋友姐姐是位好人</title>
          <item>
            <title>第4话 </title>
            <link>https://www.dm5.com/m1771525/</link>
          </item>
          <item>
            <title>第3话 </title>
            <link>https://www.dm5.com/m1733877/</link>
          </item>
        </channel>
      </rss>`;
    const html = `
      <html>
        <body>
          <div class="banner_detail">
            <div class="cover"><img src="https://img.dm5.com/cover.jpg" /></div>
          </div>
        </body>
      </html>
    `;

    const originalFetch = globalThis.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(rssXml),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });
    (globalThis as any).fetch = fetchMock;

    try {
      const result = await firstValueFrom(
        fetchMeta$(
          "https://www.dm5.com/manhua-kepadepengyoujiejieshiweihaoren/",
        ),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "https://www.dm5.com/rss-kepadepengyoujiejieshiweihaoren/",
        expect.objectContaining({ signal: expect.anything() }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "https://www.dm5.com/manhua-kepadepengyoujiejieshiweihaoren/",
        expect.objectContaining({ signal: expect.anything() }),
      );
      expect(result).toEqual({
        title: "可怕的朋友姐姐是位好人",
        cover: "https://img.dm5.com/cover.jpg",
        chapterList: ["m1771525", "m1733877"],
        chapters: {
          m1771525: {
            title: "第4话",
            href: "https://www.dm5.com/m1771525/",
          },
          m1733877: {
            title: "第3话",
            href: "https://www.dm5.com/m1733877/",
          },
        },
      });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("can defer cover hydration for reader-first flows", async () => {
    const rssXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <rss version="2.0">
        <channel>
          <title>Deferred Cover</title>
          <item>
            <title>第1话 </title>
            <link>https://www.dm5.com/m100/</link>
          </item>
        </channel>
      </rss>`;
    const html = `
      <html>
        <body>
          <div class="banner_detail">
            <div class="cover"><img src="https://img.dm5.com/deferred-cover.jpg" /></div>
          </div>
        </body>
      </html>
    `;

    const originalFetch = globalThis.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(rssXml),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });
    (globalThis as any).fetch = fetchMock;

    try {
      const emissions = await lastValueFrom(
        fetchMeta$("https://www.dm5.com/manhua-deferred-cover/", {
          deferCover: true,
        }).pipe(toArray()),
      );
      expect(emissions).toEqual([
        {
          title: "Deferred Cover",
          cover: "",
          chapterList: ["m100"],
          chapters: {
            m100: {
              title: "第1话",
              href: "https://www.dm5.com/m100/",
            },
          },
        },
        {
          title: "Deferred Cover",
          cover: "https://img.dm5.com/deferred-cover.jpg",
          chapterList: ["m100"],
          chapters: {
            m100: {
              title: "第1话",
              href: "https://www.dm5.com/m100/",
            },
          },
        },
      ]);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("parses RSS XML without DOMParser", async () => {
    const rssXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <rss version="2.0">
        <channel>
          <title>Demo RSS</title>
          <item>
            <title>第2话 </title>
            <link>https://www.dm5.com/m200/</link>
          </item>
          <item>
            <title>第1话 </title>
            <link>https://www.dm5.com/m100/</link>
          </item>
        </channel>
      </rss>`;
    const html = `
      <html>
        <body>
          <div class="banner_detail">
            <div class="cover"><img src="https://img.dm5.com/rss-cover.jpg" /></div>
          </div>
        </body>
      </html>
    `;

    const originalFetch = globalThis.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(rssXml),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });
    (globalThis as any).fetch = fetchMock;
    const originalParser = globalThis.DOMParser;
    (globalThis as any).DOMParser = undefined;

    try {
      const result = await firstValueFrom(
        fetchMeta$("https://www.dm5.com/manhua-demo-rss/"),
      );
      expect(result.title).toBe("Demo RSS");
      expect(result.cover).toBe("https://img.dm5.com/rss-cover.jpg");
      expect(result.chapterList).toEqual(["m200", "m100"]);
      expect(result.chapters.m200.title).toBe("第2话");
      expect(result.chapters.m100.href).toBe("https://www.dm5.com/m100/");
    } finally {
      (globalThis as any).DOMParser = originalParser;
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("uses RSS only for background chapter snapshots", async () => {
    const rssXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <rss version="2.0">
        <channel>
          <title>RSS Only</title>
          <item>
            <title>第1话 </title>
            <link>https://www.dm5.com/m100/</link>
          </item>
        </channel>
      </rss>`;

    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(rssXml),
    });
    (globalThis as any).fetch = fetchMock;

    try {
      const fetchChapters = getSiteChapterFetcher("dm5");
      const result = await firstValueFrom(
        fetchChapters!("https://www.dm5.com/manhua-rss-only/"),
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://www.dm5.com/rss-rss-only/",
        expect.objectContaining({ signal: expect.anything() }),
      );
      expect(result).toEqual({
        chapterList: ["m100"],
        chapters: {
          m100: {
            title: "第1话",
            href: "https://www.dm5.com/m100/",
          },
        },
      });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("ignores RSS items without usable chapter links", async () => {
    const rssXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <rss version="2.0">
        <channel>
          <title>Broken RSS</title>
          <item>
            <title>第2话 </title>
            <link>https://www.dm5.com/m200/</link>
          </item>
          <item>
            <title>缺 link</title>
          </item>
          <item>
            <link></link>
          </item>
        </channel>
      </rss>`;

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(rssXml),
    });

    try {
      const result = await firstValueFrom(
        fetchMeta$("https://www.dm5.com/manhua-broken-rss/", {
          includeCover: false,
        }),
      );
      expect(result.title).toBe("Broken RSS");
      expect(result.chapterList).toEqual(["m200"]);
      expect(result.chapters).toEqual({
        m200: {
          title: "第2话",
          href: "https://www.dm5.com/m200/",
        },
      });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("falls back to HTML parsing when the RSS request fails", async () => {
    const html = `
      <html>
        <head><title>Fallback Comic - DM5</title></head>
        <body>
          <div class="banner_detail">
            <div class="info"><span class="title">Fallback Comic</span></div>
            <div class="cover"><img src="https://img.dm5.com/fallback.jpg" /></div>
          </div>
          <div id="chapterlistload">
            <li><a href="/m9/">Ch 9</a></li>
            <li><a href="/m8/">Ch 8</a></li>
          </div>
        </body>
      </html>
    `;

    const originalFetch = globalThis.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve(""),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });
    (globalThis as any).fetch = fetchMock;

    try {
      const result = await firstValueFrom(
        fetchMeta$("https://www.dm5.com/manhua-fallback-comic/"),
      );
      expect(result).toEqual({
        title: "Fallback",
        cover: "https://img.dm5.com/fallback.jpg",
        chapterList: ["m9", "m8"],
        chapters: {
          m9: {
            title: "Ch 9",
            href: "https://www.dm5.com/m9/",
          },
          m8: {
            title: "Ch 8",
            href: "https://www.dm5.com/m8/",
          },
        },
      });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("does not repeat a failed comic HTML request during RSS fallback", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve(""),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve(""),
      });
    (globalThis as any).fetch = fetchMock;

    try {
      await expect(
        firstValueFrom(
          fetchMeta$("https://www.dm5.com/manhua-failed-fallback/"),
        ),
      ).rejects.toThrow("DM5 comic html request failed: 502");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "https://www.dm5.com/rss-failed-fallback/",
        expect.objectContaining({ signal: expect.anything() }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "https://www.dm5.com/manhua-failed-fallback/",
        expect.objectContaining({ signal: expect.anything() }),
      );
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("falls back to HTML parsing when RSS does not contain usable chapters", async () => {
    const rssXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <rss version="2.0">
        <channel>
          <title>Broken RSS</title>
          <item>
            <title>Invalid</title>
            <link></link>
          </item>
        </channel>
      </rss>`;
    const html = `
      <html>
        <head><title>Fallback Parse - DM5</title></head>
        <body>
          <div class="banner_detail">
            <div class="info"><span class="title">Fallback Parse</span></div>
          </div>
          <div id="chapterlistload">
            <li><a href="/m3/">Ch 3</a></li>
          </div>
        </body>
      </html>
    `;

    const originalFetch = globalThis.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(rssXml),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });
    (globalThis as any).fetch = fetchMock;

    try {
      const result = await firstValueFrom(
        fetchMeta$("https://www.dm5.com/manhua-rss-parse-fallback/"),
      );
      expect(result.title).toBe("Fallback");
      expect(result.chapterList).toEqual(["m3"]);
      expect(result.chapters.m3.href).toBe("https://www.dm5.com/m3/");
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("parses meta from HTML when DOMParser is unavailable", async () => {
    const html = `
      <html>
        <head><title>Demo Comic - DM5</title></head>
        <body>
          <div class="banner_detail">
            <div class="info"><span class="title">Demo Comic</span></div>
            <div class="cover"><img src="https://img.dm5.com/cover.jpg" /></div>
          </div>
          <div id="chapterlistload">
            <li><a href="/m1/">Ch 1</a></li>
            <li><a href="/m2/">Ch 2</a></li>
          </div>
        </body>
      </html>
    `;

    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });
    (globalThis as any).fetch = fetchMock;
    const originalParser = globalThis.DOMParser;
    (globalThis as any).DOMParser = undefined;

    try {
      const result = await firstValueFrom(
        fetchMeta$("https://www.dm5.com/demo"),
      );
      expect(result.title).toBe("Demo");
      expect(result.cover).toBe("https://img.dm5.com/cover.jpg");
      expect(result.chapterList).toEqual(["m1", "m2"]);
      expect(result.chapters.m1.href).toBe("https://www.dm5.com/m1/");
    } finally {
      (globalThis as any).DOMParser = originalParser;
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("aborts in-flight RSS and cover requests when unsubscribed", () => {
    const originalFetch = globalThis.fetch;
    const signals: AbortSignal[] = [];
    const fetchMock = jest.fn((_url: string, init?: RequestInit) => {
      if (init?.signal) {
        signals.push(init.signal);
      }
      return new Promise(() => undefined);
    });
    (globalThis as any).fetch = fetchMock;

    try {
      const subscription = fetchMeta$(
        "https://www.dm5.com/manhua-cancelled/",
      ).subscribe();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(signals).toHaveLength(2);
      expect(signals.every((signal) => !signal.aborted)).toBe(true);

      subscription.unsubscribe();

      expect(signals.every((signal) => signal.aborted)).toBe(true);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });
});

describe("dm5 captured metadata flows", () => {
  const originalFetch = globalThis.fetch;
  const originalParser = globalThis.DOMParser;
  const samples = [
    {
      slug: "dianjuren",
      title: "电锯人",
      cover:
        "https://mhfm6tw.cdndm5.com/47/46568/20190708225456_450x600_101.jpg",
      rssIDs: ["m1768478", "m1764103", "m1300155"],
      htmlIDs: ["m1768478", "m1764103", "m1300155"],
    },
    {
      slug: "bailianchengshen",
      title: "百炼成神",
      cover:
        "https://mhfm6tw.cdndm5.com/21/20802/20191227112603_450x600_111.jpg",
      rssIDs: ["m1659652", "m462489", "m225202"],
      htmlIDs: ["m225202", "m462489", "m1659652"],
    },
  ];
  const response = (body: string) =>
    ({
      ok: true,
      text: async () => body,
    }) as Response;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.DOMParser = originalParser;
  });

  it.each(samples)(
    "hydrates $slug RSS before its captured cover",
    async (sample) => {
      const url = `https://www.dm5.com/manhua-${sample.slug}/`;
      const fetchMock = jest.fn((requestURL: unknown) =>
        Promise.resolve(
          response(
            readSiteFixture(
              "dm5",
              `${sample.slug}.${String(requestURL).includes("/rss-") ? "rss.xml" : "series.html"}`,
            ),
          ),
        ),
      );
      globalThis.fetch = fetchMock;
      const emissions = await lastValueFrom(
        fetchMeta$(url, { deferCover: true }).pipe(toArray()),
      );
      expect(emissions).toHaveLength(2);
      expect(emissions[0]).toMatchObject({
        title: sample.title,
        cover: "",
        chapterList: sample.rssIDs,
      });
      expect(emissions[1]).toEqual({ ...emissions[0], cover: sample.cover });
      expect(fetchMock.mock.calls.map(([requestURL]) => requestURL)).toEqual([
        `https://www.dm5.com/rss-${sample.slug}/`,
        url,
      ]);
    },
  );

  it.each(samples)(
    "uses only captured $slug RSS for background",
    async (sample) => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          response(readSiteFixture("dm5", `${sample.slug}.rss.xml`)),
        );
      globalThis.fetch = fetchMock;
      const snapshot = await firstValueFrom(
        getSiteChapterFetcher("dm5")!(
          `https://www.dm5.com/manhua-${sample.slug}/`,
        ),
      );
      expect(snapshot.chapterList).toEqual(sample.rssIDs);
      expect(snapshot).not.toHaveProperty("title");
      expect(snapshot).not.toHaveProperty("cover");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `https://www.dm5.com/rss-${sample.slug}/`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    },
  );

  describe.each(["HTTP failure", "empty RSS"])("%s fallback", (scenario) => {
    it.each(samples)(
      "reuses captured $slug HTML without DOM",
      async (sample) => {
        (globalThis as any).DOMParser = undefined;
        const fetchMock = jest
          .fn()
          .mockResolvedValueOnce(
            scenario === "HTTP failure"
              ? { ok: false, status: 503 }
              : response("<rss><channel><title>Empty</title></channel></rss>"),
          )
          .mockResolvedValueOnce(
            response(readSiteFixture("dm5", `${sample.slug}.series.html`)),
          );
        globalThis.fetch = fetchMock;
        const meta = await firstValueFrom(
          fetchMeta$(`https://www.dm5.com/manhua-${sample.slug}/`),
        );
        expect(meta).toMatchObject({
          title: sample.title,
          cover: sample.cover,
          chapterList: sample.htmlIDs,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
      },
    );
  });
});
