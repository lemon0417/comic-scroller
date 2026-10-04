import { resolveReaderRedirect } from "@infra/services/background";
import { readFileSync } from "fs";
import { join } from "path";

const readJSON = (path: string) =>
  JSON.parse(readFileSync(join(__dirname, "../../..", path), "utf8"));
const redirect = (url: string) =>
  resolveReaderRedirect(url, (path) => `chrome-extension://test/${path}`);
describe("MyComic permissions and navigation", () => {
  it.each(["manifest.json", "manifest.dev.json"])(
    "covers only the site and observed CDN in %s",
    (file) => {
      const manifest = readJSON(`src/manifest/${file}`);
      expect(manifest.host_permissions).toEqual(
        expect.arrayContaining([
          "https://mycomic.com/*",
          "https://biccam.com/*",
        ]),
      );
      expect(manifest.permissions).not.toContain("cookies");
      expect(manifest).not.toHaveProperty("content_scripts");
      expect(manifest.content_security_policy.extension_pages).not.toContain(
        "unsafe-eval",
      );
    },
  );
  it.each([
    "https://mycomic.com/chapters/790421",
    "https://mycomic.com/cn/chapters/790421/?from=reader#page2",
  ])("canonicalizes the reader entrance: %s", (url) => {
    const result = new URL(redirect(url));
    expect(result.searchParams.get("site")).toBe("mycomic");
    expect(result.searchParams.get("chapter")).toBe("chapters/790421");
  });
  it.each([
    "https://mycomic.com/comics/1759",
    "https://mycomic.com/cn/comics/31379",
    "https://mycomic.com/chapters/790421?cs_open_native=1",
    "http://mycomic.com/chapters/790421",
    "https://mycomic.com.evil.test/chapters/790421",
    "https://user:pass@mycomic.com/chapters/790421",
    "https://mycomic.com/chapters/0",
    "https://mycomic.com/chapters/790421/extra",
  ])(
    "keeps native bypass and unsupported URLs out of the reader: %s",
    (url) => {
      expect(redirect(url)).toBe("");
    },
  );
  it("sets Referer only for observed image and cover requests", () => {
    const rules = readJSON("public/rules.json");
    const rule = rules.find((rule: any) =>
      rule.condition.requestDomains?.includes("biccam.com"),
    );
    expect(rule).toMatchObject({
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          {
            header: "Referer",
            operation: "set",
            value: "https://mycomic.com/",
          },
        ],
      },
      condition: {
        urlFilter: "|https://biccam.com/",
        requestDomains: ["biccam.com"],
        resourceTypes: ["image", "xmlhttprequest"],
      },
    });
    expect(new Set(rules.map((rule: any) => rule.id)).size).toBe(rules.length);
    expect(rule.condition.requestDomains).not.toContain("mycomic.com");
  });
});
