jest.mock("@infra/services/background", () => ({
  ...jest.requireActual("@infra/services/background"),
  ensureBackgroundAlarms: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@utils/buildMode", () => ({ IS_DEVELOPMENT_BUILD: false }));

describe("background navigation listener", () => {
  const addListener = jest.fn();
  const updateTab = jest.fn();

  beforeAll(() => {
    Object.assign(globalThis, {
      chrome: {
        action: { setBadgeBackgroundColor: jest.fn() },
        notifications: { onClicked: { addListener: jest.fn() } },
        runtime: {
          getURL: (path: string) => `chrome-extension://test/${path}`,
          onInstalled: { addListener: jest.fn() },
        },
        webNavigation: { onBeforeNavigate: { addListener } },
        tabs: { update: updateTab },
        alarms: { onAlarm: { addListener: jest.fn() } },
      },
    });
    jest.isolateModules(() => {
      require("./background");
    });
  });

  beforeEach(() => updateTab.mockClear());

  it.each([
    "https://www.manhuagui.com/comic/49169/910633.html",
    "https://www.manhuagui.com/comic/28004/844724.html?from=chapter#page1",
  ])("routes a matched chapter into the reader: %s", (url) => {
    const [listener, filter] = addListener.mock.calls[0];
    expect(
      filter.url.some(({ urlMatches }: { urlMatches: string }) =>
        new RegExp(urlMatches).test(url),
      ),
    ).toBe(true);
    listener({ tabId: 7, url });
    expect(updateTab).toHaveBeenCalledWith(7, {
      url: expect.stringContaining("app.html?site=manhuagui&chapter=comic%2F"),
    });
  });

  it("keeps native bypass links on the original site", () => {
    const [listener] = addListener.mock.calls[0];
    listener({
      tabId: 7,
      url: "https://www.manhuagui.com/comic/49169/910633.html?cs_open_native=1",
    });
    expect(updateTab).not.toHaveBeenCalled();
  });

  it.each([
    "https://www.baozimh.com/user/page_direct?comic_id=zhongjiedechitianshi-jiyingshe&section_slot=0&chapter_slot=0",
    "https://www.twmanga.com/comic/chapter/zhongjiedechitianshi-jiyingshe/0_0_2.html?from=reader#bottom",
  ])(
    "routes Baozimh native entrances through the registered navigation filter: %s",
    (url) => {
      const [listener, filter] = addListener.mock.calls[0];
      expect(
        filter.url.some(({ urlMatches }: { urlMatches: string }) =>
          new RegExp(urlMatches).test(url),
        ),
      ).toBe(true);
      listener({ tabId: 7, url });
      expect(updateTab).toHaveBeenCalledWith(7, {
        url: "chrome-extension://test/app.html?site=baozimh&chapter=comic%2Fchapter%2Fzhongjiedechitianshi-jiyingshe%2F0_0.html",
      });
      updateTab.mockClear();
      const nativeURL = new URL(url);
      nativeURL.searchParams.set("cs_open_native", "1");
      listener({ tabId: 7, url: nativeURL.href });
      expect(updateTab).not.toHaveBeenCalled();
    },
  );

  it.each([
    "https://www.manhuagui.com/comic/49169/",
    "https://www.manhuagui.com.evil.test/comic/49169/910633.html",
    "https://www.baozimh.com/comic/zhongjiedechitianshi-jiyingshe",
    "https://www.twmanga.com.evil.test/comic/chapter/zhongjiedechitianshi-jiyingshe/0_0.html",
  ])("does not match other URLs: %s", (url) => {
    const [, filter] = addListener.mock.calls[0];
    expect(
      filter.url.some(({ urlMatches }: { urlMatches: string }) =>
        new RegExp(urlMatches).test(url),
      ),
    ).toBe(false);
  });
});
