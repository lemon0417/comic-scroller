import { useCallback, useMemo, useRef } from "react";
import { connect } from "react-redux";
import {
  List,
  type RowComponentProps,
  useDynamicRowHeight,
} from "react-window";
import Loading from "@components/Loading";
import ConnectedComicImage from "@components/ComicImage";
import { updateVisibleImageRange } from "@domain/actions/reader";
import type { ComicsState } from "@domain/reducers/comics";
import {
  DEFAULT_IMAGE_HEIGHT,
  READER_HEADER_HEIGHT,
  READER_IMAGE_GAP,
} from "@domain/utils/readerLayout";

type ImageContainerProps = {
  imageListKey: string;
  imageResult: number[];
  innerHeight: number;
  updateVisibleImageRange: typeof updateVisibleImageRange;
};

type ReaderImageRowProps = {
  imageResult: number[];
};

const READER_LIST_OVERSCAN_COUNT = 6;
const READER_DEFAULT_ROW_HEIGHT = DEFAULT_IMAGE_HEIGHT + 2 * READER_IMAGE_GAP;
const EMPTY_VISIBLE_RANGE = { begin: -1, end: -1 };

function ReaderImageRow({
  ariaAttributes,
  imageResult,
  index,
  style,
}: RowComponentProps<ReaderImageRowProps>) {
  const imageIndex = imageResult[index];
  if (typeof imageIndex !== "number") {
    return null;
  }

  return (
    <div {...ariaAttributes} className="reader-image-row" style={style}>
      <ConnectedComicImage index={imageIndex} />
    </div>
  );
}

function ImageContainer({
  imageListKey,
  imageResult,
  innerHeight,
  updateVisibleImageRange: updateVisibleImageRangeProp,
}: ImageContainerProps) {
  const lastVisibleRangeRef = useRef(EMPTY_VISIBLE_RANGE);
  const rowHeights = useDynamicRowHeight({
    defaultRowHeight: READER_DEFAULT_ROW_HEIGHT,
    key: imageListKey,
  });
  const rowProps = useMemo<ReaderImageRowProps>(
    () => ({ imageResult }),
    [imageResult],
  );

  const handleRowsRendered = useCallback(
    (visibleRows: { startIndex: number; stopIndex: number }) => {
      const nextRange = {
        begin: visibleRows.startIndex,
        end: visibleRows.stopIndex,
      };
      const prevRange = lastVisibleRangeRef.current;
      if (
        prevRange.begin === nextRange.begin &&
        prevRange.end === nextRange.end
      ) {
        return;
      }
      lastVisibleRangeRef.current = nextRange;
      updateVisibleImageRangeProp(nextRange.begin, nextRange.end);
    },
    [updateVisibleImageRangeProp],
  );

  if (imageResult.length === 0) {
    return (
      <main className="reader-canvas reader-loading" aria-label="Comic pages">
        <Loading />
      </main>
    );
  }

  return (
    <List
      className="reader-canvas popup-scrollbar scrollbar-stable"
      onRowsRendered={handleRowsRendered}
      overscanCount={READER_LIST_OVERSCAN_COUNT}
      rowComponent={ReaderImageRow}
      rowCount={imageResult.length}
      rowHeight={rowHeights}
      rowProps={rowProps}
      style={{
        height: Math.max(320, innerHeight - READER_HEADER_HEIGHT),
        left: 0,
        position: "fixed",
        right: 0,
        top: READER_HEADER_HEIGHT,
        width: "100%",
      }}
    />
  );
}

function mapStateToProps({ comics }: { comics: ComicsState }) {
  const imageResult = comics.imageList.result;
  const firstImageIndex = imageResult[0];

  return {
    imageListKey:
      typeof firstImageIndex === "number"
        ? comics.imageList.entity[firstImageIndex]?.chapter || "reader-list"
        : "reader-list",
    imageResult,
    innerHeight: comics.innerHeight,
  };
}

export { ImageContainer };

export default connect(mapStateToProps, {
  updateVisibleImageRange,
})(ImageContainer);
