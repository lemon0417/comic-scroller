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
  const {
    fetchImgList,
    fetchImgSrc,
    updateRead,
    updateVisibleImageRange,
  } = require("@domain/actions/reader");

  return {
    scrollEpic,
    fetchImgSrc,
    fetchImgList,
    updateRead,
    updateVisibleImageRange,
  };
}

describe("scrollEpic", () => {
  it("emits image loading and read updates for the visible range", () => {
    const { scrollEpic, fetchImgSrc, updateRead, updateVisibleImageRange } =
      setup();

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

    const action$ = of(updateVisibleImageRange(0, 0));
    const output$ = scrollEpic(action$, state$ as any);

    const actions: any[] = [];
    const subscription = output$.subscribe((action: any) =>
      actions.push(action),
    );

    expect(actions).toEqual(
      expect.arrayContaining([
        fetchImgSrc(-6, 6),
        updateRead(0),
      ]),
    );

    subscription.unsubscribe();
  });

  it("does not auto-preload previous chapter when the preload flag is disabled", () => {
    const { fetchImgList, scrollEpic, updateVisibleImageRange } = setup();

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
          innerWidth: 1200,
          innerHeight: 800,
        },
      },
    };

    const actions: any[] = [];
    const subscription = scrollEpic(
      of(updateVisibleImageRange(0, 0)),
      state$ as any,
    ).subscribe((action: any) => actions.push(action));

    expect(actions).not.toContainEqual(fetchImgList(0));

    subscription.unsubscribe();
  });
});
