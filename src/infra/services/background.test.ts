import { NEVER, of } from "rxjs";

import {
  handleExtensionInstalled,
  handleNotificationClick,
  handlePingBackgroundMessage,
  resolveReaderRedirect,
  runBackgroundUpdateSummary,
} from "./background";

const UPDATE_NOTIFICATION_ID = "Comics Scroller Update";

describe("background service", () => {
  it("summarizes background updates and refreshes badge", async () => {
    const setBadge = jest.fn();
    const markSubscriptionCheckedByKey = jest.fn().mockResolvedValue(undefined);
    const applyBackgroundSeriesRefresh = jest.fn().mockResolvedValue({
      updatesCount: 2,
    });
    const fetchChapterPage = jest.fn(
      (_url: string, options?: { includeCover?: boolean }) =>
        of({
          title: "Demo",
          chapterList: ["m2", "m1"],
          ...(options?.includeCover ? { cover: "cover.jpg" } : {}),
          chapters: {
            m1: { title: "Ch 1", href: "https://www.dm5.com/m123//1" },
            m2: { title: "Ch 2", href: "https://www.dm5.com/m123//2" },
          },
        }),
    );

    const summary = await runBackgroundUpdateSummary({
      applyBackgroundSeriesRefresh,
      clearNotification: jest.fn(),
      createNotification: jest.fn(),
      getFetchChapterPage: jest.fn(() => fetchChapterPage),
      getManifestVersion: jest.fn(() => "4.0.99"),
      getRuntimeUrl: jest.fn((path: string) => `chrome-extension:///${path}`),
      getSeriesSnapshot: jest.fn().mockResolvedValue({
        url: "https://www.dm5.com/m123/",
        cover: "persisted-cover.jpg",
        chapters: {
          m1: { title: "Ch 1", href: "https://www.dm5.com/m123/1" },
        },
      }),
      getUpdateCount: jest
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2),
      listSubscriptionKeys: jest.fn().mockResolvedValue(["dm5:m123"]),
      markSubscriptionCheckedByKey,
      openTab: jest.fn(),
      parseSeriesKey: jest.fn(() => ({ site: "dm5", comicsID: "m123" })),
      resetLibrary: jest.fn(),
      setBadge,
      setLibraryVersion: jest.fn(),
    }, {
      batchSize: 12,
      concurrency: 2,
      timeoutMs: 3000,
      now: () => 12345,
    });

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
      expect.objectContaining({
        title: "Demo",
        url: "https://www.dm5.com/m123/",
      }),
      ["m2"],
    );
    expect(setBadge).toHaveBeenCalledWith(2);
    expect(fetchChapterPage).toHaveBeenCalledWith(
      "https://www.dm5.com/m123/",
      { includeCover: false },
    );
    expect(markSubscriptionCheckedByKey).toHaveBeenCalledWith(
      "dm5:m123",
      12345,
    );
  });

  it("times out a stalled subscription fetch and keeps processing the batch", async () => {
    const markSubscriptionCheckedByKey = jest.fn().mockResolvedValue(undefined);
    const fetchChapterPage = jest.fn((url: string) =>
      url.includes("m-stuck")
        ? NEVER
        : of({
            title: "Demo",
            chapterList: ["m2", "m1"],
            chapters: {
              m1: { title: "Ch 1", href: "https://www.dm5.com/m-ok/1" },
              m2: { title: "Ch 2", href: "https://www.dm5.com/m-ok/2" },
            },
          }),
    );
    const getSeriesSnapshot = jest
      .fn()
      .mockResolvedValueOnce({
        url: "https://www.dm5.com/m-stuck/",
        cover: "",
        chapters: {},
      })
      .mockResolvedValueOnce({
        url: "https://www.dm5.com/m-ok/",
        cover: "",
        chapters: {
          m1: { title: "Ch 1", href: "https://www.dm5.com/m-ok/1" },
        },
      });
    const applyBackgroundSeriesRefresh = jest.fn().mockResolvedValue({
      updatesCount: 1,
    });

    const summary = await runBackgroundUpdateSummary(
      {
        applyBackgroundSeriesRefresh,
        clearNotification: jest.fn(),
        createNotification: jest.fn(),
        getFetchChapterPage: jest.fn(() => fetchChapterPage),
        getManifestVersion: jest.fn(() => "4.0.99"),
        getRuntimeUrl: jest.fn((path: string) => `chrome-extension:///${path}`),
        getSeriesSnapshot,
        getUpdateCount: jest
          .fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(1),
        listSubscriptionKeys: jest
          .fn()
          .mockResolvedValue(["dm5:m-stuck", "dm5:m-ok"]),
        markSubscriptionCheckedByKey,
        openTab: jest.fn(),
        parseSeriesKey: jest.fn((seriesKey: string) => ({
          site: "dm5",
          comicsID: seriesKey.split(":")[1],
        })),
        resetLibrary: jest.fn(),
        setBadge: jest.fn(),
        setLibraryVersion: jest.fn(),
      },
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
      expect.objectContaining({
        title: "Demo",
        url: "https://www.dm5.com/m-ok/",
      }),
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
    const createNotification = jest.fn();
    const deps = {
      applyBackgroundSeriesRefresh: jest.fn(),
      clearNotification: jest.fn(),
      createNotification,
      getFetchChapterPage: jest.fn(),
      getManifestVersion: jest.fn(() => "4.0.99"),
      getRuntimeUrl: jest.fn((path: string) => `chrome-extension:///${path}`),
      getSeriesSnapshot: jest.fn(),
      getUpdateCount: jest.fn(),
      listSubscriptionKeys: jest.fn(),
      markSubscriptionCheckedByKey: jest.fn(),
      openTab: jest.fn(),
      parseSeriesKey: jest.fn(),
      resetLibrary,
      setBadge: jest.fn(),
      setLibraryVersion,
    };

    await handleExtensionInstalled({ reason: "install" }, deps);
    await handleExtensionInstalled({ reason: "update" }, deps);

    expect(resetLibrary).toHaveBeenCalledTimes(1);
    expect(setLibraryVersion).toHaveBeenCalledWith("4.0.99");
    expect(createNotification).toHaveBeenCalledWith(
      UPDATE_NOTIFICATION_ID,
      expect.objectContaining({
        title: UPDATE_NOTIFICATION_ID,
      }),
    );
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

  it("does not redirect DM5 chapter links with the native-reader bypass marker", () => {
    expect(
      resolveReaderRedirect(
        "https://www.dm5.com/m1655813/?cs_open_native=1",
        (path) => `chrome-extension:///${path}`,
      ),
    ).toBe("");
  });
});
