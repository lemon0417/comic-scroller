import { parseManhuaguiChapter } from "@sites/manhuagui/chapter";
import { compressToBase64 } from "lz-string";

import { readSiteFixture } from "../../testUtils/siteFixtures";

const fixture = (id: string) =>
  readSiteFixture("manhuagui", `${id}.chapter.html`);

// Synthetic data uses the site's observed compressed dictionary/packer contract.
function packJSON(data: unknown) {
  const dictionary = compressToBase64("unused");
  return `return p;}('${JSON.stringify(`SMH.imgData(${JSON.stringify(data)}).preInit();`).slice(1, -1)}',62,1,'${dictionary}'['splic']('|'),0,{})`;
}

function validData(overrides: Record<string, unknown> = {}) {
  return {
    bid: 49169,
    cid: 910633,
    path: "/ps4/第182话/",
    files: ["001.jpg.webp"],
    len: 1,
    sl: { e: 1792067828, m: "signature" },
    ...overrides,
  };
}

describe("Manhuagui image parser", () => {
  it("preserves encoded non-ASCII paths and exact signature query values", () => {
    const output = parseManhuaguiChapter(
      packJSON(validData()),
      "comic/49169/910633.html",
    );
    const url = new URL(output.imgList[0].src);
    expect(decodeURIComponent(url.pathname)).toBe("/ps4/第182话/001.jpg.webp");
    expect(url.search).toBe("?e=1792067828&m=signature");
  });
  it.each([
    ["49169", "910633", 18, "0001.jpg.webp", "0018.jpg.webp"],
    ["28004", "844724", 196, "001.jpg.webp", "196.jpg.webp"],
  ])(
    "decodes actual %s packed data and signed image URLs without executing the page",
    (series, chapter, pages, first, last) => {
      const output = parseManhuaguiChapter(
        fixture(chapter),
        `comic/${series}/${chapter}.html`,
      );
      expect(output.seriesID).toBe(series);
      expect(output.comicUrl).toBe(
        `https://www.manhuagui.com/comic/${series}/`,
      );
      expect(output.imgList).toHaveLength(pages);
      expect(new URL(output.imgList[0].src).hostname).toBe("i.hamreus.com");
      expect(new URL(output.imgList[0].src).pathname).toContain(first);
      expect(new URL(output.imgList.at(-1)!.src).pathname).toContain(last);
      expect(new URL(output.imgList[0].src).searchParams.get("m")).toBeTruthy();
      expect(
        output.imgList.every((image) => image.chapter === output.chapterID),
      ).toBe(true);
    },
  );

  it("validates chapter identity instead of accepting a different series or chapter", () => {
    expect(() =>
      parseManhuaguiChapter(fixture("910633"), "comic/28004/910633.html"),
    ).toThrow("identity mismatch");
    expect(() =>
      parseManhuaguiChapter(fixture("910633"), "comic/49169/1.html"),
    ).toThrow("identity mismatch");
  });

  it.each([
    { files: [] },
    { len: 2 },
    { path: "//evil.test/path/" },
    { files: ["../image.jpg"] },
    { files: ["https://evil.test/001.jpg"] },
    { sl: null },
    { sl: { e: 0, m: "key" } },
  ])("rejects unusable image data (%#)", (overrides) => {
    expect(() =>
      parseManhuaguiChapter(
        packJSON(validData(overrides)),
        "comic/49169/910633.html",
      ),
    ).toThrow();
  });

  it("does not execute unrelated page scripts or mutate String.prototype", () => {
    const prototype = Object.getOwnPropertyNames(String.prototype);
    const html = `<script>throw new Error('must never execute'); String.prototype.splice = 1;</script>${fixture("910633")}`;
    expect(
      parseManhuaguiChapter(html, "comic/49169/910633.html").imgList,
    ).toHaveLength(18);
    expect(Object.getOwnPropertyNames(String.prototype)).toEqual(prototype);
  });

  it("rejects an executable expression in place of image JSON", () => {
    const source = packJSON(validData()).replace(
      '\\"bid\\":49169',
      '\\"bid\\":(globalThis.injected = true)',
    );
    expect(() =>
      parseManhuaguiChapter(source, "comic/49169/910633.html"),
    ).toThrow();
    expect((globalThis as any).injected).toBeUndefined();
  });

  it("rejects unknown or damaged dictionary formats", () => {
    expect(() =>
      parseManhuaguiChapter("<html>blocked</html>", "comic/49169/910633.html"),
    ).toThrow("packed image data");
    const broken = fixture("910633").replace("',57,57,", "',57,56,");
    expect(() =>
      parseManhuaguiChapter(broken, "comic/49169/910633.html"),
    ).toThrow("dictionary");
  });
});
