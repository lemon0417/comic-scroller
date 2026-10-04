import { readSiteFixture } from "../../testUtils/siteFixtures";
import { parseEightComicChapter } from "../8comic/chapter";
import { parseEightComicChapterID } from "../8comic/url";

const fixture = (id = "105", chapter = "420") =>
  readSiteFixture("8comic", `chapter-${id}-${chapter}.html`);

function mutateTable(html: string, change: (packed: string) => string) {
  return html.replace(
    /(var [\w$]+=')([a-zA-Z0-9]{1000,})(';)/,
    (_all, prefix, packed, suffix) => prefix + change(packed) + suffix,
  );
}

describe("8comic image table", () => {
  it.each([
    [
      "105",
      "420",
      16,
      "https://img9.8comic.com/3/105/420/001_S4B.jpg",
      "https://img9.8comic.com/3/105/420/016_X7A.jpg",
    ],
    [
      "1551",
      "704",
      60,
      "https://img9.8comic.com/4/1551/704/001_9pp.jpg",
      "https://img9.8comic.com/4/1551/704/060_mFN.jpg",
    ],
    [
      "105",
      "1",
      93,
      "https://img9.8comic.com/4/105/1/001_2b4.jpg",
      "https://img9.8comic.com/4/105/1/093_F28.jpg",
    ],
    [
      "1551",
      "1",
      205,
      "https://img7.8comic.com/4/1551/1/001_9A9.jpg",
      "https://img7.8comic.com/4/1551/1/205_Qfu.jpg",
    ],
  ])(
    "decodes series %s chapter %s from its actual image table",
    (id, chapter, pages, first, last) => {
      const chapterID = `online/new-${id}.html?ch=${chapter}`;
      const result = parseEightComicChapter(
        fixture(id, id === "105" ? "420" : "704"),
        chapterID,
      );
      expect(result).toMatchObject({
        chapterID,
        seriesID: id,
        comicUrl: `https://www.8comic.com/html/${id}.html`,
      });
      expect(result.imgList).toHaveLength(pages);
      expect(result.imgList[0]).toEqual({ chapter: chapterID, src: first });
      expect(result.imgList.at(-1)?.src).toBe(last);
      expect(new Set(result.imgList.map((image) => image.src)).size).toBe(
        pages,
      );
      expect(
        result.imgList.every(
          (image) =>
            image.chapter === chapterID &&
            /^https:\/\/img[1-9]\.8comic\.com\//.test(image.src),
        ),
      ).toBe(true);
    },
  );

  it("identifies renamed variables without running scripts", () => {
    let html = fixture();
    const identifiers = [
      "y_i2bwf8ok",
      "j122y5mvx0",
      "amvx0xp",
      "h71de4122",
      "rpc08u_l",
      "p_lm5up",
      "c16du3v",
      "kf8okkc9_4",
      "pxqud41",
      "fc9_443i",
      "a4ornno",
    ];
    identifiers.forEach((name, index) => {
      html = html.replace(new RegExp(`\\b${name}\\b`, "g"), `renamed_${index}`);
    });
    (globalThis as any).__eightComicExecuted = false;
    html = html.replace(
      "<script>",
      "<script>globalThis.__eightComicExecuted = true;",
    );
    expect(
      parseEightComicChapter(html, "online/new-105.html?ch=420").imgList[0].src,
    ).toBe("https://img9.8comic.com/3/105/420/001_S4B.jpg");
    expect((globalThis as any).__eightComicExecuted).toBe(false);
    delete (globalThis as any).__eightComicExecuted;
  });

  it("normalizes page suffixes and handles split chapter parts", () => {
    expect(
      parseEightComicChapterID("online/new-1551.html?ch=704a-2"),
    ).toMatchObject({ chapterID: "online/new-1551.html?ch=704a", part: "a" });
    const changed = mutateTable(
      fixture(),
      (packed) => packed.slice(0, 191 * 47 + 46) + "a" + packed.slice(192 * 47),
    );
    const result = parseEightComicChapter(
      changed,
      "online/new-105.html?ch=420a-2",
    );
    expect(result.imgList[0]).toEqual({
      chapter: "online/new-105.html?ch=420a",
      src: "https://img9.8comic.com/3/105/420a/001_S4B.jpg",
    });
    expect(() =>
      parseEightComicChapter(changed, "online/new-105.html?ch=420b"),
    ).toThrow("not found");
  });

  it("does not fall back to another chapter when the requested chapter is absent", () => {
    expect(() =>
      parseEightComicChapter(fixture(), "online/new-105.html?ch=999"),
    ).toThrow("not found");
    expect(() =>
      parseEightComicChapter(fixture(), "online/new-1551.html?ch=420"),
    ).toThrow("identity mismatch");
  });

  it("decodes the site's Z prefix for chapter numbers above 8000", () => {
    const changed = mutateTable(
      fixture(),
      (packed) =>
        packed.slice(0, 191 * 47 + 4) + "Za" + packed.slice(191 * 47 + 6),
    );
    expect(
      parseEightComicChapter(changed, "online/new-105.html?ch=8000").imgList[0]
        .src,
    ).toBe("https://img9.8comic.com/3/105/8000/001_S4B.jpg");
  });

  it.each([
    "online/new-105.html?ch=0",
    "online/new-105.html?ch=420A",
    "online/new-105.html?ch=420&foo=1",
    "view/105.html?ch=420",
    "https://evil.test/online/new-105.html?ch=420",
  ])("rejects unsupported chapter identity %s", (id) => {
    expect(() => parseEightComicChapter(fixture(), id)).toThrow(
      "Invalid 8comic chapter ID",
    );
  });

  it.each([
    ["missing data", "<html>Denied</html>"],
    [
      "unsupported substring helper",
      fixture().replace("m1igq9=40", "m1igq9=39"),
    ],
    ["oversized response", "x".repeat(2 * 1024 * 1024 + 1)],
    ["record count", fixture().replace("i<192;", "i<193;")],
    [
      "unsupported stride",
      fixture().replace("var c16du3v=49;", "var c16du3v=50;"),
    ],
    ["arbitrary expressions", fixture().replace("c16du3v-2", "evil()")],
    [
      "overlapping columns",
      fixture().replace("pxqud41+1)+4,2", "pxqud41+1)+2,2"),
    ],
    [
      "unsupported image host",
      mutateTable(
        fixture(),
        (packed) => packed.slice(0, -71) + "626164" + packed.slice(-65),
      ),
    ],
    [
      "invalid server",
      mutateTable(
        fixture(),
        (packed) =>
          packed.slice(0, 191 * 47) + "aa" + packed.slice(191 * 47 + 2),
      ),
    ],
    [
      "zero pages",
      mutateTable(
        fixture(),
        (packed) =>
          packed.slice(0, 191 * 47 + 2) + "aa" + packed.slice(191 * 47 + 4),
      ),
    ],
    [
      "invalid part",
      mutateTable(
        fixture(),
        (packed) =>
          packed.slice(0, 191 * 47 + 46) + "1" + packed.slice(192 * 47),
      ),
    ],
    ["truncated table", mutateTable(fixture(), (packed) => packed.slice(1))],
  ])("rejects %s", (_label, html) => {
    expect(() =>
      parseEightComicChapter(html, "online/new-105.html?ch=420"),
    ).toThrow();
  });
});
