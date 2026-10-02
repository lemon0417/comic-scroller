import type { ComicsImageType } from "@domain/reducers/comics";

export const READER_HEADER_HEIGHT = 48;
export const READER_IMAGE_GAP = 0;
const READER_MAX_WIDTH = 1120;
export const DEFAULT_IMAGE_HEIGHT = 1400;
export const READER_IMAGE_SCALE_DEFAULT = 1;
export const READER_IMAGE_SCALE_MIN = 0.5;
export const READER_IMAGE_SCALE_MAX = 1.25;
export const READER_IMAGE_SCALE_STEP = 0.1;

type ImageLayoutInput = {
  type?: ComicsImageType;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  innerWidth?: number;
  innerHeight?: number;
  imageScale?: number;
};

type ImageRenderMetrics = {
  height: number;
  type: ComicsImageType;
  width: number;
};

export function getReaderHeaderHeight(innerWidth = 0) {
  return innerWidth > 0 && innerWidth < 640
    ? READER_HEADER_HEIGHT * 2
    : READER_HEADER_HEIGHT;
}

function getReaderSidePadding(innerWidth = 0) {
  if (innerWidth >= 1280) return 32;
  if (innerWidth >= 768) return 24;
  return 12;
}

function getReaderRailWidth(innerWidth = 0) {
  const viewportWidth = Math.max(innerWidth, 320);
  const gutter = getReaderSidePadding(viewportWidth) * 2;
  return Math.max(240, Math.min(READER_MAX_WIDTH, viewportWidth - gutter));
}

export function clampReaderImageScale(scale = READER_IMAGE_SCALE_DEFAULT) {
  const roundedScale = Math.round(scale * 100) / 100;
  return Math.min(
    READER_IMAGE_SCALE_MAX,
    Math.max(READER_IMAGE_SCALE_MIN, roundedScale),
  );
}

export function getReaderImageScalePercent(scale = READER_IMAGE_SCALE_DEFAULT) {
  return Math.round(clampReaderImageScale(scale) * 100);
}

function getReaderScaledRailWidth(innerWidth = 0, imageScale?: number) {
  const viewportWidth = Math.max(innerWidth, 320);
  const scaledWidth =
    getReaderRailWidth(innerWidth) * clampReaderImageScale(imageScale);
  return Math.max(120, Math.min(viewportWidth, scaledWidth));
}

function getWideImageMaxHeight(innerHeight = 0, innerWidth = 0) {
  const viewportHeight = Math.max(innerHeight, 320);
  return Math.max(240, viewportHeight - getReaderHeaderHeight(innerWidth) - 40);
}

export function getImageRenderMetrics({
  type,
  height,
  naturalWidth,
  naturalHeight,
  innerWidth,
  innerHeight,
  imageScale,
}: ImageLayoutInput): ImageRenderMetrics {
  const width = getReaderScaledRailWidth(innerWidth, imageScale);

  if (type === "end") {
    return {
      width: getReaderRailWidth(innerWidth),
      height: height || 72,
      type: "end",
    };
  }

  if (type === "paywall") {
    return {
      width: getReaderRailWidth(innerWidth),
      height: Math.max(
        height || 0,
        getWideImageMaxHeight(innerHeight, innerWidth),
      ),
      type: "paywall",
    };
  }

  if (!naturalWidth || !naturalHeight) {
    return {
      width: Math.round(width),
      height: Math.round(
        (height || DEFAULT_IMAGE_HEIGHT) * clampReaderImageScale(imageScale),
      ),
      type: type || "image",
    };
  }

  let renderWidth = width;
  let renderHeight = (width * naturalHeight) / naturalWidth;
  let nextType: ComicsImageType =
    naturalWidth > naturalHeight ? "wide" : "natural";

  if (naturalWidth > naturalHeight) {
    const maxHeight = getWideImageMaxHeight(innerHeight, innerWidth);
    if (renderHeight > maxHeight) {
      renderHeight = maxHeight;
      renderWidth = Math.min(
        width,
        (renderHeight * naturalWidth) / naturalHeight,
      );
    }
  }

  return {
    width: Math.round(renderWidth),
    height: Math.round(renderHeight),
    type: nextType,
  };
}

export function getReaderImageRowHeight(input: ImageLayoutInput) {
  return getImageRenderMetrics(input).height + READER_IMAGE_GAP * 2;
}
