import { resolveReaderRedirect } from "@infra/services/background";
import { readFileSync } from "fs";
import { join } from "path";

const slug = "zhongjiedechitianshi-jiyingshe";
const readJSON = (path: string) =>
  JSON.parse(readFileSync(join(__dirname, "../../..", path), "utf8"));
const redirect = (url: string) =>
  resolveReaderRedirect(url, (path) => `chrome-extension://test/${path}`);

describe("Baozimh permissions and navigation", () => {
  it.each(["manifest.json", "manifest.dev.json"])(
    "covers the public sources and CDNs in %s",
    (file) => {
      const manifest = readJSON(`src/manifest/${file}`);
      expect(manifest.host_permissions).toEqual(
        expect.arrayContaining([
          "https://www.baozimh.com/*",
          "https://www.twmanga.com/*",
          "https://static-tw.baozimh.com/*",
          "https://*.bzcdn.net/*",
        ]),
      );
      expect(manifest.content_security_policy.extension_pages).not.toContain(
        "unsafe-eval",
      );
      expect(manifest.permissions).not.toContain("cookies");
      expect(manifest).not.toHaveProperty("content_scripts");
    },
  );

  it.each([
    `https://www.baozimh.com/user/page_direct?comic_id=${slug}&section_slot=0&chapter_slot=0`,
    `https://www.twmanga.com/user/page_direct?chapter_slot=0&section_slot=0&comic_id=${slug}`,
    `https://www.baozimh.com/comic/chapter/${slug}/0_0.html`,
    `https://www.twmanga.com/comic/chapter/${slug}/0_0_2.html?from=reader#bottom`,
  ])("routes %s to one canonical chapter", (url) => {
    const result = new URL(redirect(url));
    expect(result.searchParams.get("site")).toBe("baozimh");
    expect(result.searchParams.get("chapter")).toBe(
      `comic/chapter/${slug}/0_0.html`,
    );
  });

  it.each([
    `https://www.baozimh.com/comic/${slug}`,
    `https://www.baozimh.com/comic/chapter/${slug}/0_0.html?cs_open_native=1`,
    `https://www.twmanga.com/user/page_direct?comic_id=${slug}&section_slot=0&chapter_slot=0&cs_open_native=1`,
    `https://www.twmanga.com.evil.test/comic/chapter/${slug}/0_0.html`,
    `http://www.baozimh.com/comic/chapter/${slug}/0_0.html`,
    `https://www.baozimh.com/user/page_direct?comic_id=${slug}&chapter_slot=0`,
    `https://www.baozimh.com/user/page_direct?comic_id=${slug}&section_slot=0&chapter_slot=0&chapter_slot=1`,
    `https://www.twmanga.com/comic/chapter/${slug}/0_0_0.html`,
  ])(
    "keeps native bypass and unsupported URLs out of the reader: %s",
    (url) => {
      expect(redirect(url)).toBe("");
    },
  );

  it("leaves Baozimh and its CDN requests free of DNR header rewrites", () => {
    const rules = readJSON("public/rules.json");
    for (const url of [
      `https://www.twmanga.com/comic/chapter/${slug}/0_0.html`,
      `https://s1.bzcdn.net/scomic/${slug}/0/1-9ica/1.jpg`,
      `https://s2.bzcdn.net/scomic/demo/0/one/1.jpg`,
      `https://static-tw.baozimh.com/cover/${slug}.jpg`,
    ]) {
      expect(
        rules.some(
          (rule: {
            condition: { regexFilter?: string; urlFilter?: string };
          }) =>
            rule.condition.regexFilter
              ? new RegExp(rule.condition.regexFilter).test(url)
              : url.startsWith(
                  rule.condition.urlFilter?.replace(/^\|/, "") || "unsupported",
                ),
        ),
      ).toBe(false);
    }
  });
});
