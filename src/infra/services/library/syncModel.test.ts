import { buildSeriesKey } from "./schema";
import type { LibrarySyncSeriesStateV1, LibrarySyncStateV1 } from "./syncModel";
import {
  compactLibrarySyncState,
  createEmptyLibrarySyncState,
  mergeLibrarySyncStates,
  syncIndexedRowsToState,
  syncStateToIndexedRows,
  syncStateToWireRows,
  syncWireRowsToState,
} from "./syncModel";

function createSeriesState(
  overrides: Partial<LibrarySyncSeriesStateV1> = {},
): LibrarySyncSeriesStateV1 {
  return {
    site: "dm5",
    comicsID: "m1",
    title: "Demo",
    cover: "cover.jpg",
    url: "https://dm5.com/m1",
    latestChapterID: "",
    lastReadChapterID: "",
    readChapterIDs: [],
    chapterSummaries: {},
    ...overrides,
  };
}

function createState(): LibrarySyncStateV1 {
  return createEmptyLibrarySyncState();
}

describe("library sync model", () => {
  it("preserves chapter IDs that match object prototype names through decoding and merging", () => {
    const rows = [
      [
        [
          0,
          "m1",
          "Demo",
          "",
          "",
          1,
          1,
          [
            ["__proto__", "Chapter", "chapter-url"],
            ["constructor", "Next", "next-url"],
          ],
        ],
      ],
      [1],
      [],
      [[1, 2]],
    ];
    const remote = syncIndexedRowsToState(rows);
    const merged = mergeLibrarySyncStates(createState(), remote, "remote");
    const summaries = merged.seriesByKey["dm5:m1"].chapterSummaries;
    expect(Object.hasOwn(summaries, "__proto__")).toBe(true);
    expect(summaries.__proto__).toEqual({
      title: "Chapter",
      href: "chapter-url",
    });
    expect(summaries.constructor).toEqual({ title: "Next", href: "next-url" });
    expect(Object.getPrototypeOf(summaries)).toBe(Object.prototype);
    expect(syncIndexedRowsToState(syncStateToIndexedRows(merged))).toEqual(
      remote,
    );
    expect(syncWireRowsToState(syncStateToWireRows(remote))).toEqual(remote);
  });

  it.each(
    [
      null,
      [[], [], []],
      [[], [1], [], []],
      [[], [], [0], []],
      [[], [], [], [[1, 1]]],
      [[[6, "id", "", "", "", 0, 0, []]], [], [], []],
      [[[0, "id", 123, "", "", 0, 0, []]], [], [], []],
      [[[0, "id", "", "", "", 1, 0, []]], [], [], []],
      [[[0, "id", "", "", "", 0, -1, []]], [], [], []],
      [
        [
          [
            0,
            "id",
            "",
            "",
            "",
            0,
            0,
            [
              ["c1", "", ""],
              ["c1", "", ""],
            ],
          ],
        ],
        [],
        [],
        [],
      ],
      [
        [
          [0, "id", "", "", "", 0, 0, []],
          [0, "id", "", "", "", 0, 0, []],
        ],
        [],
        [],
        [],
      ],
      [[[0, "id", "", "", "", 0, 0, [["c1", "", ""]]]], [], [], [[1, 2]]],
      [[[0, "id", "", "", "", 0, 0, []]], [1.5], [], []],
    ].map((rows) => [rows]),
  )("rejects malformed indexed rows instead of dropping data (%#)", (rows) => {
    expect(() => syncIndexedRowsToState(rows)).toThrow();
  });

  it("keeps site codes stable and uses explicit missing checkpoints", () => {
    const state = createState();
    for (const site of ["dm5", "8comic", "manhuagui", "baozimh"] as const) {
      const key = buildSeriesKey(site, "123");
      state.seriesByKey[key] = createSeriesState({
        site,
        comicsID: key.split(":")[1],
      });
      state.subscriptions.push(key);
    }
    const rows = syncStateToIndexedRows(state);
    expect(rows[0].map((row) => row[0])).toEqual([0, 4, 3, 5]);
    expect(rows[0].map((row) => row.slice(5, 7))).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    expect(rows[1]).toEqual([1, 2, 3, 4]);
    expect(syncIndexedRowsToState(rows)).toEqual(state);
  });

  it("round-trips Baozimh slug identities, subscriptions, history and chapter checkpoints through v1 and v2", () => {
    const slug = "zhongjiedechitianshi-jiyingshe";
    const key = `baozimh:${slug}`;
    const chapterID = `comic/chapter/${slug}/0_0.html`;
    const state = createState();
    state.seriesByKey[key] = createSeriesState({
      site: "baozimh",
      comicsID: slug,
      title: "終結的熾天使",
      url: `https://www.baozimh.com/comic/${slug}`,
      latestChapterID: chapterID,
      lastReadChapterID: chapterID,
      readChapterIDs: [chapterID],
      chapterSummaries: {
        [chapterID]: {
          title: "第1話",
          href: `https://www.twmanga.com/${chapterID}`,
        },
      },
    });
    state.subscriptions = [key];
    state.history = [key];
    state.updates = [{ seriesKey: key, chapterID }];
    expect(syncWireRowsToState(syncStateToWireRows(state))).toEqual(state);
    const rows = syncStateToIndexedRows(state);
    expect(rows[0][0][0]).toBe(5);
    expect(syncIndexedRowsToState(rows)).toEqual(state);
  });

  it("drops retired v2 rows without shifting surviving series or chapter references", () => {
    const state = syncIndexedRowsToState([
      [
        [0, "m123", "DM5", "", "", 1, 1, [["m1", "Ch 1", "dm5-url"]]],
        [1, "123", "Retired", "", "", 1, 1, [["c1", "Old", "old-url"]]],
        [2, "123", "ComicBus", "", "", 1, 0, [["c7", "Old", "bus-url"]]],
        [3, "123", "Manhuagui", "", "", 1, 1, [["99", "Ch 99", "gui-url"]]],
        [4, "123", "8comic", "", "", 1, 0, [["c7", "Ch 7", "eight-url"]]],
      ],
      [2, 4, 1, 3, 5],
      [3, 2, 1, 4, 5],
      [
        [2, 1],
        [3, 1],
        [4, 1],
        [5, 1],
      ],
    ]);
    expect(Object.keys(state.seriesByKey)).toEqual([
      "manhuagui:123",
      "dm5:m123",
      "8comic:123",
    ]);
    expect(state.subscriptions).toEqual([
      "manhuagui:123",
      "dm5:m123",
      "8comic:123",
    ]);
    expect(state.history).toEqual(["dm5:m123", "manhuagui:123", "8comic:123"]);
    expect(state.updates).toEqual([
      { seriesKey: "manhuagui:123", chapterID: "99" },
      { seriesKey: "8comic:123", chapterID: "c7" },
    ]);
    expect(syncIndexedRowsToState(syncStateToIndexedRows(state))).toEqual(
      state,
    );
  });

  it.each(
    [
      [[[1, "123", 7, "", "", 0, 0, []]], [], [], []],
      [[[1, "123", "", "", "", 1, 0, []]], [], [], []],
      [[[1, "123", "", "", "", 0, 0, []]], [2], [], []],
      [[[1, "123", "", "", "", 0, 0, []]], [], [], [[1, 1]]],
      [[[2, "123", 7, "", "", 0, 0, []]], [], [], []],
      [[[2, "123", "", "", "", 1, 0, []]], [], [], []],
      [[[2, "123", "", "", "", 0, 0, []]], [2], [], []],
      [[[2, "123", "", "", "", 0, 0, []]], [], [], [[1, 1]]],
    ].map((rows) => [rows]),
  )("still validates retired rows and their references (%#)", (rows) => {
    expect(() => syncIndexedRowsToState(rows)).toThrow();
  });

  it("drops retired v1 series and references while keeping supported records", () => {
    const state = syncWireRowsToState({
      series: [
        { site: "sf", comicsID: "123", title: "Retired", chapters: [] },
        { site: "comicbus", comicsID: "123", title: "Retired", chapters: [] },
        { site: "8comic", comicsID: "123", title: "Kept", chapters: [] },
      ],
      subscriptions: [
        { seriesKey: "sf:123" },
        { seriesKey: "comicbus:123" },
        { seriesKey: "8comic:123" },
      ],
      history: [
        ...Array.from(
          { length: 50 },
          (_, index) => `${index % 2 ? "sf" : "comicbus"}:${index}`,
        ),
        "8comic:123",
      ],
      updates: [
        { seriesKey: "sf:123", chapterID: "c1" },
        { seriesKey: "comicbus:123", chapterID: "c7" },
        { seriesKey: "8comic:123", chapterID: "c7" },
      ],
    });
    expect(Object.keys(state.seriesByKey)).toEqual(["8comic:123"]);
    expect(state.subscriptions).toEqual(["8comic:123"]);
    expect(state.history).toEqual(["8comic:123"]);
    expect(state.updates).toEqual([
      { seriesKey: "8comic:123", chapterID: "c7" },
    ]);
  });

  it("keeps every subscription and update, the latest 50 history entries, and only checkpoint summaries", () => {
    const state = createState();
    for (let index = 0; index < 55; index += 1) {
      const key = buildSeriesKey("dm5", `m${index}`);
      state.seriesByKey[key] = createSeriesState({ comicsID: `m${index}` });
      state.history.push(key);
    }
    state.subscriptions = ["dm5:m52"];
    state.updates = [
      { seriesKey: "dm5:m53", chapterID: "pending1" },
      { seriesKey: "dm5:m53", chapterID: "pending2" },
    ];
    state.seriesByKey["dm5:m53"] = createSeriesState({
      comicsID: "m53",
      latestChapterID: "latest",
      lastReadChapterID: "last",
      readChapterIDs: ["old", "last"],
      chapterSummaries: {
        old: { title: "Old read", href: "old" },
        last: { title: "Last read", href: "last" },
        latest: { title: "Latest", href: "latest" },
        pending1: { title: "Pending 1", href: "pending1" },
        pending2: { title: "Pending 2", href: "pending2" },
      },
    });
    const before = JSON.stringify(state);
    const compact = compactLibrarySyncState(state);
    expect(compact.subscriptions).toEqual(state.subscriptions);
    expect(compact.updates).toEqual(state.updates);
    expect(compact.history).toEqual(state.history.slice(0, 50));
    expect(Object.keys(compact.seriesByKey)).toHaveLength(52);
    expect(compact.seriesByKey).not.toHaveProperty("dm5:m51");
    expect(compact.seriesByKey).not.toHaveProperty("dm5:m54");
    expect(compact.seriesByKey["dm5:m53"].readChapterIDs).toEqual(["last"]);
    expect(
      Object.keys(compact.seriesByKey["dm5:m53"].chapterSummaries),
    ).toEqual(["latest", "last", "pending1", "pending2"]);
    expect(JSON.stringify(state)).toBe(before);
    expect(compactLibrarySyncState(compact)).toEqual(compact);
  });

  it("round-trips the v1 wire shape while keeping latest chapter explicit", () => {
    const seriesKey = buildSeriesKey("dm5", "m1");
    const state = createState();
    state.seriesByKey[seriesKey] = createSeriesState({
      latestChapterID: "c3",
      lastReadChapterID: "c2",
      readChapterIDs: ["c2", "c1"],
      chapterSummaries: {
        c3: { title: "Chapter 3", href: "https://dm5.com/c3" },
        c2: { title: "Chapter 2", href: "https://dm5.com/c2" },
        c1: { title: "Chapter 1", href: "https://dm5.com/c1" },
        cached: { title: "Cached", href: "https://dm5.com/cached" },
      },
    });
    state.subscriptions = [seriesKey];
    state.history = [seriesKey];
    state.updates = [{ seriesKey, chapterID: "c3" }];

    const wire = syncStateToWireRows(state);
    expect(wire.series[0].chapters.map((chapter) => chapter.chapterID)).toEqual(
      ["c3", "c2", "c1"],
    );
    expect(wire.series[0].chapters).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ chapterID: "cached" }),
      ]),
    );

    const restored = syncWireRowsToState(wire);
    expect(restored.seriesByKey[seriesKey]).toMatchObject({
      latestChapterID: "c3",
      lastReadChapterID: "c2",
      readChapterIDs: ["c2", "c1"],
      chapterSummaries: {
        c3: { title: "Chapter 3", href: "https://dm5.com/c3" },
        c2: { title: "Chapter 2", href: "https://dm5.com/c2" },
        c1: { title: "Chapter 1", href: "https://dm5.com/c1" },
      },
    });
  });

  it("prefers newer remote fields while preserving local reading data", () => {
    const seriesKey = buildSeriesKey("dm5", "m1");
    const remoteOnlyKey = buildSeriesKey("dm5", "m2");
    const local = createState();
    local.seriesByKey[seriesKey] = createSeriesState({
      title: "Local title",
      latestChapterID: "c2",
      lastReadChapterID: "c2",
      readChapterIDs: ["c2"],
      chapterSummaries: {
        c2: { title: "Chapter 2", href: "https://dm5.com/c2" },
      },
    });
    local.subscriptions = [seriesKey];
    local.history = [seriesKey];
    local.updates = [{ seriesKey, chapterID: "c2" }];

    const remote = createState();
    remote.seriesByKey[seriesKey] = createSeriesState({
      title: "Remote title",
      latestChapterID: "c3",
      lastReadChapterID: "c3",
      readChapterIDs: ["c3"],
      chapterSummaries: {
        c2: { title: "", href: "" },
        c3: { title: "Chapter 3", href: "https://dm5.com/c3" },
      },
    });
    remote.seriesByKey[remoteOnlyKey] = createSeriesState({
      comicsID: "m2",
      title: "Remote only",
    });
    remote.subscriptions = [remoteOnlyKey];
    remote.history = [remoteOnlyKey];
    remote.updates = [{ seriesKey, chapterID: "c3" }];

    const merged = mergeLibrarySyncStates(local, remote, "remote");

    expect(merged.seriesByKey[seriesKey]).toMatchObject({
      title: "Remote title",
      latestChapterID: "c3",
      lastReadChapterID: "c3",
      readChapterIDs: ["c2", "c3"],
      chapterSummaries: {
        c2: { title: "Chapter 2", href: "https://dm5.com/c2" },
        c3: { title: "Chapter 3", href: "https://dm5.com/c3" },
      },
    });
    expect(merged.seriesByKey[remoteOnlyKey]?.title).toBe("Remote only");
    expect(merged.subscriptions).toEqual([remoteOnlyKey, seriesKey]);
    expect(merged.history).toEqual([remoteOnlyKey, seriesKey]);
    expect(merged.updates).toEqual([
      { seriesKey, chapterID: "c3" },
      { seriesKey, chapterID: "c2" },
    ]);
  });
});
