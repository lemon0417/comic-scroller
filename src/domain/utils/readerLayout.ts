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
