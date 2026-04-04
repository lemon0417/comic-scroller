import { of } from "rxjs";

function setup() {
  jest.resetModules();
  Object.defineProperty(document, "URL", {
    value: "http://example.com/?site=dm5&chapter=1",
    configurable: true,
  });
  Object.defineProperty(window, "location", {
    value: { search: "?site=dm5&chapter=1" },
    writable: true,
  });

  const { default: scrollEpic } = require("./scrollEpic");
  const { updateRenderIndex } = require("@domain/reducers/comics");
  const {
    fetchImgList,
    fetchImgSrc,
    startScroll,
    updateRead,
  } = require("@domain/actions/reader");

  return {
    scrollEpic,
    startScroll,
    updateRenderIndex,
    fetchImgSrc,
    fetchImgList,
    updateRead,
  };
}

describe("scrollEpic", () => {
  it("emits render and read updates on scroll", () => {
    jest.useFakeTimers();

    const {
      scrollEpic,
      startScroll,
      updateRenderIndex,
      fetchImgSrc,
      updateRead,
    } = setup();

    const state$ = {
      value: {
        comics: {
          imageList: {
            result: [0],
            entity: {
              0: { height: 100, type: "image", chapter: "c1" },
            },
          },
          chapterList: ["c1"],
          chapterLatestIndex: 0,
          chapterNowIndex: 1,
          renderBeginIndex: 1,
          renderEndIndex: 1,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(window, "pageYOffset", {
      value: 0,
      configurable: true,
    });

    const action$ = of(startScroll());
    const output$ = scrollEpic(action$, state$ as any);

    const actions: any[] = [];
    const subscription = output$.subscribe((action: any) =>
      actions.push(action),
    );

    document.dispatchEvent(new Event("scroll"));
    jest.runAllTimers();

    expect(actions).toEqual(
      expect.arrayContaining([
        updateRenderIndex(-6, 6),
        fetchImgSrc(-6, 6),
        updateRead(0),
      ]),
    );

    subscription.unsubscribe();
    jest.useRealTimers();
  });

  it("does not auto-preload previous chapter when the preload flag is disabled", () => {
    jest.useFakeTimers();

    const { fetchImgList, scrollEpic, startScroll } = setup();

    const state$ = {
      value: {
        comics: {
          canPreloadPreviousChapter: false,
          imageList: {
            result: [0],
            entity: {
              0: { height: 100, type: "paywall", chapter: "c2" },
            },
          },
          chapterList: ["c1", "c2"],
          chapterLatestIndex: 1,
          chapterNowIndex: 1,
          renderBeginIndex: -6,
          renderEndIndex: 6,
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    Object.defineProperty(window, "pageYOffset", {
      value: 0,
      configurable: true,
    });

    const actions: any[] = [];
    const subscription = scrollEpic(of(startScroll()), state$ as any).subscribe(
      (action: any) => actions.push(action),
    );

    document.dispatchEvent(new Event("scroll"));
    jest.runAllTimers();

    expect(actions).not.toContainEqual(fetchImgList(0));

    subscription.unsubscribe();
    jest.useRealTimers();
  });
});
