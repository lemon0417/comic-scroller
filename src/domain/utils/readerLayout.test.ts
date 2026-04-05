import {
  buildImageOffsetLayout,
  findImageIndexAtScrollOffset,
  READER_IMAGE_GAP,
} from "./readerLayout";

describe("readerLayout", () => {
  it("builds prefix offsets for image blocks", () => {
    const layout = buildImageOffsetLayout(
      [0, 1],
      {
        0: { height: 100, type: "image" },
        1: { height: 200, type: "image" },
      },
      1200,
      800,
    );

    expect(layout).toEqual({
      offsets: [0, 100 + 2 * READER_IMAGE_GAP, 300 + 4 * READER_IMAGE_GAP],
      totalHeight: 300 + 4 * READER_IMAGE_GAP,
    });
  });

  it("finds the current image index with binary search semantics", () => {
    const layout = buildImageOffsetLayout(
      [0, 1, 2],
      {
        0: { height: 100, type: "image" },
        1: { height: 200, type: "image" },
        2: { height: 300, type: "image" },
      },
      1200,
      800,
    );

    expect(findImageIndexAtScrollOffset(layout, 0)).toBe(0);
    expect(
      findImageIndexAtScrollOffset(layout, 100 + 2 * READER_IMAGE_GAP + 16),
    ).toBe(1);
    expect(findImageIndexAtScrollOffset(layout, 99999)).toBe(2);
  });
});
