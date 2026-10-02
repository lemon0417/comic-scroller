import {
  getImageRenderMetrics,
  getReaderHeaderHeight,
  getReaderImageRowHeight,
  READER_HEADER_HEIGHT,
  READER_IMAGE_GAP,
} from "./readerLayout";

describe("readerLayout", () => {
  it("reserves two toolbar rows only for a known narrow viewport", () => {
    expect(getReaderHeaderHeight()).toBe(48);
    expect(getReaderHeaderHeight(320)).toBe(96);
    expect(getReaderHeaderHeight(639)).toBe(96);
    expect(getReaderHeaderHeight(640)).toBe(48);
  });

  it("lays consecutive image rows out without extra scroll distance", () => {
    const first = {
      naturalWidth: 600,
      naturalHeight: 900,
      innerWidth: 768,
      innerHeight: 900,
    };
    const second = { ...first, naturalHeight: 1200 };

    expect(getReaderImageRowHeight(first)).toBe(1080);
    expect(getReaderImageRowHeight(second)).toBe(1440);
    expect(
      getReaderImageRowHeight(first) + getReaderImageRowHeight(second),
    ).toBe(2520);
    expect(getReaderImageRowHeight({ ...first, imageScale: 0.5 })).toBe(540);
  });

  it("keeps a wide image below both rows of the narrow toolbar", () => {
    const layout = getImageRenderMetrics({
      naturalWidth: 1200,
      naturalHeight: 1000,
      innerWidth: 639,
      innerHeight: 480,
    });

    expect(layout).toEqual({ width: 413, height: 344, type: "wide" });
    expect(
      getReaderImageRowHeight({
        type: "paywall",
        innerWidth: 390,
        innerHeight: 600,
      }),
    ).toBe(464);
  });

  it("caps wide image height to the viewport-aware maximum", () => {
    const layout = getImageRenderMetrics({
      type: "wide",
      naturalWidth: 1200,
      naturalHeight: 1000,
      innerWidth: 1280,
      innerHeight: 900,
    });

    expect(layout).toEqual({
      width: 974,
      height: 812,
      type: "wide",
    });
  });

  it("reserves full-screen height for paywall cards", () => {
    const layout = getImageRenderMetrics({
      type: "paywall",
      height: 0,
      innerWidth: 1024,
      innerHeight: 900,
    });

    expect(layout.height).toBe(900 - READER_HEADER_HEIGHT - 40);
    expect(layout.width).toBe(976);
    expect(layout.type).toBe("paywall");
  });

  it("scales natural image width and height", () => {
    const layout = getImageRenderMetrics({
      type: "natural",
      naturalWidth: 1000,
      naturalHeight: 2000,
      innerWidth: 1280,
      innerHeight: 900,
      imageScale: 0.5,
    });

    expect(layout).toEqual({
      width: 560,
      height: 1120,
      type: "natural",
    });
  });

  it("caps enlarged images to the viewport width", () => {
    const layout = getImageRenderMetrics({
      type: "natural",
      naturalWidth: 1000,
      naturalHeight: 1500,
      innerWidth: 1280,
      innerHeight: 900,
      imageScale: 1.25,
    });

    expect(layout.width).toBe(1280);
    expect(layout.height).toBe(1920);
  });

  it("does not scale terminal cards", () => {
    const layout = getImageRenderMetrics({
      type: "paywall",
      height: 0,
      innerWidth: 1024,
      innerHeight: 900,
      imageScale: 0.5,
    });

    expect(layout.height).toBe(900 - READER_HEADER_HEIGHT - 40);
    expect(layout.width).toBe(976);
  });

  it("uses rendered card height when calculating virtual row height", () => {
    expect(
      getReaderImageRowHeight({
        type: "paywall",
        height: 320,
        innerWidth: 1024,
        innerHeight: 900,
      }),
    ).toBe(900 - READER_HEADER_HEIGHT - 40 + READER_IMAGE_GAP * 2);
    expect(
      getReaderImageRowHeight({
        type: "end",
        height: 72,
        innerWidth: 1024,
        innerHeight: 900,
      }),
    ).toBe(72 + READER_IMAGE_GAP * 2);
  });
});
