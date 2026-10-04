import { parseDm5ChapterPage, resolveDm5ImageUrl } from "@sites/dm5/chapter";

import { readSiteFixture } from "../../testUtils/siteFixtures";

const PACKER_SAMPLE = readSiteFixture("dm5", "m1753397.page-1.js");

const EMPTY_CHAPTERFUN_KEY_PACKER_SAMPLE = readSiteFixture(
  "dm5",
  "m1794602.page-1.js",
);

describe("dm5 parser helpers", () => {
  test("parses captured free chapter and resolves its captured first-page response", () => {
    const chapter = parseDm5ChapterPage(
      readSiteFixture("dm5", "m1768478.chapter.html"),
      "m1768478",
    );
    expect(chapter.chapterID).toBe("m1768478");
    expect(chapter.seriesSlug).toBe("manhua-dianjuren");
    expect(chapter.imgList).toHaveLength(30);
    const first = chapter.imgList[0];
    expect(first.key).toBe("");
    const request = new URL(first.src);
    expect(request.pathname).toBe("/m1768478/chapterfun.ashx");
    expect(request.searchParams.get("key")).toBe("");
    expect(request.searchParams.get("page")).toBe("1");
    expect(request.searchParams.get("_mid")).toBe("46568");
    expect(new URL(chapter.imgList[29].src).searchParams.get("page")).toBe(
      "30",
    );
    expect(
      resolveDm5ImageUrl(readSiteFixture("dm5", "m1768478.page-1.js"), first),
    ).toBe(
      "https://manhua1040zjcdn63.cdndm5.com/47/46568/1768478/1_2322.jpg?cid=1768478&key=228f25b9fb27a9418f4a919e2f010a37",
    );
  });

  test("parses captured VIP chapter into a native-reader paywall link", () => {
    expect(
      parseDm5ChapterPage(
        readSiteFixture("dm5", "m462489.chapter.html"),
        "m462489",
      ),
    ).toEqual({
      chapterID: "m462489",
      seriesSlug: "manhua-bailianchengshen",
      imgList: [
        {
          chapter: "m462489",
          cid: "462489",
          key: "",
          src: "",
          href: "https://www.dm5.com/m462489/?cs_open_native=1",
          type: "paywall",
        },
      ],
    });
  });

  test("parses chapter page metadata and chapterfun entries", () => {
    const html = `
      <html>
        <body>
          <div class="title"><span></span><span><a href="/manhua-demo/">Demo</a></span></div>
          <input id="dm5_key" value="fallback-key" />
          <script>
            var DM5_IMAGE_COUNT = 2;
            var DM5_CID = "1753397";
            var DM5_CURL = "/manhua-demo/";
            var DM5_MID = "12345";
            var DM5_VIEWSIGN_DT = "2026-04-04 12:34:56";
            var DM5_VIEWSIGN = "signed";
          </script>
        </body>
      </html>
    `;

    expect(parseDm5ChapterPage(html, "m1753397")).toEqual({
      chapterID: "m1753397",
      seriesSlug: "manhua-demo",
      imgList: [
        {
          chapter: "m1753397",
          cid: "1753397",
          key: "fallback-key",
          src:
            "https://www.dm5.com/manhua-demo/chapterfun.ashx?cid=1753397" +
            "&page=1&key=&language=1&gtk=6&_cid=1753397&_mid=12345" +
            "&_dt=2026-04-04+12%3A34%3A56&_sign=signed",
        },
        {
          chapter: "m1753397",
          cid: "1753397",
          key: "fallback-key",
          src:
            "https://www.dm5.com/manhua-demo/chapterfun.ashx?cid=1753397" +
            "&page=2&key=&language=1&gtk=6&_cid=1753397&_mid=12345" +
            "&_dt=2026-04-04+12%3A34%3A56&_sign=signed",
        },
      ],
    });
  });

  test("resolves image url with query", () => {
    const resolved = resolveDm5ImageUrl(PACKER_SAMPLE, {
      cid: "1753397",
      key: "49370fd6fd0f05ca510c4a1a4d389230",
    });
    expect(resolved).toBe(
      "https://manhua1040zjcdn123.cdndm5.com/85/84472/1753397/1_4253.jpg?cid=1753397&key=49370fd6fd0f05ca510c4a1a4d389230",
    );
  });

  test("falls back to entity key when script omits query", () => {
    const responseText =
      "var d=['/1_4253.jpg']; var base='https://example.com/85/84472/1753397';";
    const resolved = resolveDm5ImageUrl(responseText, {
      cid: "1753397",
      key: "deadbeef",
    });
    expect(resolved).toBe(
      "https://example.com/85/84472/1753397/1_4253.jpg?cid=1753397&key=deadbeef",
    );
  });

  test("prefers the named HD image schema", () => {
    const responseText =
      "var hd_c=['/hd.jpg']; var d=['/standard.jpg']; " +
      "var pix='https://example.com/85/84472/1753397';";
    const resolved = resolveDm5ImageUrl(responseText, {
      cid: "1753397",
      key: "deadbeef",
    });

    expect(resolved).toBe(
      "https://example.com/85/84472/1753397/hd.jpg?cid=1753397&key=deadbeef",
    );
  });

  test("rejects unrecognized image response shapes", () => {
    const responseText =
      "var images=['/guessed.jpg']; " +
      "var source='https://example.com/85/84472/1753397/direct.jpg';";

    expect(
      resolveDm5ImageUrl(responseText, {
        cid: "1753397",
        key: "deadbeef",
      }),
    ).toBe("");
  });

  test("keeps chapterfun key empty and uses the response image key", () => {
    const html = `
      <html>
        <body>
          <div class="title">
            <a href="/">首页</a>
            <span class="right-arrow"><a href="/manhua-shishenyongzheyuanshaji/">失神勇者与暗杀姬</a></span>
            <span class="active right-arrow">第143话</span>
          </div>
          <input id="dm5_key" value="" />
          <script>
            var DM5_CURL = "/m1794602/";
            var DM5_MID = 89730;
            var DM5_CID = 1794602;
            var DM5_IMAGE_COUNT = 20;
            var DM5_VIEWSIGN = "c4bbea910f23dbec0a3468030a68f15d";
            var DM5_VIEWSIGN_DT = "2026-07-14 16:02:59";
          </script>
        </body>
      </html>
    `;

    const chapter = parseDm5ChapterPage(html, "m1794602");
    const firstImage = chapter.imgList[0];
    const chapterfunUrl = new URL(firstImage.src);

    expect(chapter.seriesSlug).toBe("manhua-shishenyongzheyuanshaji");
    expect(firstImage.key).toBe("");
    expect(chapterfunUrl.pathname).toBe("/m1794602/chapterfun.ashx");
    expect(chapterfunUrl.searchParams.get("key")).toBe("");
    expect(
      resolveDm5ImageUrl(EMPTY_CHAPTERFUN_KEY_PACKER_SAMPLE, firstImage),
    ).toBe(
      "https://manhua1041zjcdn79.cdndm5.com/90/89730/1794602/1_7884.jpg?cid=1794602&key=9513d9f1ca59042e184ba6c2334ea1e0",
    );
  });

  test("rejects a chapter route as the series slug", () => {
    const html = `
      <div class="title"><a href="/">首页</a></div>
      <script>
        var DM5_CURL = "/m1794602/";
        var DM5_MID = 89730;
        var DM5_CID = 1794602;
        var DM5_IMAGE_COUNT = 20;
        var DM5_VIEWSIGN = "signed";
        var DM5_VIEWSIGN_DT = "2026-07-15 00:13:27";
      </script>
    `;

    expect(() => parseDm5ChapterPage(html, "m1794602")).toThrow(
      "Unable to parse DM5 chapter metadata for m1794602.",
    );
  });

  test("parses chapter metadata without using DOMParser", () => {
    const originalDOMParser = globalThis.DOMParser;
    try {
      globalThis.DOMParser = class DOMParser {
        parseFromString(): Document {
          throw new Error("DOMParser should not be used");
        }
      } as typeof DOMParser;

      const html = `
        <div class='chapter title'><span></span><span><a href='/manhua-string-parser/'>String parser</a></span></div>
        <input id='dm5_key' value='fallback-key' />
        <script>
          var DM5_IMAGE_COUNT = 1;
          var DM5_CID = '1753397';
          var DM5_CURL = '/m1753397/';
          var DM5_MID = 12345;
          var DM5_VIEWSIGN_DT = '2026-04-04 12:34:56';
          var DM5_VIEWSIGN = 'signed';
        </script>
      `;

      expect(parseDm5ChapterPage(html, "m1753397")).toEqual({
        chapterID: "m1753397",
        seriesSlug: "manhua-string-parser",
        imgList: [
          expect.objectContaining({
            chapter: "m1753397",
            cid: "1753397",
            key: "fallback-key",
            src: expect.stringContaining(
              "https://www.dm5.com/m1753397/chapterfun.ashx?cid=1753397&page=1",
            ),
          }),
        ],
      });
    } finally {
      globalThis.DOMParser = originalDOMParser;
    }
  });

  test("parses a paywalled chapter into a paywall placeholder", () => {
    const html = `
      <html>
        <body>
          <div class="title"><span></span><span><a href="/manhua-paid/">Paid</a></span></div>
          <script>
            var DM5_CID = 1655813;
            var DM5_MID = 20802;
          </script>
          <a href="javascript:void(0)" class="view-pay-btn" id="view-chapterpay-btn" cid="1655813" mid="20802">购买本章</a>
        </body>
      </html>
    `;

    expect(parseDm5ChapterPage(html, "m1655813")).toEqual({
      chapterID: "m1655813",
      seriesSlug: "manhua-paid",
      imgList: [
        {
          chapter: "m1655813",
          cid: "1655813",
          href: "https://www.dm5.com/m1655813/?cs_open_native=1",
          key: "",
          src: "",
          type: "paywall",
        },
      ],
    });
  });

  test("throws when the DM5 chapter parser cannot produce a usable payload", () => {
    expect(() =>
      parseDm5ChapterPage(
        "<html><body><div>broken</div></body></html>",
        "m404",
      ),
    ).toThrow("Unable to parse DM5 chapter metadata for m404.");
  });
});
