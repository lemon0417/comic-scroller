import comics, {
  concatImageList,
  resetImg,
  updateCanPreloadPreviousChapter,
  updateComicsID,
  updateInnerHeight,
  updateInnerWidth,
  updateSiteInfo,
} from "./comics";

describe("comics reducer", () => {
  it("updates innerHeight", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const nextState = comics(prevState, updateInnerHeight(720) as any);

    expect(nextState.innerHeight).toBe(720);
  });

  it("updates innerWidth", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const nextState = comics(prevState, updateInnerWidth(1280) as any);

    expect(nextState.innerWidth).toBe(1280);
  });

  it("resets imageList on resetImg", () => {
    const seededState = {
      ...(comics(undefined, { type: "@@INIT" } as any) as any),
      imageList: {
        result: [0, 1],
        entity: {
          0: { src: "a", loading: false },
          1: { src: "b", loading: false },
        },
      },
    };

    const nextState = comics(seededState as any, resetImg() as any);

    expect(nextState.imageList).toEqual({ result: [], entity: {} });
  });

  it("builds a canonical seriesKey when site and comicsID are set", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const withSite = comics(prevState, updateSiteInfo("dm5", "https://www.dm5.com") as any);
    const nextState = comics(withSite, updateComicsID("123") as any);

    expect(nextState.seriesKey).toBe("dm5:m123");
  });

  it("keeps DM5 series slugs unchanged when building seriesKey", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const withSite = comics(
      prevState,
      updateSiteInfo("dm5", "https://www.dm5.com") as any,
    );
    const nextState = comics(
      withSite,
      updateComicsID("manhua-bailianchengshen") as any,
    );

    expect(nextState.seriesKey).toBe("dm5:manhua-bailianchengshen");
  });

  it("updates canPreloadPreviousChapter explicitly", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const nextState = comics(
      prevState,
      updateCanPreloadPreviousChapter(false) as any,
    );

    expect(nextState.canPreloadPreviousChapter).toBe(false);
  });

  it("keeps paywall placeholder images non-loading", () => {
    const prevState = comics(undefined, { type: "@@INIT" } as any) as any;
    const nextState = comics(
      prevState,
      concatImageList([
        {
          chapter: "m1655813",
          href: "https://www.dm5.com/m1655813/",
          src: "",
          type: "paywall",
        },
      ]) as any,
    );

    expect(nextState.imageList.entity[0]).toEqual(
      expect.objectContaining({
        chapter: "m1655813",
        href: "https://www.dm5.com/m1655813/",
        loading: false,
        type: "paywall",
      }),
    );
  });
});
