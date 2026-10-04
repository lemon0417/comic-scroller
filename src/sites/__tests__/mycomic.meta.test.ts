import { firstValueFrom } from "rxjs";

import { readSiteFixture } from "../../testUtils/siteFixtures";
import { fetchMeta$, parseMyComicMeta } from "../mycomic/meta";
import {
  MYCOMIC_REQUEST_OPTIONS,
  MYCOMIC_REQUEST_TIMEOUT_MS,
} from "../mycomic/url";
import { getSiteAdapter, getSiteChapterFetcher } from "../registry";

const fixture = (id = "1759") =>
  readSiteFixture("mycomic", `series-${id}.html`);
const expectedGroups = {
  "1759": {
    single: [
      790421, 788981, 787981, 786638, 785396, 784818, 783498, 782267, 780989,
      779662, 671339, 670112, 669302, 667919, 666866, 665898, 664920, 663516,
      662676, 660792, 404054, 402594, 401044, 399811, 399810, 397326, 396111,
      395032, 393388, 392163, 361948, 360765, 359603, 358626, 357224, 356139,
      355325, 353860, 353093, 350366, 350365, 318427, 317172, 314266, 313167,
      311957, 311956, 310085, 308944, 308100, 244364, 243472, 242258, 241073,
      239818, 238364, 237042, 235456, 233695, 231415, 230149, 140519, 138911,
      137767, 137007, 135495, 134670, 133873, 133216, 132403,
    ],
    volume: [
      688935, 440051, 440050, 319332, 257233, 221341, 87519, 15325, 15324,
      15323, 15322, 15321, 15320, 15319, 15318, 15317, 15316, 15315, 15314,
      15313, 15312, 15311, 15310, 15309, 15308, 15307, 15306, 15305, 15304,
      15303, 15302, 15301, 15300, 15299, 15298, 15297, 15296,
    ],
    extra: [382847, 227432, 136199, 67545, 67167],
  },
  "31379": {
    single: [
      818127, 818126, 818125, 812686, 812685, 811086, 811085, 808456, 808455,
      808454, 805812, 805811, 805810, 805717, 803955, 803954, 803953, 803952,
      803951, 803155, 803154, 803153, 711159, 711158, 711157, 705738, 699707,
      697698, 697015, 697014, 697013, 697012, 697011, 697010, 697009, 679273,
      679272, 679271, 679270, 679269, 679268, 664949, 664948, 660350, 660349,
      653776, 653775, 653774, 645530, 645529, 640350, 636925, 636379, 631743,
      629424, 625415, 623850, 623849, 623848, 615718, 615717, 610490, 604664,
      602679, 599999, 596425, 593796, 591850, 588847, 586478, 583771, 580059,
      573857, 573105, 571080, 571079, 571078, 571077, 571076, 571075, 571074,
      571073, 571072, 551750, 551749, 535722, 535721, 533788, 531469, 530465,
      530338, 509726, 506633, 504047, 501304, 497049, 494612, 491469, 488770,
      486542, 486541, 486540, 486539, 486538, 486537, 485751, 485750, 485532,
      464444, 464443, 460460, 458631, 455788, 453348, 453329, 448828, 444850,
      443180, 440657, 437489, 435362, 435361, 426489, 426488, 423621,
    ],
    extra: [608235, 580058, 551751, 517065, 514111, 486543],
  },
};

function editData(html: string, edit: (data: Record<string, any>) => void) {
  return html.replace(
    /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
    (_all, start, raw, end) => {
      const data = JSON.parse(raw);
      edit(data);
      return `${start}${JSON.stringify(data)}${end}`;
    },
  );
}

describe("MyComic metadata", () => {
  const originalFetch = globalThis.fetch;
  const originalParser = globalThis.DOMParser;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.DOMParser = originalParser;
    jest.useRealTimers();
  });

  it.each([
    ["1759", "獵人", "89ffbf", 112, "第410話"],
    ["31379", "戰勇F5(Reload)", "ccdfc3", 131, "第125話"],
  ] as const)(
    "reads the complete %s directory without DOM",
    (id, title, hash, count, latest) => {
      (globalThis as any).DOMParser = undefined;
      const meta = parseMyComicMeta(fixture(id), id);
      const groups = Object.entries(expectedGroups[id]).map(([key, ids]) => ({
        id: key,
        chapterList: ids.map((number) => `chapters/${number}`),
      }));
      expect(meta).toMatchObject({
        title,
        cover: `https://biccam.com/comics/${id}-${hash}.jpg`,
        chapterGroups: groups,
      });
      expect(meta.chapterList).toEqual(
        groups.flatMap((group) => group.chapterList),
      );
      expect(meta.chapterList).toHaveLength(count);
      expect(meta.chapters[meta.chapterList[0]]).toEqual({
        title: latest,
        href: `https://mycomic.com/${meta.chapterList[0]}`,
      });
    },
  );

  it("ignores navigation, recommendations and inert script/comment contents", () => {
    // Synthetic non-directory contents appended to a real response.
    const extra =
      '<a href="/chapters/999999">Other book</a><script><div x-data="{chapters: []}"></div></script><!-- <div x-data="{chapters: []}"></div> -->';
    expect(
      parseMyComicMeta(fixture().replace("</body>", extra + "</body>"), "1759"),
    ).toEqual(parseMyComicMeta(fixture(), "1759"));
  });

  it("keeps group keys stable for simplified headings", () => {
    const html = fixture()
      .replace("<div>單話</div>", "<div>单话</div>")
      .replace("<div>單行本</div>", "<div>单行本</div>");
    expect(parseMyComicMeta(html, "1759").chapterGroups).toEqual(
      parseMyComicMeta(fixture(), "1759").chapterGroups,
    );
  });

  it("reads quoted brackets and entities without executing Alpine methods", () => {
    // Synthetic array exercises JSON-string boundaries inside a real HTML attribute.
    const title = 'A [end] "quote" & 中文';
    const state = `{chapters: ${JSON.stringify([
      { id: 2, title },
      { id: 1, title: "First" },
    ])}, decending: true, toggleSorting() { throw new Error('must not execute'); },}`;
    const html = fixture().replace(
      /<body>[\s\S]*<\/body>/,
      `<body><div x-data="${state.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"><div data-flux-subheading=""><div>單話</div></div></div></body>`,
    );
    const meta = parseMyComicMeta(html, "1759");
    expect(meta.chapterList).toEqual(["chapters/2", "chapters/1"]);
    expect(meta.chapters["chapters/2"].title).toBe(title);
  });

  it("fetches canonical grouped snapshots with HTML headers and skips unused cover validation", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        editData(fixture(), (data) => {
          data.image = "https://evil.test/cover.jpg";
        }),
    });
    const snapshot = await firstValueFrom(
      getSiteChapterFetcher("mycomic")!(
        "https://mycomic.com/cn/comics/1759?from=list",
      ),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://mycomic.com/comics/1759",
      { ...MYCOMIC_REQUEST_OPTIONS, signal: expect.any(AbortSignal) },
    );
    expect(snapshot.chapterList).toHaveLength(112);
    expect(snapshot.chapterGroups).toHaveLength(3);
    expect(snapshot).not.toHaveProperty("title");
    expect(snapshot).not.toHaveProperty("cover");
    expect(getSiteAdapter("mycomic")?.baseURL).toBe("https://mycomic.com");
  });

  it.each([
    "http://mycomic.com/comics/1759",
    "https://mycomic.com.evil.test/comics/1759",
    "https://user:pass@mycomic.com/comics/1759",
    "https://mycomic.com/chapters/1759",
    "https://mycomic.com/comics/0",
    "https://mycomic.com/comics/../1759",
  ])("rejects unsupported URLs before HTTP: %s", (url) => {
    globalThis.fetch = jest.fn();
    expect(() => fetchMeta$(url)).toThrow();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["challenge", "<title>Just a moment...</title>"],
    [
      "wrong identity",
      editData(fixture(), (data) => {
        data.url = "https://mycomic.com/comics/31379";
      }),
    ],
    [
      "wrong cover",
      editData(fixture(), (data) => {
        data.image = "https://biccam.com/comics/17590-hash.jpg";
      }),
    ],
    [
      "untrusted cover",
      editData(fixture(), (data) => {
        data.image = "https://user:pass@biccam.com/comics/1759-hash.jpg";
      }),
    ],
    [
      "missing directory",
      fixture().replaceAll("chapters:", "recommendations:"),
    ],
    [
      "invalid chapter ID",
      fixture().replace("&quot;id&quot;:790421", "&quot;id&quot;:0"),
    ],
    [
      "duplicate chapter",
      fixture().replace("&quot;id&quot;:788981", "&quot;id&quot;:790421"),
    ],
    [
      "unknown heading",
      fixture().replace("<div>單話</div>", "<div>Other</div>"),
    ],
    [
      "duplicate group",
      fixture().replace("<div>單行本</div>", "<div>單話</div>"),
    ],
    ["truncated array", fixture().replace("],\n", ",\n")],
    ["incomplete container", fixture().replaceAll("</div>", "")],
    ["oversized", "x".repeat(2 * 1024 * 1024 + 1)],
  ])("rejects %s instead of writing an incomplete snapshot", (_label, html) => {
    expect(() => parseMyComicMeta(html, "1759")).toThrow();
  });

  it("reports HTTP challenges without automatic retries", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(
      firstValueFrom(fetchMeta$("https://mycomic.com/comics/1759")),
    ).rejects.toThrow("403");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("aborts an unsubscribed metadata request", () => {
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn((_url, options) => {
      signal = options?.signal as AbortSignal;
      return new Promise(() => undefined);
    });
    const subscription = fetchMeta$(
      "https://mycomic.com/comics/1759",
    ).subscribe();
    subscription.unsubscribe();
    expect(signal?.aborted).toBe(true);
  });

  it("times out and aborts stalled requests", async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn((_url, options) => {
      signal = options?.signal as AbortSignal;
      return new Promise(() => undefined);
    });
    const result = firstValueFrom(
      fetchMeta$("https://mycomic.com/comics/1759"),
    );
    const expectation = expect(result).rejects.toThrow("Timeout");
    await jest.advanceTimersByTimeAsync(MYCOMIC_REQUEST_TIMEOUT_MS);
    await expectation;
    expect(signal?.aborted).toBe(true);
  });
});
