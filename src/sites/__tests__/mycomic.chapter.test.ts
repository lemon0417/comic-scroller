import { readSiteFixture } from "../../testUtils/siteFixtures";
import { parseMyComicChapterPage } from "../mycomic/chapter";

const fixture = (id = "790421") =>
  readSiteFixture("mycomic", `chapter-${id}.html`);

describe("MyComic chapter parser", () => {
  const originalParser = globalThis.DOMParser;
  afterEach(() => {
    globalThis.DOMParser = originalParser;
  });
  it.each([
    ["790421", "1759", 17, "1-96801d.jpg", "17-6c46c6.jpg"],
    ["15296", "1759", 183, "1-41446e.jpg", "183-d0a53f.jpg"],
    ["818127", "31379", 8, "1-ad162a.jpg", "8-421c25.jpg"],
    ["423621", "31379", 12, "1-c238ca.jpg", "12-763b36.jpg"],
  ] as const)(
    "reads all images from chapter %s without DOM",
    (id, seriesID, count, first, last) => {
      (globalThis as any).DOMParser = undefined;
      const payload = parseMyComicChapterPage(fixture(id), `chapters/${id}`);
      expect(payload).toMatchObject({
        chapterID: `chapters/${id}`,
        seriesID,
        comicUrl: `https://mycomic.com/comics/${seriesID}`,
      });
      expect(payload.imgList).toHaveLength(count);
      expect(payload.imgList[0]).toEqual({
        chapter: `chapters/${id}`,
        src: `https://biccam.com/chapters/${id}/${first}`,
      });
      expect(payload.imgList[count - 1].src).toBe(
        `https://biccam.com/chapters/${id}/${last}`,
      );
      expect(
        payload.imgList.every((image) => image.chapter === `chapters/${id}`),
      ).toBe(true);
    },
  );

  it("ignores advertisements and script/comment image tags", () => {
    const extra =
      '<img src="https://evil.test/ad.jpg"><script><img class="page" x-ref="page-99" src="https://evil.test/fake.jpg"></script><!-- <img class="page" x-ref="page-98"> -->';
    expect(
      parseMyComicChapterPage(
        fixture().replace("</body>", extra + "</body>"),
        "chapters/790421",
      ),
    ).toEqual(parseMyComicChapterPage(fixture(), "chapters/790421"));
  });

  it("prefers the actual lazy source over a placeholder", () => {
    const html = fixture().replace(
      'data-src="https://biccam.com/chapters/790421/17-',
      'src="data:image/gif;base64,placeholder" data-src="https://biccam.com/chapters/790421/17-',
    );
    expect(
      parseMyComicChapterPage(html, "chapters/790421").imgList.at(-1)?.src,
    ).toBe("https://biccam.com/chapters/790421/17-6c46c6.jpg");
  });

  it.each([
    ["challenge", "<title>Just a moment...</title>"],
    ["wrong chapter", fixture().replaceAll("790421", "790422")],
    [
      "missing series identity",
      fixture().replaceAll(
        "https://mycomic.com/comics/1759",
        "https://mycomic.com/other/1759",
      ),
    ],
    [
      "missing images",
      fixture()
        .replaceAll('class="page ', 'class="other ')
        .replaceAll('class="lozad page ', 'class="lozad other '),
    ],
    [
      "missing last page",
      fixture().replace(/<img[^>]*x-ref="page-17"[^>]*>/, ""),
    ],
    ["gap", fixture().replace('x-ref="page-2"', 'x-ref="page-3"')],
    ["duplicate", fixture().replace('x-ref="page-2"', 'x-ref="page-1"')],
    [
      "wrong image host",
      fixture().replaceAll(
        "https://biccam.com/chapters/",
        "https://evil.test/chapters/",
      ),
    ],
    [
      "wrong chapter images",
      fixture().replaceAll(
        "biccam.com/chapters/790421/",
        "biccam.com/chapters/790422/",
      ),
    ],
    [
      "insecure image",
      fixture().replaceAll(
        "https://biccam.com/chapters/",
        "http://biccam.com/chapters/",
      ),
    ],
    [
      "image credentials",
      fixture().replaceAll(
        "https://biccam.com/chapters/",
        "https://user:pass@biccam.com/chapters/",
      ),
    ],
    ["oversized", "x".repeat(2 * 1024 * 1024 + 1)],
  ])("rejects %s", (_label, html) => {
    expect(() => parseMyComicChapterPage(html, "chapters/790421")).toThrow();
  });
});
