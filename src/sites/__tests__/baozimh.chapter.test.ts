import { readSiteFixture } from "../../testUtils/siteFixtures";
import { parseBaozimhChapterPage } from "../baozimh/chapter";
import { parseBaozimhChapterID, parseBaozimhChapterURL } from "../baozimh/url";

const first = "zhongjiedechitianshi-jiyingshe";
const second = "yongfenshenzidongshouxi-mongseekmrchaopal";
const fixture = (slug = first, part = "0_0") =>
  readSiteFixture("baozimh", `chapter-${slug}-${part}.html`);

describe("Baozimh chapter pages", () => {
  it.each([
    [first, "0_0", 50, 2, "0_0_2", "s1", "1-9ica", 1, 50],
    [first, "0_0_2", 34, 2, null, "s1", "1-9ica", 47, 80],
    [second, "0_175", 50, 3, "0_175_2", "s2", "176-5qzk", 1, 50],
    [second, "0_175_2", 54, 3, "0_175_3", "s2", "176-5qzk", 47, 100],
    [second, "0_175_3", 35, 3, null, "s2", "176-5qzk", 97, 131],
    [second, "0_0", 40, 1, null, "s1", "0-e9xk", 1, 40],
  ] as const)(
    "parses %s page %s and ignores noscript duplicates",
    (
      slug,
      part,
      count,
      totalPages,
      next,
      server,
      folder,
      firstPage,
      lastPage,
    ) => {
      const pageID = `comic/chapter/${slug}/${part}.html`;
      const result = parseBaozimhChapterPage(fixture(slug, part), pageID);
      const chapter = `comic/chapter/${slug}/${part.split("_").slice(0, 2).join("_")}.html`;
      expect(result.totalPages).toBe(totalPages);
      expect(result.nextPageID).toBe(
        next ? `comic/chapter/${slug}/${next}.html` : undefined,
      );
      expect(result.imgList).toHaveLength(count);
      expect(result.imgList[0]).toEqual({
        chapter,
        src: `https://${server}.bzcdn.net/scomic/${slug}/0/${folder}/${firstPage}.jpg`,
      });
      expect(result.imgList.at(-1)?.src).toBe(
        `https://${server}.bzcdn.net/scomic/${slug}/0/${folder}/${lastPage}.jpg`,
      );
    },
  );

  it("ignores advertisements, recommendations and script content", () => {
    const ad = '<amp-img id="ad-img" src="https://evil.test/ad.jpg"></amp-img>';
    const script = `<script><amp-img id="chapter-img-99-0" src="https://evil.test/evil.jpg"></amp-img></script>`;
    const result = parseBaozimhChapterPage(
      fixture().replace("</body>", `${ad}${script}</body>`),
      `comic/chapter/${first}/0_0.html`,
    );
    expect(result.imgList).toHaveLength(50);
  });

  it.each([
    ["missing next page", fixture().replace(/下一頁/g, "Continue")],
    ["page loop", fixture().replace(/0_0_2\.html/g, "0_0.html")],
    ["skipped page", fixture().replace(/0_0_2\.html/g, "0_0_3.html")],
    ["next chapter", fixture().replace(/0_0_2\.html/g, "0_1_2.html")],
    [
      "cross-origin next page",
      fixture().replace(
        /https:\/\/www.twmanga.com\/comic\/chapter/g,
        "https://evil.test/comic/chapter",
      ),
    ],
    [
      "wrong series",
      fixture().replace(
        `href="https://www.baozimh.com/comic/${first}"`,
        'href="https://www.baozimh.com/comic/other-series"',
      ),
    ],
    [
      "untrusted images",
      fixture().replace(/s1.bzcdn.net/g, "s1.bzcdn.net.evil.test"),
    ],
    [
      "insecure images",
      fixture().replace(/https:\/\/s1.bzcdn.net/g, "http://s1.bzcdn.net"),
    ],
    [
      "different series images",
      fixture().replace(
        /\/scomic\/zhongjiedechitianshi-jiyingshe/g,
        "/scomic/other-series",
      ),
    ],
    ["no chapter images", fixture().replace(/chapter-img-/g, "ad-img-")],
    ["invalid pagination", fixture().replace("(1/2)", "(2/2)")],
    ["too many pages", fixture().replace("(1/2)", "(1/101)")],
    ["challenge page", "<html>正在验证浏览器</html>"],
  ])("rejects %s instead of publishing a partial chapter", (_label, html) => {
    expect(() =>
      parseBaozimhChapterPage(html, `comic/chapter/${first}/0_0.html`),
    ).toThrow();
  });

  it("normalizes direct entrances and multipart URLs into the same chapter identity", () => {
    expect(
      parseBaozimhChapterURL(
        `https://www.baozimh.com/user/page_direct?chapter_slot=175&comic_id=${second}&section_slot=0`,
      ),
    ).toMatchObject({
      chapterID: `comic/chapter/${second}/0_175.html`,
      sectionSlot: "0",
      chapterSlot: "175",
    });
    expect(
      parseBaozimhChapterURL(
        `https://www.twmanga.com/comic/chapter/${second}/0_175_3.html?from=reader#bottom`,
      ),
    ).toMatchObject({
      chapterID: `comic/chapter/${second}/0_175.html`,
      page: 3,
    });
  });

  it.each([
    `https://www.baozimh.com.evil.test/comic/chapter/${first}/0_0.html`,
    `http://www.twmanga.com/comic/chapter/${first}/0_0.html`,
    `https://user:pass@www.twmanga.com/comic/chapter/${first}/0_0.html`,
    `https://www.baozimh.com/user/page_direct?comic_id=${first}&section_slot=0&chapter_slot=0&chapter_slot=1`,
    `https://www.baozimh.com/user/page_direct?comic_id=${first}&chapter_slot=0`,
  ])("rejects unsupported entrance %s", (url) => {
    expect(() => parseBaozimhChapterURL(url)).toThrow();
  });

  it.each([
    `comic/chapter/${first}/0_0_0.html`,
    `comic/chapter/${first}/0_01.html`,
    "comic/chapter/../0_0.html",
    "https://evil.test/chapter",
  ])("rejects invalid chapter identity %s", (id) => {
    expect(() => parseBaozimhChapterID(id)).toThrow();
  });
});
