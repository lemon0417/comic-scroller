import { fetchMeta$ } from "@sites/dm5/meta";
import { firstValueFrom } from "rxjs";

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
        text: () => Promise.resolve(rssXml),
      })
      .mockResolvedValueOnce({
        text: () => Promise.resolve(html),
      });
    (globalThis as any).fetch = fetchMock;

    try {
      const result = await firstValueFrom(
        fetchMeta$("https://www.dm5.com/manhua-kepadepengyoujiejieshiweihaoren/"),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "https://www.dm5.com/rss-kepadepengyoujiejieshiweihaoren/",
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "https://www.dm5.com/manhua-kepadepengyoujiejieshiweihaoren/",
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
        text: () => Promise.resolve(rssXml),
      })
      .mockResolvedValueOnce({
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

  it("skips cover HTML fetch when includeCover is false", async () => {
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
      text: () => Promise.resolve(rssXml),
    });
    (globalThis as any).fetch = fetchMock;

    try {
      const result = await firstValueFrom(
        fetchMeta$("https://www.dm5.com/manhua-rss-only/", {
          includeCover: false,
        }),
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://www.dm5.com/rss-rss-only/",
      );
      expect(result.cover).toBe("");
      expect(result.chapterList).toEqual(["m100"]);
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
});
