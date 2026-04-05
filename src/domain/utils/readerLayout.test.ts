import {
  getImageRenderMetrics,
  READER_HEADER_HEIGHT,
} from "./readerLayout";

describe("readerLayout", () => {
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
});
