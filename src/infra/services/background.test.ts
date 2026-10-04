import type { SiteKey } from "@domain/library";
import { NEVER, of } from "rxjs";

import {
  ensureBackgroundAlarms,
  EXTENSION_RELEASE_ALARM_NAME,
  handleExtensionInstalled,
  handleNotificationClick,
  handlePingBackgroundMessage,
  LIBRARY_REFRESH_ALARM_NAME,
  resolveReaderRedirect,
  runBackgroundReleaseCheck,
  runBackgroundUpdateSummary,
} from "./background";

const UPDATE_NOTIFICATION_ID = "Comics Scroller Update";

function createRefreshCandidate(
  seriesKey: string,
  url: string,
  latestChapterID = "",
) {
  const [site, ...comicsIDParts] = seriesKey.split(":");
  return {
    seriesKey,
    site: site as SiteKey,
    comicsID: comicsIDParts.join(":"),
    url,
    latestChapterID,
  };
}

type TestBackgroundDeps = NonNullable<
  Parameters<typeof runBackgroundUpdateSummary>[0]
>;

function createBackgroundDeps(
  overrides: Partial<TestBackgroundDeps> = {},
): TestBackgroundDeps {
  return {
    applyBackgroundSeriesRefresh: jest.fn(),
    clearNotification: jest.fn(),
    createNotification: jest.fn(),
    getFetchChapters: jest.fn(),
    getManifestVersion: jest.fn(() => "4.0.99"),
    getRuntimeUrl: jest.fn((path: string) => `chrome-extension:///${path}`),
    getUpdateCount: jest.fn().mockResolvedValue(0),
    listBackgroundRefreshCandidates: jest.fn().mockResolvedValue([]),
    markSubscriptionCheckedByKey: jest.fn(),
    openTab: jest.fn(),
    reconcileExtensionReleaseState: jest.fn(),
    refreshExtensionReleaseState: jest.fn(),
    resetLibrary: jest.fn(),
    setBadge: jest.fn(),
    setLibraryVersion: jest.fn(),
    withBatchedLibrarySignals: async (run) => run(),
    ...overrides,
  };
}

describe("background service", () => {
  function groupedSnapshot(groups: Array<[string, string[]]>) {
    const chapterList = groups.flatMap(([, ids]) => ids);
    return {
      chapterList,
      chapters: Object.fromEntries(
        chapterList.map((id) => [
          id,
          {
            title: id,
            href: `https://www.manhuagui.com/comic/49169/${id}.html`,
          },
        ]),
      ),
      chapterGroups: groups.map(([id, ids]) => ({ id, chapterList: ids })),
    };
  }

  it.each([
    [
      "new chapters in each group",
      [
        ["volume", ["v2", "v1"]],
        ["extra", ["e2", "e1"]],
        ["single", ["c2", "c1"]],
      ],
      { volume: "v1", extra: "e1", single: "c1" },
      ["v2", "e2", "c2"],
    ],
    [
      "group reordering",
      [
        ["single", ["c1"]],
        ["volume", ["v1"]],
      ],
      { volume: "v1", single: "c1" },
      [],
    ],
    [
      "backfills after the checkpoint",
      [["single", ["c2", "backfill", "c1"]]],
      { single: "c2" },
      [],
    ],
    [
      "a new group establishes its baseline",
      [
        ["volume", ["v2", "v1"]],
        ["extra", ["e1"]],
      ],
      { volume: "v1" },
      ["v2"],
    ],
    [
      "a missing checkpoint only resets its own group",
      [
        ["volume", ["v2"]],
        ["single", ["c2", "c1"]],
      ],
      { volume: "missing", single: "c1" },
      ["c2"],
    ],
    [
      "the initial poll establishes all group baselines",
      [
        ["volume", ["v2", "v1"]],
        ["single", ["c2", "c1"]],
      ],
      {},
      [],
    ],
  ] as Array<
    [string, Array<[string, string[]]>, Record<string, string>, string[]]
  >)(
    "handles %s for grouped providers",
    async (_name, groups, checkpoints, expected) => {
      const snapshot = groupedSnapshot(groups);
      const applyBackgroundSeriesRefresh = jest.fn();
      const summary = await runBackgroundUpdateSummary(
        createBackgroundDeps({
          applyBackgroundSeriesRefresh,
          listBackgroundRefreshCandidates: jest.fn().mockResolvedValue([
            {
              ...createRefreshCandidate(
                "manhuagui:49169",
                "https://www.manhuagui.com/comic/49169/",
                "v1",
              ),
              latestChapterIDsByGroup: checkpoints,
            },
          ]),
          getFetchChapters: jest.fn(() => () => of(snapshot)),
        }),
      );
      expect(summary.errors).toBe(0);
      expect(summary.updated).toBe(expected.length);
      expect(applyBackgroundSeriesRefresh).toHaveBeenCalledWith(
        "manhuagui",
        "49169",
        snapshot,
        expected,
      );
    },
  );

  it.each([
    [
      { id: "a", chapterList: ["v1"] },
      { id: "a", chapterList: ["c1"] },
    ],
    [
      { id: "a", chapterList: ["v1", "c1"] },
      { id: "b", chapterList: ["c1"] },
    ],
    [{ id: "a", chapterList: ["v1"] }],
    [{ id: "a", chapterList: ["c1", "v1"] }],
    [{ id: "a", chapterList: [] }],
  ])(
    "rejects inconsistent chapter groups before persisting them (%#)",
    async (...groups) => {
      const snapshot = {
        ...groupedSnapshot([
          ["a", ["v1"]],
          ["b", ["c1"]],
        ]),
        chapterGroups: groups,
      };
      const applyBackgroundSeriesRefresh = jest.fn();
      const summary = await runBackgroundUpdateSummary(
        createBackgroundDeps({
          applyBackgroundSeriesRefresh,
          listBackgroundRefreshCandidates: jest
            .fn()
            .mockResolvedValue([
              createRefreshCandidate(
                "manhuagui:49169",
                "https://www.manhuagui.com/comic/49169/",
              ),
            ]),
          getFetchChapters: jest.fn(() => () => of(snapshot)),
        }),
      );
      expect(summary.errors).toBe(1);
      expect(applyBackgroundSeriesRefresh).not.toHaveBeenCalled();
    },
  );

  it("redirects only supported Manhuagui chapter URLs and respects the native bypass", () => {
    const getURL = (path: string) => `chrome-extension://test/${path}`;
    const redirect = resolveReaderRedirect(
      "https://www.manhuagui.com/comic/49169/910633.html#p=2",
      getURL,
    );
    const params = new URL(redirect).searchParams;
    expect(params.get("site")).toBe("manhuagui");
    expect(params.get("chapter")).toBe("comic/49169/910633.html");
    for (const url of [
      "https://www.manhuagui.com/comic/49169/",
      "https://www.manhuagui.com/comic/49169/910633.html?cs_open_native=1",
      "https://www.manhuagui.com.evil.test/comic/49169/910633.html",
      "http://www.manhuagui.com/comic/49169/910633.html",
    ])
      expect(resolveReaderRedirect(url, getURL)).toBe("");
  });

  it("preserves existing background alarm schedules", async () => {
    const createAlarm = jest.fn();
    const getAlarm = jest.fn(
      async (name: string) =>
        ({
          name,
          scheduledTime: 999,
        }) as chrome.alarms.Alarm,
    );

    await ensureBackgroundAlarms({ createAlarm, getAlarm }, () => 123);

    expect(getAlarm).toHaveBeenCalledWith(LIBRARY_REFRESH_ALARM_NAME);
    expect(getAlarm).toHaveBeenCalledWith(EXTENSION_RELEASE_ALARM_NAME);
    expect(createAlarm).not.toHaveBeenCalled();
  });

  it("creates only missing background alarms", async () => {
    const createAlarm = jest.fn();
    const getAlarm = jest.fn(async (name: string) =>
      name === EXTENSION_RELEASE_ALARM_NAME
        ? ({ name, scheduledTime: 999 } as chrome.alarms.Alarm)
        : undefined,
    );

    await ensureBackgroundAlarms({ createAlarm, getAlarm }, () => 123);

    expect(createAlarm).toHaveBeenCalledTimes(1);
    expect(createAlarm).toHaveBeenCalledWith(LIBRARY_REFRESH_ALARM_NAME, {
      when: 123,
      periodInMinutes: 10,
    });
  });

  it("shares an active background update across concurrent callers", async () => {
    let resolveCandidates: (
      candidates: ReturnType<typeof createRefreshCandidate>[],
    ) => void = () => undefined;
    const candidatesPromise = new Promise<
      ReturnType<typeof createRefreshCandidate>[]
    >((resolve) => {
      resolveCandidates = resolve;
    });
    const listBackgroundRefreshCandidates = jest.fn(() => candidatesPromise);
    const deps = createBackgroundDeps({
      listBackgroundRefreshCandidates,
    });

    const firstRun = runBackgroundUpdateSummary(deps);
    const overlappingRun = runBackgroundUpdateSummary(deps);

    expect(overlappingRun).toBe(firstRun);
    expect(listBackgroundRefreshCandidates).toHaveBeenCalledTimes(1);

    resolveCandidates([]);
    await expect(Promise.all([firstRun, overlappingRun])).resolves.toEqual([
      {
        checked: 0,
        updated: 0,
        errors: 0,
        diff: { before: 0, after: 0, added: 0 },
      },
      {
        checked: 0,
        updated: 0,
        errors: 0,
        diff: { before: 0, after: 0, added: 0 },
      },
    ]);
  });

  it("allows a background update retry after the active run fails", async () => {
    const listBackgroundRefreshCandidates = jest
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce([]);
    const deps = createBackgroundDeps({
      listBackgroundRefreshCandidates,
    });

    await expect(runBackgroundUpdateSummary(deps)).rejects.toThrow(
      "temporary failure",
    );
    await expect(runBackgroundUpdateSummary(deps)).resolves.toEqual({
      checked: 0,
      updated: 0,
      errors: 0,
      diff: { before: 0, after: 0, added: 0 },
    });
    expect(listBackgroundRefreshCandidates).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["an empty chapter list", { chapterList: [], chapters: {} }],
    [
      "duplicate chapter IDs",
      {
        chapterList: ["m1", "m1"],
        chapters: {
          m1: { title: "Ch 1", href: "https://www.dm5.com/m1/" },
        },
      },
    ],
    ["a missing chapter record", { chapterList: ["m1"], chapters: {} }],
    [
      "a chapter without an href",
      {
        chapterList: ["m1"],
        chapters: { m1: { title: "Ch 1", href: "" } },
      },
    ],
  ])("reports %s as invalid background metadata", async (_label, meta) => {
    const applyBackgroundSeriesRefresh = jest.fn();
    const markSubscriptionCheckedByKey = jest.fn();
    const summary = await runBackgroundUpdateSummary(
      createBackgroundDeps({
        applyBackgroundSeriesRefresh,
        getFetchChapters: jest.fn(() => () => of(meta as any)),
        listBackgroundRefreshCandidates: jest
          .fn()
          .mockResolvedValue([
            createRefreshCandidate(
              "dm5:m123",
              "https://www.dm5.com/m123/",
              "m0",
            ),
          ]),
        markSubscriptionCheckedByKey,
      }),
      { now: () => 456 },
    );

    expect(summary).toEqual({
      checked: 1,
      updated: 0,
      errors: 1,
      diff: { before: 0, after: 0, added: 0 },
    });
    expect(applyBackgroundSeriesRefresh).not.toHaveBeenCalled();
    expect(markSubscriptionCheckedByKey).toHaveBeenCalledWith("dm5:m123", 456);
  });

  it("summarizes background updates and refreshes badge", async () => {
    const setBadge = jest.fn();
    const withBatchedLibrarySignals = jest.fn(async (run) => run());
    const markSubscriptionCheckedByKey = jest.fn().mockResolvedValue(undefined);
    const applyBackgroundSeriesRefresh = jest.fn().mockResolvedValue({
      updatesCount: 2,
    });
    const fetchChapters = jest.fn(() =>
      of({
        chapterList: ["m2", "m1"],
        chapters: {
          m1: { title: "Ch 1", href: "https://www.dm5.com/m123//1" },
          m2: { title: "Ch 2", href: "https://www.dm5.com/m123//2" },
        },
      }),
    );

    const summary = await runBackgroundUpdateSummary(
      createBackgroundDeps({
        applyBackgroundSeriesRefresh,
        getFetchChapters: jest.fn(() => fetchChapters),
        getUpdateCount: jest
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(2),
        listBackgroundRefreshCandidates: jest
          .fn()
          .mockResolvedValue([
            createRefreshCandidate(
              "dm5:m123",
              "https://www.dm5.com/m123/",
              "m1",
            ),
          ]),
        markSubscriptionCheckedByKey,
        setBadge,
        withBatchedLibrarySignals,
      }),
      {
        batchSize: 12,
        concurrency: 2,
        timeoutMs: 3000,
        now: () => 12345,
      },
    );

    expect(summary).toEqual({
      checked: 1,
      updated: 1,
      errors: 0,
      diff: {
        before: 1,
        after: 2,
        added: 1,
      },
    });
    expect(applyBackgroundSeriesRefresh).toHaveBeenCalledWith(
      "dm5",
      "m123",
      {
        chapterList: ["m2", "m1"],
        chapters: expect.any(Object),
      },
      ["m2"],
    );
    expect(setBadge).toHaveBeenCalledWith(2);
    expect(withBatchedLibrarySignals).toHaveBeenCalledTimes(1);
    expect(fetchChapters).toHaveBeenCalledWith("https://www.dm5.com/m123/");
    expect(markSubscriptionCheckedByKey).toHaveBeenCalledWith(
      "dm5:m123",
      12345,
    );
  });

  it("establishes a baseline without reporting updates when the checkpoint is unavailable", async () => {
    const applyBackgroundSeriesRefresh = jest.fn().mockResolvedValue({
      updatesCount: 0,
    });
    const fetchChapters = jest.fn(() =>
      of({
        chapterList: ["m3", "m2", "m1"],
        chapters: {
          m1: { title: "Ch 1", href: "https://www.dm5.com/m1/" },
          m2: { title: "Ch 2", href: "https://www.dm5.com/m2/" },
          m3: { title: "Ch 3", href: "https://www.dm5.com/m3/" },
        },
      }),
    );
    const summary = await runBackgroundUpdateSummary(
      createBackgroundDeps({
        applyBackgroundSeriesRefresh,
        getFetchChapters: jest.fn(() => fetchChapters),
        listBackgroundRefreshCandidates: jest
          .fn()
          .mockResolvedValue([
            createRefreshCandidate("dm5:empty", "https://www.dm5.com/empty/"),
            createRefreshCandidate(
              "dm5:missing",
              "https://www.dm5.com/missing/",
              "m404",
            ),
          ]),
      }),
    );

    expect(summary.updated).toBe(0);
    expect(applyBackgroundSeriesRefresh).toHaveBeenCalledTimes(2);
    expect(applyBackgroundSeriesRefresh).toHaveBeenCalledWith(
      "dm5",
      "empty",
      expect.objectContaining({ chapterList: ["m3", "m2", "m1"] }),
      [],
    );
    expect(applyBackgroundSeriesRefresh).toHaveBeenCalledWith(
      "dm5",
      "missing",
      expect.objectContaining({ chapterList: ["m3", "m2", "m1"] }),
      [],
    );
  });

  it("refreshes backfilled chapters without reporting them as updates", async () => {
    const applyBackgroundSeriesRefresh = jest.fn();
    const summary = await runBackgroundUpdateSummary(
      createBackgroundDeps({
        applyBackgroundSeriesRefresh,
        getFetchChapters: jest.fn(
          () => () =>
            of({
              chapterList: ["m3", "m2-backfill", "m2", "m1"],
              chapters: {
                m1: { title: "Ch 1", href: "https://www.dm5.com/m1/" },
                m2: { title: "Ch 2", href: "https://www.dm5.com/m2/" },
                "m2-backfill": {
                  title: "Ch 2 extra",
                  href: "https://www.dm5.com/m2-backfill/",
                },
                m3: { title: "Ch 3", href: "https://www.dm5.com/m3/" },
              },
            }),
        ),
        listBackgroundRefreshCandidates: jest
          .fn()
          .mockResolvedValue([
            createRefreshCandidate(
              "dm5:m123",
              "https://www.dm5.com/m123/",
              "m3",
            ),
          ]),
      }),
    );

    expect(summary.updated).toBe(0);
    expect(applyBackgroundSeriesRefresh).toHaveBeenCalledWith(
      "dm5",
      "m123",
      expect.objectContaining({
        chapterList: ["m3", "m2-backfill", "m2", "m1"],
      }),
      [],
    );
  });

  it("times out a stalled subscription fetch and keeps processing the batch", async () => {
    const markSubscriptionCheckedByKey = jest.fn().mockResolvedValue(undefined);
    const fetchChapters = jest.fn((url: string) =>
      url.includes("m-stuck")
        ? NEVER
        : of({
            chapterList: ["m2", "m1"],
            chapters: {
              m1: { title: "Ch 1", href: "https://www.dm5.com/m-ok/1" },
              m2: { title: "Ch 2", href: "https://www.dm5.com/m-ok/2" },
            },
          }),
    );
    const applyBackgroundSeriesRefresh = jest.fn().mockResolvedValue({
      updatesCount: 1,
    });

    const summary = await runBackgroundUpdateSummary(
      createBackgroundDeps({
        applyBackgroundSeriesRefresh,
        getFetchChapters: jest.fn(() => fetchChapters),
        getUpdateCount: jest
          .fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(1),
        listBackgroundRefreshCandidates: jest
          .fn()
          .mockResolvedValue([
            createRefreshCandidate(
              "dm5:m-stuck",
              "https://www.dm5.com/m-stuck/",
            ),
            createRefreshCandidate(
              "dm5:m-ok",
              "https://www.dm5.com/m-ok/",
              "m1",
            ),
          ]),
        markSubscriptionCheckedByKey,
      }),
      {
        batchSize: 10,
        concurrency: 2,
        timeoutMs: 1,
        now: () => 999,
      },
    );

    expect(summary).toEqual({
      checked: 2,
      updated: 1,
      errors: 1,
      diff: {
        before: 0,
        after: 1,
        added: 1,
      },
    });
    expect(applyBackgroundSeriesRefresh).toHaveBeenCalledWith(
      "dm5",
      "m-ok",
      expect.objectContaining({ chapterList: ["m2", "m1"] }),
      ["m2"],
    );
    expect(markSubscriptionCheckedByKey).toHaveBeenCalledWith(
      "dm5:m-stuck",
      999,
    );
    expect(markSubscriptionCheckedByKey).toHaveBeenCalledWith("dm5:m-ok", 999);
  });

  it("handles install and update lifecycle actions", async () => {
    const resetLibrary = jest.fn();
    const setLibraryVersion = jest.fn();
    const reconcileExtensionReleaseState = jest.fn();
    const createNotification = jest.fn();
    const deps = createBackgroundDeps({
      createNotification,
      reconcileExtensionReleaseState,
      resetLibrary,
      setLibraryVersion,
    });

    await handleExtensionInstalled({ reason: "install" }, deps);
    await handleExtensionInstalled({ reason: "update" }, deps);

    expect(resetLibrary).toHaveBeenCalledTimes(1);
    expect(setLibraryVersion).toHaveBeenCalledWith("4.0.99");
    expect(reconcileExtensionReleaseState).toHaveBeenCalledWith("4.0.99");
    expect(createNotification).toHaveBeenCalledWith(
      UPDATE_NOTIFICATION_ID,
      expect.objectContaining({
        title: UPDATE_NOTIFICATION_ID,
      }),
    );
  });

  it("notifies once when a newer extension release is available", async () => {
    const createNotification = jest.fn();

    const summary = await runBackgroundReleaseCheck(
      createBackgroundDeps({
        createNotification,
        getManifestVersion: jest.fn(() => "4.1.0"),
        refreshExtensionReleaseState: jest.fn().mockResolvedValue({
          checkedAt: 123,
          latest: {
            version: "4.2.0",
            publishedAt: "2026-04-09T12:00:00.000Z",
            releaseUrl:
              "https://github.com/lemon0417/comic-scroller/releases/tag/v4.2.0",
          },
          notice: {
            latestVersion: "4.2.0",
            releaseUrl:
              "https://github.com/lemon0417/comic-scroller/releases/tag/v4.2.0",
            instructionsUrl:
              "https://lemon0417.github.io/comic-scroller/install/",
            publishedAt: "2026-04-09T12:00:00.000Z",
          },
          shouldNotify: true,
        }),
      }),
      { now: () => 123 },
    );

    expect(summary).toEqual({
      updateAvailable: true,
      latestVersion: "4.2.0",
      notified: true,
    });
    expect(createNotification).toHaveBeenCalledWith(
      "https://github.com/lemon0417/comic-scroller/releases/tag/v4.2.0",
      expect.objectContaining({
        title: "Comics Scroller 有新版本",
      }),
    );
  });

  it("rejects manual checks in non-development builds without scanning", () => {
    const runSummary = jest.fn();
    const sendResponse = jest.fn();
    expect(
      handlePingBackgroundMessage({ msg: "PING_BACKGROUND" }, sendResponse, {
        isDev: false,
        runBackgroundUpdateSummary: runSummary,
      }),
    ).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      reason: "disabled",
    });
    expect(runSummary).not.toHaveBeenCalled();
  });

  it("responds to dev ping messages with a background summary", async () => {
    const sendResponse = jest.fn();
    const runSummary = jest.fn().mockResolvedValue({ checked: 1 });

    const handled = handlePingBackgroundMessage(
      { msg: "PING_BACKGROUND" },
      sendResponse,
      {
        isDev: true,
        now: () => 123,
        runBackgroundUpdateSummary: runSummary as any,
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handled).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      at: 123,
      summary: { checked: 1 },
    });
  });

  it("responds when a dev ping background summary fails", async () => {
    const sendResponse = jest.fn();
    const runSummary = jest.fn().mockRejectedValue(new Error("boom"));

    const handled = handlePingBackgroundMessage(
      { msg: "PING_BACKGROUND" },
      sendResponse,
      {
        isDev: true,
        runBackgroundUpdateSummary: runSummary as any,
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handled).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      reason: "update-check-failed",
    });
  });

  it("resolves reader redirects and notification clicks", () => {
    const openTab = jest.fn();
    const clearNotification = jest.fn();

    const redirect = resolveReaderRedirect(
      "https://www.dm5.com/m123/",
      (path) => `chrome-extension:///${path}`,
    );
    handleNotificationClick("https://example.com/comic", {
      openTab,
      clearNotification,
    });
    handleNotificationClick(UPDATE_NOTIFICATION_ID, {
      openTab,
      clearNotification,
    });

    expect(redirect).toBe("chrome-extension:///app.html?site=dm5&chapter=m123");
    expect(openTab).toHaveBeenCalledWith({
      url: "https://example.com/comic",
    });
    expect(clearNotification).toHaveBeenCalledTimes(2);
  });

  it("only redirects supported DM5 hosts and chapter paths", () => {
    expect(
      resolveReaderRedirect(
        "https://tel.dm5.com/m1655813/",
        (path) => `chrome-extension:///${path}`,
      ),
    ).toBe("chrome-extension:///app.html?site=dm5&chapter=m1655813");

    expect(
      resolveReaderRedirect(
        "https://.dm5.com/m1655813/",
        (path) => `chrome-extension:///${path}`,
      ),
    ).toBe("");

    expect(
      resolveReaderRedirect(
        "https://www.dm5.com/manhua-demo/",
        (path) => `chrome-extension:///${path}`,
      ),
    ).toBe("");
  });

  it.each(["http", "https"])(
    "leaves retired SF URLs in the native reader (%s)",
    (protocol) => {
      expect(
        resolveReaderRedirect(`${protocol}://comic.sfacg.com/HTML/123/c1.html`),
      ).toBe("");
    },
  );

  it("does not redirect DM5 chapter links with the native-reader bypass marker", () => {
    expect(
      resolveReaderRedirect(
        "https://www.dm5.com/m1655813/?cs_open_native=1",
        (path) => `chrome-extension:///${path}`,
      ),
    ).toBe("");
  });
});
