import type { ComicsImageType } from "@domain/reducers/comics";

export const READER_HEADER_HEIGHT = 48;
export const READER_IMAGE_GAP = 16;
export const READER_TOP_PADDING = 24;
export const READER_BOTTOM_PADDING = 32;
export const READER_MAX_WIDTH = 1120;
export const DEFAULT_IMAGE_HEIGHT = 1400;

type ImageLayoutInput = {
  type?: ComicsImageType;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  innerWidth?: number;
  innerHeight?: number;
};

type ImageRenderMetrics = {
  height: number;
  type: ComicsImageType;
  width: number;
};

export type ImageOffsetLayout = {
  offsets: number[];
  totalHeight: number;
};

export function getReaderSidePadding(innerWidth = 0) {
  if (innerWidth >= 1280) return 32;
  if (innerWidth >= 768) return 24;
  return 12;
}

export function getReaderRailWidth(innerWidth = 0) {
  const viewportWidth = Math.max(innerWidth, 320);
  const gutter = getReaderSidePadding(viewportWidth) * 2;
  return Math.max(240, Math.min(READER_MAX_WIDTH, viewportWidth - gutter));
}

export function getWideImageMaxHeight(innerHeight = 0) {
  const viewportHeight = Math.max(innerHeight, 320);
  return Math.max(240, viewportHeight - READER_HEADER_HEIGHT - 40);
}

export function getImageRenderMetrics({
  type,
  height,
  naturalWidth,
  naturalHeight,
  innerWidth,
  innerHeight,
}: ImageLayoutInput): ImageRenderMetrics {
  const width = getReaderRailWidth(innerWidth);

  if (type === "end") {
    return {
      width,
      height: height || 72,
      type: "end",
    };
  }

  if (type === "paywall") {
    return {
      width,
      height: Math.max(height || 0, getWideImageMaxHeight(innerHeight)),
      type: "paywall",
    };
  }

  if (!naturalWidth || !naturalHeight) {
    return {
      width,
      height: height || DEFAULT_IMAGE_HEIGHT,
      type: type || "image",
    };
  }

  let renderWidth = width;
  let renderHeight = (width * naturalHeight) / naturalWidth;
  let nextType: ComicsImageType =
    naturalWidth > naturalHeight ? "wide" : "natural";

  if (naturalWidth > naturalHeight) {
    const maxHeight = getWideImageMaxHeight(innerHeight);
    if (renderHeight > maxHeight) {
      renderHeight = maxHeight;
      renderWidth = Math.min(width, (renderHeight * naturalWidth) / naturalHeight);
    }
  }

  return {
    width: Math.round(renderWidth),
    height: Math.round(renderHeight),
    type: nextType,
  };
}

export function getImageBlockHeight(
  image: ImageLayoutInput,
  innerWidth?: number,
  innerHeight?: number,
) {
  return getImageRenderMetrics({
    ...image,
    innerWidth,
    innerHeight,
  }).height;
}

export function buildImageOffsetLayout(
  result: number[],
  entity: Record<number, ImageLayoutInput | undefined>,
  innerWidth?: number,
  innerHeight?: number,
): ImageOffsetLayout {
  if (result.length === 0) {
    return {
      offsets: [0],
      totalHeight: 0,
    };
  }

  const offsets = new Array<number>(result.length + 1);
  offsets[0] = 0;

  for (let index = 0; index < result.length; index += 1) {
    offsets[index + 1] =
      offsets[index] +
      getImageBlockHeight(entity[result[index]] || {}, innerWidth, innerHeight) +
      2 * READER_IMAGE_GAP;
  }

  return {
    offsets,
    totalHeight: offsets[result.length],
  };
}

export function findImageIndexAtScrollOffset(
  layout: ImageOffsetLayout,
  scrollOffset: number,
) {
  const maxIndex = layout.offsets.length - 2;
  if (maxIndex <= 0) {
    return 0;
  }

  const targetOffset = Math.max(0, scrollOffset - READER_IMAGE_GAP);
  let begin = 0;
  let end = maxIndex;

  while (begin < end) {
    const middle = Math.floor((begin + end) / 2);
    if (layout.offsets[middle + 1] > targetOffset) {
      end = middle;
    } else {
      begin = middle + 1;
    }
  }

  return begin;
}
