import {
  parseDm5ChapterPage,
  resolveDm5ImageUrl,
} from "@sites/dm5/chapter";

const PACKER_SAMPLE = String.raw`eval(function(p,a,c,k,e,d){e=function(c){return(c<a?"":e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29):c.toString(36))};if(!''.replace(/^/,String)){while(c--)d[e(c)]=k[c]||e(c);k=[function(e){return d[e]}];e=function(){return'\\w+'};c=1;};while(c--)if(k[c])p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c]);return p;}('b 5(){1 4=3;1 9=\\'8\\';1 7=\"g://f.h.e/a/c/3\";1 2=[\"/j.6\",\"/m.6\"];n(1 i=0;i<2.k;i++){2[i]=7+2[i]+\\'?4=3&9=8\\'}l 2}1 d;d=5();',24,24,'|var|pvalue|1753397|cid|dm5imagefun|jpg|pix|49370fd6fd0f05ca510c4a1a4d389230|key|85|function|84472||com|manhua1040zjcdn123|https|cdndm5||1_4253|length|return|2_8730|for'.split('|'),0,{}))`;

describe("dm5 parser helpers", () => {
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

  test("falls back to raw HTML parsing when DOM parsing omits chapter vars", () => {
    const originalDOMParser = globalThis.DOMParser;
    try {
      globalThis.DOMParser = class DOMParser {
        parseFromString() {
          return {
            documentElement: { textContent: "" },
            querySelector: () => null,
          } as unknown as Document;
        }
      } as typeof DOMParser;

      const html = `
        <div class="title"><span></span><span><a href="/manhua-fallback/">Fallback</a></span></div>
        <input id="dm5_key" value="fallback-key" />
        <script>
          var DM5_IMAGE_COUNT = 1;
          var DM5_CID = "1753397";
          var DM5_CURL = "/manhua-fallback/";
          var DM5_MID = "12345";
          var DM5_VIEWSIGN_DT = "2026-04-04 12:34:56";
          var DM5_VIEWSIGN = "signed";
        </script>
      `;

      expect(parseDm5ChapterPage(html, "m1753397")).toEqual({
        chapterID: "m1753397",
        seriesSlug: "manhua-fallback",
        imgList: [
          expect.objectContaining({
            chapter: "m1753397",
            cid: "1753397",
            key: "fallback-key",
            src: expect.stringContaining(
              "https://www.dm5.com/manhua-fallback/chapterfun.ashx?cid=1753397&page=1",
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
});
