import Button, { ButtonLink } from "@components/Button";
import ConnectedComicImage from "@components/ComicImage";
import Loading from "@components/Loading";
import ReaderStateCard from "@components/ReaderStateCard";
import { fetchChapter, updateVisibleImageRange } from "@domain/actions/reader";
import {
  clearLeadingEvictionRestore,
  type ComicsState,
  getReaderImageScaleForImage,
} from "@domain/reducers/comics";
import {
  DEFAULT_IMAGE_HEIGHT,
  getReaderHeaderHeight,
  getReaderImageRowHeight,
  READER_IMAGE_GAP,
} from "@domain/utils/readerLayout";
import { getNativeChapterURL } from "@sites/registry";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { connect } from "react-redux";
import {
  List,
  type ListImperativeAPI,
  type RowComponentProps,
} from "react-window";
import { createSelector } from "reselect";

type ImageContainerProps = {
  chapterLoadStatus: ComicsState["chapterLoadStatus"];
  fetchChapter: typeof fetchChapter;
  hasPendingChapterGate: boolean;
  imageResult: number[];
  imageRowHeights?: number[];
  innerHeight: number;
  innerWidth?: number;
  leadingEvictionRestore: ComicsState["leadingEvictionRestore"];
  requestedChapter: string;
  nativeChapterURL?: string;
  clearLeadingEvictionRestore: typeof clearLeadingEvictionRestore;
  updateVisibleImageRange: typeof updateVisibleImageRange;
};

type ReaderImageRowProps = {
  hasPendingChapterGate: boolean;
  imageResult: number[];
};

const READER_LIST_OVERSCAN_COUNT = 6;
const READER_DEFAULT_ROW_HEIGHT = DEFAULT_IMAGE_HEIGHT + 2 * READER_IMAGE_GAP;
const READER_PENDING_GATE_ROW_HEIGHT = 216;
const EMPTY_VISIBLE_RANGE = { begin: -1, end: -1 };

type AnchorSnapshot = {
  imageId: number;
  top: number;
};

type AppendRangeSuppress = {
  imageListLength: number;
  startIndex: number;
};

export function getLeadingTrimStartIndex(
  prevImageResult: number[],
  nextImageResult: number[],
) {
  if (
    prevImageResult.length === 0 ||
    nextImageResult.length === 0 ||
    prevImageResult[0] === nextImageResult[0]
  ) {
    return -1;
  }
  return prevImageResult.indexOf(nextImageResult[0]);
}

export function getAppendStartIndex(
  prevImageResult: number[],
  nextImageResult: number[],
) {
  if (
    prevImageResult.length === 0 ||
    nextImageResult.length <= prevImageResult.length
  ) {
    return -1;
  }

  for (let index = 0; index < prevImageResult.length; index += 1) {
    if (prevImageResult[index] !== nextImageResult[index]) {
      return -1;
    }
  }

  return prevImageResult.length;
}

export function getReaderRowOffset(rowHeights: number[], rowIndex: number) {
  let offset = 0;
  for (let index = 0; index < rowIndex; index += 1) {
    offset += rowHeights[index] || READER_DEFAULT_ROW_HEIGHT;
  }
  return offset;
}

function getAnchorSnapshot(input: {
  imageResult: number[];
  listElement: HTMLDivElement;
  rowHeights: number[];
  visibleRange: { begin: number; end: number };
}) {
  const { imageResult, listElement, rowHeights, visibleRange } = input;
  const anchorImageId = imageResult[visibleRange.begin];
  if (typeof anchorImageId !== "number") {
    return null;
  }

  return {
    imageId: anchorImageId,
    top:
      getReaderRowOffset(rowHeights, visibleRange.begin) -
      listElement.scrollTop,
  } satisfies AnchorSnapshot;
}

function ReaderImageRow({
  ariaAttributes,
  hasPendingChapterGate,
  imageResult,
  index,
  style,
}: RowComponentProps<ReaderImageRowProps>) {
  if (hasPendingChapterGate && index === imageResult.length) {
    return (
      <div {...ariaAttributes} className="reader-image-row" style={style}>
        <div
          className="reader-page-surface reader-tail-gate-card"
          style={{ height: "100%" }}
        >
          <Loading />
        </div>
      </div>
    );
  }

  const imageIndex = imageResult[index];
  if (typeof imageIndex !== "number") {
    return null;
  }

  return (
    <div
      {...ariaAttributes}
      className="reader-image-row"
      data-image-id={imageIndex}
      style={style}
    >
      <ConnectedComicImage key={imageIndex} index={imageIndex} />
    </div>
  );
}

function ImageContainer({
  chapterLoadStatus,
  nativeChapterURL = "",
  clearLeadingEvictionRestore: clearLeadingEvictionRestoreProp,
  fetchChapter: fetchChapterProp,
  hasPendingChapterGate,
  imageResult,
  imageRowHeights,
  innerHeight,
  innerWidth = 0,
  leadingEvictionRestore,
  requestedChapter,
  updateVisibleImageRange: updateVisibleImageRangeProp,
}: ImageContainerProps) {
  const listRef = useRef<ListImperativeAPI | null>(null);
  const lastVisibleRangeRef = useRef(EMPTY_VISIBLE_RANGE);
  const prevImageResultRef = useRef(imageResult);
  const anchorSnapshotRef = useRef<AnchorSnapshot | null>(null);
  const pendingAnchorRestoreRef = useRef<AnchorSnapshot | null>(null);
  const pendingAppendRangeSuppressRef = useRef<AppendRangeSuppress | null>(
    null,
  );
  const suppressedAppendLengthRef = useRef<number | null>(null);
  const appliedEvictionRestoreSequenceRef = useRef<number | null>(null);
  const isApplyingEvictionRestoreRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const liveScrollTopRef = useRef(0);
  const imageResultRef = useRef(imageResult);
  const resolvedRowHeightsRef = useRef<number[]>([]);
  const resolvedRowHeights = useMemo(
    () =>
      imageResult.map(
        (_imageId, index) =>
          imageRowHeights?.[index] || READER_DEFAULT_ROW_HEIGHT,
      ),
    [imageResult, imageRowHeights],
  );
  const rowProps = useMemo<ReaderImageRowProps>(
    () => ({ hasPendingChapterGate, imageResult }),
    [hasPendingChapterGate, imageResult],
  );
  const getRowHeight = useCallback(
    (index: number) =>
      hasPendingChapterGate && index === imageResult.length
        ? READER_PENDING_GATE_ROW_HEIGHT
        : resolvedRowHeights[index] || READER_DEFAULT_ROW_HEIGHT,
    [hasPendingChapterGate, imageResult.length, resolvedRowHeights],
  );
  const hasImageRows = imageResult.length > 0;
  const captureScrollAnchor = useCallback(() => {
    const listElement = listRef.current?.element;
    if (!listElement) {
      return;
    }
    if (isApplyingEvictionRestoreRef.current) {
      return;
    }

    liveScrollTopRef.current = listElement.scrollTop;
    const visibleRange = lastVisibleRangeRef.current;
    if (visibleRange.begin < 0) {
      return;
    }
    const nextAnchorSnapshot = getAnchorSnapshot({
      imageResult: imageResultRef.current,
      listElement,
      rowHeights: resolvedRowHeightsRef.current,
      visibleRange,
    });
    if (nextAnchorSnapshot) {
      anchorSnapshotRef.current = nextAnchorSnapshot;
    }
  }, []);

  useLayoutEffect(() => {
    imageResultRef.current = imageResult;
    resolvedRowHeightsRef.current = resolvedRowHeights;
  }, [imageResult, resolvedRowHeights]);

  const handleRowsRendered = useCallback(
    (visibleRows: { startIndex: number; stopIndex: number }) => {
      const lastImageRowIndex = imageResult.length - 1;
      if (lastImageRowIndex < 0) {
        return;
      }
      if (
        pendingAnchorRestoreRef.current ||
        getLeadingTrimStartIndex(prevImageResultRef.current, imageResult) > 0
      ) {
        return;
      }

      const prevRange = lastVisibleRangeRef.current;
      const listElement = listRef.current?.element;
      const currentScrollTop = listElement?.scrollTop || 0;
      const hasScrolledSinceLastRange =
        Math.abs(currentScrollTop - lastScrollTopRef.current) > 1;
      const directAppendStartIndex = getAppendStartIndex(
        prevImageResultRef.current,
        imageResult,
      );
      const pendingAppendSuppress = pendingAppendRangeSuppressRef.current;
      const appendStartIndex =
        directAppendStartIndex > 0
          ? directAppendStartIndex
          : pendingAppendSuppress?.imageListLength === imageResult.length
            ? pendingAppendSuppress.startIndex
            : -1;

      if (
        appendStartIndex > 0 &&
        prevRange.begin >= 0 &&
        prevRange.end < appendStartIndex &&
        visibleRows.stopIndex >= appendStartIndex &&
        !hasScrolledSinceLastRange
      ) {
        suppressedAppendLengthRef.current = imageResult.length;
        pendingAppendRangeSuppressRef.current = null;
        return;
      }
      if (hasScrolledSinceLastRange) {
        pendingAppendRangeSuppressRef.current = null;
      }

      const nextRange = {
        begin: Math.min(lastImageRowIndex, visibleRows.startIndex),
        end: Math.min(lastImageRowIndex, visibleRows.stopIndex),
      };
      if (listElement) {
        const nextAnchorSnapshot = getAnchorSnapshot({
          imageResult,
          listElement,
          rowHeights: resolvedRowHeights,
          visibleRange: nextRange,
        });
        if (nextAnchorSnapshot) {
          anchorSnapshotRef.current = nextAnchorSnapshot;
        }
      }

      if (
        prevRange.begin === nextRange.begin &&
        prevRange.end === nextRange.end
      ) {
        return;
      }
      lastVisibleRangeRef.current = nextRange;
      lastScrollTopRef.current = currentScrollTop;
      liveScrollTopRef.current = currentScrollTop;
      updateVisibleImageRangeProp(nextRange.begin, nextRange.end);
    },
    [imageResult, resolvedRowHeights, updateVisibleImageRangeProp],
  );

  useLayoutEffect(() => {
    const appendStartIndex = getAppendStartIndex(
      prevImageResultRef.current,
      imageResult,
    );
    if (appendStartIndex > 0) {
      if (suppressedAppendLengthRef.current === imageResult.length) {
        suppressedAppendLengthRef.current = null;
      } else {
        pendingAppendRangeSuppressRef.current = {
          imageListLength: imageResult.length,
          startIndex: appendStartIndex,
        };
      }
      prevImageResultRef.current = imageResult;
      return undefined;
    }

    const trimStartIndex = getLeadingTrimStartIndex(
      prevImageResultRef.current,
      imageResult,
    );
    if (trimStartIndex <= 0) {
      prevImageResultRef.current = imageResult;
      return undefined;
    }

    const listElement = listRef.current?.element;
    const firstImageId = imageResult[0];
    const canApplyEvictionRestore =
      leadingEvictionRestore &&
      leadingEvictionRestore.firstRetainedImageId === firstImageId &&
      appliedEvictionRestoreSequenceRef.current !==
        leadingEvictionRestore.sequence;
    if (canApplyEvictionRestore && listElement) {
      const anchorSnapshot = anchorSnapshotRef.current;
      const retainedAnchorIndex = anchorSnapshot
        ? imageResult.indexOf(anchorSnapshot.imageId)
        : -1;
      pendingAnchorRestoreRef.current = anchorSnapshot;
      const restoredScrollTop =
        anchorSnapshot && retainedAnchorIndex >= 0
          ? getReaderRowOffset(resolvedRowHeights, retainedAnchorIndex) -
            anchorSnapshot.top
          : Math.max(
              0,
              (liveScrollTopRef.current || listElement.scrollTop) -
                leadingEvictionRestore.removedScrollHeight,
            );
      isApplyingEvictionRestoreRef.current = true;
      try {
        listElement.scrollTop = Math.max(0, restoredScrollTop);
        lastScrollTopRef.current = listElement.scrollTop;
        liveScrollTopRef.current = listElement.scrollTop;
        appliedEvictionRestoreSequenceRef.current =
          leadingEvictionRestore.sequence;
        pendingAppendRangeSuppressRef.current = null;
        suppressedAppendLengthRef.current = null;
        prevImageResultRef.current = imageResult;
        lastVisibleRangeRef.current = EMPTY_VISIBLE_RANGE;

        const ScrollEvent = listElement.ownerDocument.defaultView?.Event;
        if (ScrollEvent) {
          listElement.dispatchEvent(new ScrollEvent("scroll"));
        }
      } finally {
        isApplyingEvictionRestoreRef.current = false;
        pendingAnchorRestoreRef.current = null;
      }
      clearLeadingEvictionRestoreProp(leadingEvictionRestore.sequence);
      return undefined;
    }

    pendingAnchorRestoreRef.current = null;
    pendingAppendRangeSuppressRef.current = null;
    suppressedAppendLengthRef.current = null;
    prevImageResultRef.current = imageResult;
    lastVisibleRangeRef.current = EMPTY_VISIBLE_RANGE;
    return undefined;
  }, [
    clearLeadingEvictionRestoreProp,
    imageResult,
    leadingEvictionRestore,
    resolvedRowHeights,
  ]);

  useLayoutEffect(() => {
    captureScrollAnchor();
  }, [captureScrollAnchor, imageResult, resolvedRowHeights]);

  useLayoutEffect(() => {
    const listElement = listRef.current?.element;
    if (!hasImageRows || !listElement) {
      return undefined;
    }

    listElement.addEventListener("scroll", captureScrollAnchor, {
      passive: true,
    });
    return () => {
      listElement.removeEventListener("scroll", captureScrollAnchor);
    };
  }, [captureScrollAnchor, hasImageRows]);

  if (imageResult.length === 0) {
    pendingAnchorRestoreRef.current = null;
    pendingAppendRangeSuppressRef.current = null;
    suppressedAppendLengthRef.current = null;
    appliedEvictionRestoreSequenceRef.current = null;
    anchorSnapshotRef.current = null;
    lastVisibleRangeRef.current = EMPTY_VISIBLE_RANGE;
    prevImageResultRef.current = imageResult;
    liveScrollTopRef.current = 0;
  }

  if (imageResult.length === 0) {
    if (chapterLoadStatus === "failed" && requestedChapter) {
      return (
        <main className="reader-canvas reader-loading" aria-label="漫畫頁面">
          <ReaderStateCard
            title="載入失敗"
            description={
              nativeChapterURL
                ? "可開啟原站確認是否需要驗證，再回來重試。"
                : undefined
            }
          >
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="secondary"
                onClick={() => fetchChapterProp(requestedChapter)}
              >
                重試
              </Button>
              {nativeChapterURL ? (
                <ButtonLink
                  href={nativeChapterURL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  開啟原站
                </ButtonLink>
              ) : null}
            </div>
          </ReaderStateCard>
        </main>
      );
    }

    return (
      <main className="reader-canvas reader-loading" aria-label="漫畫頁面">
        <Loading />
      </main>
    );
  }

  return (
    <List
      className="reader-canvas popup-scrollbar scrollbar-stable"
      listRef={listRef}
      onRowsRendered={handleRowsRendered}
      overscanCount={READER_LIST_OVERSCAN_COUNT}
      rowComponent={ReaderImageRow}
      rowCount={imageResult.length + (hasPendingChapterGate ? 1 : 0)}
      rowHeight={getRowHeight}
      rowProps={rowProps}
      style={{
        height: Math.max(0, innerHeight - getReaderHeaderHeight(innerWidth)),
        left: 0,
        overflowAnchor: "none",
        position: "fixed",
        right: 0,
        top: getReaderHeaderHeight(innerWidth),
        width: "100%",
      }}
    />
  );
}

const selectReaderImageRowHeights = createSelector(
  [
    ({ comics }: { comics: ComicsState }) => comics.imageList.result,
    ({ comics }: { comics: ComicsState }) => comics.imageList.entity,
    ({ comics }: { comics: ComicsState }) => comics.imageScaleOverrides,
    ({ comics }: { comics: ComicsState }) => comics.readerGlobalScale,
    ({ comics }: { comics: ComicsState }) => comics.innerWidth,
    ({ comics }: { comics: ComicsState }) => comics.innerHeight,
  ],
  (
    imageResult,
    imageEntity,
    imageScaleOverrides,
    readerGlobalScale,
    innerWidth,
    innerHeight,
  ) =>
    imageResult.map((imageId) => {
      const record = imageEntity[imageId];
      if (!record) {
        return READER_DEFAULT_ROW_HEIGHT;
      }
      return getReaderImageRowHeight({
        type: record.type,
        height: record.height,
        naturalWidth: record.naturalWidth,
        naturalHeight: record.naturalHeight,
        innerWidth,
        innerHeight,
        imageScale: getReaderImageScaleForImage(
          { imageScaleOverrides, readerGlobalScale },
          imageId,
        ),
      });
    }),
);

function mapStateToProps(state: { comics: ComicsState }) {
  const { comics } = state;
  const imageResult = comics.imageList.result;

  return {
    imageResult,
    imageRowHeights: selectReaderImageRowHeights(state),
    hasPendingChapterGate: Boolean(comics.pendingChapterGate),
    innerHeight: comics.innerHeight,
    innerWidth: comics.innerWidth,
    leadingEvictionRestore: comics.leadingEvictionRestore,
    chapterLoadStatus: comics.chapterLoadStatus,
    requestedChapter: comics.requestedChapter,
    nativeChapterURL: getNativeChapterURL(comics.site, comics.requestedChapter),
  };
}

export default connect(mapStateToProps, {
  clearLeadingEvictionRestore,
  fetchChapter,
  updateVisibleImageRange,
})(ImageContainer);
