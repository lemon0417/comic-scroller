import {
  handleExtensionInstalled,
  handleNotificationClick,
  handlePingBackgroundMessage,
  resolveReaderRedirect,
  runBackgroundUpdateSummary,
  UPDATE_NOTIFICATION_ID,
} from "./background";

describe("background service", () => {
  it("summarizes background updates and refreshes badge", async () => {
    const setBadge = jest.fn();
    const applyBackgroundSeriesRefresh = jest.fn().mockResolvedValue({
      updatesCount: 2,
    });
    const fetchChapterPage = jest.fn((_url: string, _comicsID?: string, options?: { includeCover?: boolean }) => ({
      subscribe: (next: (value: any) => void) =>
        next({
          title: "Demo",
          chapterList: ["m2", "m1"],
          ...(options?.includeCover ? { cover: "cover.jpg" } : {}),
          chapters: {
            m1: { title: "Ch 1", href: "https://www.dm5.com/m123//1" },
            m2: { title: "Ch 2", href: "https://www.dm5.com/m123//2" },
          },
        }),
    }));

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
      openTab: jest.fn(),
      parseSeriesKey: jest.fn(() => ({ site: "dm5", comicsID: "m123" })),
      resetLibrary: jest.fn(),
      setBadge,
      setLibraryVersion: jest.fn(),
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
      undefined,
      { includeCover: false },
    );
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
});
