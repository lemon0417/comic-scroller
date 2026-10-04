import {
  parseDm5CoverMeta,
  parseDm5LegacyMeta,
  parseDm5RssMetaStrict,
} from "@sites/dm5/metaParser";

import { readSiteFixture } from "../../testUtils/siteFixtures";

const samples = [
  {
    slug: "dianjuren",
    title: "电锯人",
    cover: "https://mhfm6tw.cdndm5.com/47/46568/20190708225456_450x600_101.jpg",
    rssChapterIDs: ["m1768478", "m1764103", "m1300155"],
    htmlChapterIDs: ["m1768478", "m1764103", "m1300155"],
    titles: ["第232话", "第231话", "第1卷"],
  },
  {
    slug: "bailianchengshen",
    title: "百炼成神",
    cover: "https://mhfm6tw.cdndm5.com/21/20802/20191227112603_450x600_111.jpg",
    rssChapterIDs: ["m1659652", "m462489", "m225202"],
    htmlChapterIDs: ["m225202", "m462489", "m1659652"],
    titles: ["第1293回 新生", "第81回 先声夺人", "第1回 炼器功法（上）"],
  },
];

describe("dm5 metadata parsers", () => {
  it.each(samples)("parses captured $slug RSS in source order", (sample) => {
    const meta = parseDm5RssMetaStrict(
      readSiteFixture("dm5", `${sample.slug}.rss.xml`),
    );
    expect(meta).toEqual({
      title: sample.title,
      chapterList: sample.rssChapterIDs,
      chapters: Object.fromEntries(
        sample.rssChapterIDs.map((id, index) => [
          id,
          { title: sample.titles[index], href: `https://www.dm5.com/${id}/` },
        ]),
      ),
    });
  });

  describe.each([true, false])("captured HTML with DOMParser=%s", (useDOM) => {
    it.each(samples)("parses $slug cover and fallback chapters", (sample) => {
      const originalParser = globalThis.DOMParser;
      if (!useDOM) (globalThis as any).DOMParser = undefined;
      try {
        const html = readSiteFixture("dm5", `${sample.slug}.series.html`);
        const meta = parseDm5LegacyMeta(html);
        expect(meta.title).toBe(sample.title);
        expect(meta.cover).toBe(sample.cover);
        expect(parseDm5CoverMeta(html)).toBe(sample.cover);
        expect(meta.chapterList).toEqual(sample.htmlChapterIDs);
        for (const id of sample.htmlChapterIDs) {
          expect(meta.chapters[id].href).toBe(`https://www.dm5.com/${id}/`);
        }
        if (sample.slug === "bailianchengshen") {
          expect(html).toContain('class="detail-lock"');
          expect(meta.chapters.m462489.title).toContain("第81回 先声夺人");
        }
      } finally {
        globalThis.DOMParser = originalParser;
      }
    });
  });

  it("keeps only DM5 m-number chapter links from RSS", () => {
    const rssXml = `
      <rss>
        <channel>
          <title>Demo</title>
          <item><title>WWW</title><link>https://www.dm5.com/m100/</link></item>
          <item><title>Tel</title><link>https://tel.dm5.com/m200/</link></item>
          <item><title>Relative</title><link>/m300/</link></item>
          <item><title>External</title><link>https://example.com/m400/</link></item>
          <item><title>Series</title><link>https://www.dm5.com/manhua-demo/</link></item>
        </channel>
      </rss>
    `;

    expect(parseDm5RssMetaStrict(rssXml)).toEqual({
      title: "Demo",
      chapterList: ["m100", "m200", "m300"],
      chapters: {
        m100: { title: "WWW", href: "https://www.dm5.com/m100/" },
        m200: { title: "Tel", href: "https://tel.dm5.com/m200/" },
        m300: { title: "Relative", href: "https://www.dm5.com/m300/" },
      },
    });
  });

  it("rejects RSS metadata when every chapter link is invalid", () => {
    const rssXml = `
      <rss>
        <channel>
          <title>Invalid</title>
          <item><link>https://example.com/m400/</link></item>
          <item><link>https://www.dm5.com/manhua-demo/</link></item>
        </channel>
      </rss>
    `;

    expect(() => parseDm5RssMetaStrict(rssXml)).toThrow(
      "DM5 RSS metadata did not include any usable chapter links.",
    );
  });

  it("applies the same chapter validation to legacy DOM parsing", () => {
    const html = `
      <div class="banner_detail">
        <div class="info"><span class="title">Legacy Demo</span></div>
      </div>
      <div id="chapterlistload">
        <li><a href="/m3/">Chapter 3</a></li>
        <li><a href="https://example.com/m2/">External</a></li>
        <li><a href="/manhua-demo/">Series</a></li>
      </div>
    `;

    const meta = parseDm5LegacyMeta(html);

    expect(meta.chapterList).toEqual(["m3"]);
    expect(meta.chapters).toEqual({
      m3: { title: "Chapter 3", href: "https://www.dm5.com/m3/" },
    });
  });

  it("keeps legacy chapter validation without DOMParser", () => {
    const originalParser = globalThis.DOMParser;
    (globalThis as any).DOMParser = undefined;
    const html = `
      <title>Legacy Demo</title>
      <div id="chapterlistload">
        <li><a href="/m3/">Chapter 3</a></li>
        <li><a href="/manhua-demo/">Series</a></li>
      </div>
    `;

    try {
      const meta = parseDm5LegacyMeta(html);
      expect(meta.chapterList).toEqual(["m3"]);
      expect(meta.chapters.m3.href).toBe("https://www.dm5.com/m3/");
    } finally {
      (globalThis as any).DOMParser = originalParser;
    }
  });
});
