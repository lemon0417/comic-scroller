import { firstValueFrom } from "rxjs";
import { fetchMeta$ } from "@sites/dm5/meta";

describe("dm5 fetchMeta$", () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
