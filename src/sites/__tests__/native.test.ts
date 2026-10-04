import { resolveReaderRedirect } from "@infra/services/background";

import { getNativeChapterURL } from "../registry";

describe("shared native chapter links", () => {
  it.each([
    ["dm5", "m462489", "https://www.dm5.com/m462489/?cs_open_native=1"],
    [
      "8comic",
      "online/new-105.html?ch=420",
      "https://articles.onemoreplace.tw/online/new-105.html?ch=420&cs_open_native=1",
    ],
    [
      "manhuagui",
      "comic/49169/910633.html",
      "https://www.manhuagui.com/comic/49169/910633.html?cs_open_native=1",
    ],
    [
      "baozimh",
      "comic/chapter/demo/0_0_2.html",
      "https://www.twmanga.com/comic/chapter/demo/0_0.html?cs_open_native=1",
    ],
    [
      "mycomic",
      "chapters/790421",
      "https://mycomic.com/chapters/790421?cs_open_native=1",
    ],
  ])(
    "builds a valid %s native link without a redirect loop",
    (site, chapter, url) => {
      const href = getNativeChapterURL(site, chapter);
      expect(href).toBe(url);
      expect(resolveReaderRedirect(href)).toBe("");
    },
  );
  it.each([
    ["unknown", "chapters/1"],
    ["constructor", "chapters/1"],
    ["mycomic", "chapters/1?url=https://evil.test"],
    ["mycomic", ""],
    ["dm5", "https://evil.test"],
    ["8comic", "online/new-105.html?ch=0"],
    ["manhuagui", "comic/../1.html"],
    ["baozimh", "comic/chapter/demo/0_0_0.html"],
  ])("hides links for invalid %s chapter %s", (site, chapter) => {
    expect(getNativeChapterURL(site, chapter)).toBe("");
  });
});
