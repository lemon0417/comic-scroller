import { readFileSync } from "fs";
import { join } from "path";

const readJSON = (path: string) =>
  JSON.parse(readFileSync(join(__dirname, "../../..", path), "utf8"));

describe("8comic request permissions", () => {
  it.each(["manifest.json", "manifest.dev.json"])(
    "covers series, covers, images and the public reader in %s",
    (file) => {
      const manifest = readJSON(`src/manifest/${file}`);
      expect(manifest.host_permissions).toEqual(
        expect.arrayContaining([
          "https://*.8comic.com/*",
          "https://articles.onemoreplace.tw/*",
        ]),
      );
      expect(
        manifest.host_permissions.some((host: string) =>
          host.includes("comicbus"),
        ),
      ).toBe(false);
      expect(manifest.content_security_policy.extension_pages).not.toContain(
        "unsafe-eval",
      );
    },
  );

  it("sets the public reader Referer for fetch and native bypass without changing image headers", () => {
    const rules = readJSON("public/rules.json");
    const rule = rules.find((entry: { id: number }) => entry.id === 8);
    expect(rule.action.requestHeaders).toEqual([
      { header: "Referer", operation: "set", value: "https://www.8comic.com/" },
    ]);
    expect(rule.condition.resourceTypes).toEqual([
      "main_frame",
      "xmlhttprequest",
    ]);
    const filter = new RegExp(rule.condition.regexFilter);
    expect(
      filter.test(
        "https://articles.onemoreplace.tw/online/new-105.html?ch=420&cs_open_native=1",
      ),
    ).toBe(true);
    expect(
      filter.test(
        "https://articles.onemoreplace.tw/online/new-1551.html?ch=704",
      ),
    ).toBe(true);
    for (const url of [
      "https://www.8comic.com/view/105.html?ch=420",
      "https://img9.8comic.com/3/105/420/001_S4B.jpg",
      "https://articles.onemoreplace.tw.evil.test/online/new-105.html?ch=420",
      "https://articles.onemoreplace.tw/online/new-105.html.evil?ch=420",
    ]) {
      expect(filter.test(url)).toBe(false);
    }
  });
});
