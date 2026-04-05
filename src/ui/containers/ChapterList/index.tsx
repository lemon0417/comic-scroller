import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { connect } from "react-redux";
import {
  Grid,
  type CellComponentProps,
  type GridImperativeAPI,
} from "react-window";
import { navigateChapter } from "@domain/actions/reader";
import type {
  ComicsChapterRecord,
  ComicsState,
} from "@domain/reducers/comics";

type ChapterListItem = ComicsChapterRecord & {
  chapter: string;
  current: boolean;
  read: boolean;
};

type ChapterListStateProps = {
  chapterList: string[];
  chapters: Record<string, ComicsChapterRecord>;
  columnCount: number;
  currentChapterID: string;
  currentChapterRowIndex: number;
  gridWidth: number;
  readSet: Set<string>;
};

type ChapterListOwnProps = {
  show: boolean;
  showChapterListHandler: () => void;
};

type ChapterListDispatchProps = {
  navigateChapter: typeof navigateChapter;
};

type ChapterListProps = ChapterListOwnProps &
  ChapterListStateProps &
  ChapterListDispatchProps;

type ChapterGridLayoutState = {
  bodyWidth: number;
  gridViewportWidth: number;
};

type VirtualChapterCellProps = {
  chapterList: string[];
  chapters: Record<string, ComicsChapterRecord>;
  columnCount: number;
  currentChapterID: string;
  getChapterClass: (item: Pick<ChapterListItem, "current" | "read">) => string;
  gridWidth: number;
  onChapterSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  readSet: Set<string>;
};

const CHAPTER_ROW_HEIGHT = 52;
const CHAPTER_LIST_HEIGHT = 520;
const CHAPTER_OVERSCAN_COUNT = 4;
const CHAPTER_CELL_GUTTER = 8;
const CHAPTER_PANEL_MAX_WIDTH = 960;
const EMPTY_CHAPTER_LIST: string[] = [];
const EMPTY_CHAPTERS: Record<string, ComicsChapterRecord> = {};
const EMPTY_READ_SET = new Set<string>();

function getChapterColumnCount(innerWidth: number) {
  if (innerWidth >= 1024) return 3;
  if (innerWidth >= 640) return 2;
  return 1;
}

function getChapterGridWidth(innerWidth: number) {
  return Math.max(
    288,
    Math.min(CHAPTER_PANEL_MAX_WIDTH, Number(innerWidth || 0) - 32),
  );
}

function getChapterColumnWidth(_index: number, cellProps: VirtualChapterCellProps) {
  return Math.floor(cellProps.gridWidth / cellProps.columnCount);
}

function VirtualChapterCell({
  ariaAttributes,
  chapterList,
  chapters,
  columnCount,
  currentChapterID,
  columnIndex,
  getChapterClass,
  onChapterSelect,
  readSet,
  rowIndex,
  style,
}: CellComponentProps<VirtualChapterCellProps>) {
  const index = rowIndex * columnCount + columnIndex;
  const chapterID = chapterList[index];
  if (!chapterID) return null;

  const chapter = chapters[chapterID];
  const title = chapter?.title || chapterID;

  return (
    <div
      {...ariaAttributes}
      style={{
        ...style,
        paddingLeft: CHAPTER_CELL_GUTTER / 2,
        paddingRight: CHAPTER_CELL_GUTTER / 2,
        paddingTop: 4,
        paddingBottom: 4,
      }}
    >
      <button
        type="button"
        className={getChapterClass({
          current: chapterID === currentChapterID,
          read: readSet.has(chapterID),
        })}
        data-chapter-index={index}
        onClick={onChapterSelect}
      >
        <span className="truncate">{title}</span>
      </button>
    </div>
  );
}

function getChapterClass(item: Pick<ChapterListItem, "current" | "read">) {
  if (item.current) {
    return "reader-chapter-item reader-chapter-item-active";
  }
  if (item.read) {
    return "reader-chapter-item reader-chapter-item-read";
  }
  return "reader-chapter-item reader-chapter-item-default";
}

type UseChapterGridLayoutArgs = {
  show: boolean;
  currentChapterRowIndex: number;
  fallbackGridWidth: number;
  chapterList: string[];
  columnCount: number;
  readSet: Set<string>;
};

function useChapterGridLayout({
  show,
  currentChapterRowIndex,
  fallbackGridWidth,
  chapterList,
  columnCount,
  readSet,
}: UseChapterGridLayoutArgs) {
  const gridApiRef = useRef<GridImperativeAPI | null>(null);
  const bodyNodeRef = useRef<HTMLDivElement | null>(null);
  const bodyResizeObserverRef = useRef<ResizeObserver | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const gridViewportAnimationFrameRef = useRef(0);
  const scrollAnimationFrameRef = useRef(0);
  const [layoutState, setLayoutState] = useState<ChapterGridLayoutState>({
    bodyWidth: 0,
    gridViewportWidth: 0,
  });

  const syncGridViewportWidth = useCallback(() => {
    if (gridViewportAnimationFrameRef.current) {
      window.cancelAnimationFrame(gridViewportAnimationFrameRef.current);
    }

    gridViewportAnimationFrameRef.current = window.requestAnimationFrame(() => {
      gridViewportAnimationFrameRef.current = 0;
      const viewportWidth = Math.max(
        0,
        Math.floor(gridApiRef.current?.element?.clientWidth ?? 0),
      );

      if (viewportWidth > 0) {
        setLayoutState((prevState) =>
          prevState.gridViewportWidth === viewportWidth
            ? prevState
            : {
                ...prevState,
                gridViewportWidth: viewportWidth,
              },
        );
      }
    });
  }, []);

  const scrollToCurrentChapter = useCallback(() => {
    if (scrollAnimationFrameRef.current) {
      window.cancelAnimationFrame(scrollAnimationFrameRef.current);
    }

    scrollAnimationFrameRef.current = window.requestAnimationFrame(() => {
      scrollAnimationFrameRef.current = 0;
      gridApiRef.current?.scrollToCell({
        columnIndex: 0,
        rowIndex: currentChapterRowIndex,
        rowAlign: "center",
      });
    });
  }, [currentChapterRowIndex]);

  const measureBodyWidth = useCallback(() => {
    const bodyNode = bodyNodeRef.current;
    if (!bodyNode) return;

    const styles = window.getComputedStyle(bodyNode);
    const paddingLeft = Number.parseFloat(styles.paddingLeft || "0");
    const paddingRight = Number.parseFloat(styles.paddingRight || "0");
    const nextBodyWidth = Math.max(
      0,
      Math.floor(bodyNode.clientWidth - paddingLeft - paddingRight),
    );

    setLayoutState((prevState) =>
      prevState.bodyWidth === nextBodyWidth
        ? prevState
        : {
            ...prevState,
            bodyWidth: nextBodyWidth,
          },
    );
  }, []);

  const handleClose = useCallback((onClose: () => void) => {
    gridApiRef.current?.scrollToCell({
      columnIndex: 0,
      rowIndex: 0,
      rowAlign: "start",
    });
    onClose();
  }, []);

  const gridRefHandler = useCallback((gridApi: GridImperativeAPI | null) => {
    gridApiRef.current = gridApi;
    syncGridViewportWidth();
  }, [syncGridViewportWidth]);

  const gridResizeHandler = useCallback((size: { height: number; width: number }) => {
    const viewportWidth = Math.max(0, Math.floor(size.width));

    setLayoutState((prevState) => {
      if (prevState.gridViewportWidth === viewportWidth) {
        return prevState;
      }
      return {
        ...prevState,
        gridViewportWidth: viewportWidth,
      };
    });
    syncGridViewportWidth();
  }, [syncGridViewportWidth]);

  const bodyRefHandler = useCallback((node: HTMLDivElement | null) => {
    if (bodyResizeObserverRef.current) {
      bodyResizeObserverRef.current.disconnect();
      bodyResizeObserverRef.current = null;
    }

    bodyNodeRef.current = node;
    if (!node) {
      return;
    }

    measureBodyWidth();

    if (typeof ResizeObserver !== "undefined") {
      bodyResizeObserverRef.current = new ResizeObserver(() => {
        measureBodyWidth();
      });
      bodyResizeObserverRef.current.observe(node);
    }
  }, [measureBodyWidth]);

  useEffect(() => {
    if (!show) {
      return;
    }

    closeButtonRef.current?.focus();
    scrollToCurrentChapter();
  }, [show, scrollToCurrentChapter]);

  useEffect(() => {
    if (!show) {
      return;
    }

    syncGridViewportWidth();
  }, [
    chapterList,
    columnCount,
    fallbackGridWidth,
    currentChapterRowIndex,
    readSet,
    show,
    syncGridViewportWidth,
  ]);

  useEffect(() => {
    return () => {
      if (gridViewportAnimationFrameRef.current) {
        window.cancelAnimationFrame(gridViewportAnimationFrameRef.current);
      }
      if (scrollAnimationFrameRef.current) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current);
      }
      bodyResizeObserverRef.current?.disconnect();
    };
  }, []);

  const outerGridWidth =
    layoutState.bodyWidth > 0 ? layoutState.bodyWidth : fallbackGridWidth;
  const contentGridWidth =
    layoutState.gridViewportWidth > 0
      ? layoutState.gridViewportWidth
      : outerGridWidth;

  return {
    bodyRefHandler,
    closeButtonRef,
    contentGridWidth,
    gridRefHandler,
    gridResizeHandler,
    handleClose,
    outerGridWidth,
  };
}

export function ChapterList(props: ChapterListProps) {
  const {
    chapterList,
    chapters,
    columnCount,
    currentChapterID,
    currentChapterRowIndex,
    gridWidth,
    navigateChapter,
    readSet,
    show,
    showChapterListHandler,
  } = props;

  const {
    bodyRefHandler,
    closeButtonRef,
    contentGridWidth,
    gridRefHandler,
    gridResizeHandler,
    handleClose,
    outerGridWidth,
  } = useChapterGridLayout({
    show,
    currentChapterRowIndex,
    fallbackGridWidth: gridWidth,
    chapterList,
    columnCount,
    readSet,
  });

  const onClose = useCallback(() => {
    handleClose(showChapterListHandler);
  }, [handleClose, showChapterListHandler]);

  useEffect(() => {
    const keydownHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && show) {
        onClose();
      }
    };

    document.addEventListener("keydown", keydownHandler);
    return () => {
      document.removeEventListener("keydown", keydownHandler);
    };
  }, [onClose, show]);

  const chapterSelectHandler = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.dataset.chapterIndex);
      if (!Number.isInteger(index) || index < 0) return;
      navigateChapter(index);
      onClose();
    },
    [navigateChapter, onClose],
  );

  if (!show) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(15,23,42,0.18)] px-4 py-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="reader-chapter-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chapter-list-title"
      >
        <div className="reader-chapter-dialog__header">
          <h2
            id="chapter-list-title"
            className="text-[16px] font-semibold tracking-[-0.01em] text-comic-ink"
          >
            章節
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="ds-btn-secondary"
            onClick={onClose}
          >
            關閉
          </button>
        </div>
        <div
          ref={bodyRefHandler}
          className="reader-chapter-dialog__body"
        >
          <Grid
            cellComponent={VirtualChapterCell}
            cellProps={{
              chapterList,
              chapters,
              columnCount,
              currentChapterID,
              getChapterClass,
              gridWidth: contentGridWidth,
              onChapterSelect: chapterSelectHandler,
              readSet,
            }}
            className="popup-scrollbar"
            columnCount={columnCount}
            columnWidth={getChapterColumnWidth}
            gridRef={gridRefHandler}
            onResize={gridResizeHandler}
            overscanCount={CHAPTER_OVERSCAN_COUNT}
            rowCount={Math.ceil(chapterList.length / columnCount)}
            rowHeight={CHAPTER_ROW_HEIGHT}
            style={{
              height: CHAPTER_LIST_HEIGHT,
              maxHeight: "calc(88vh - 73px)",
              overflowX: "hidden",
              overflowY: "auto",
              width: outerGridWidth,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function createChapterListStateSelector() {
  let previousShow = false;
  let previousChapterList: string[] = EMPTY_CHAPTER_LIST;
  let previousChapters: Record<string, ComicsChapterRecord> = EMPTY_CHAPTERS;
  let previousChapterNowIndex = -1;
  let previousInnerWidth = 0;
  let previousRead: string[] = EMPTY_CHAPTER_LIST;
  let previousResult: ChapterListStateProps = {
    chapterList: EMPTY_CHAPTER_LIST,
    chapters: EMPTY_CHAPTERS,
    columnCount: 1,
    currentChapterID: "",
    currentChapterRowIndex: 0,
    gridWidth: getChapterGridWidth(0),
    readSet: EMPTY_READ_SET,
  };

  return function mapStateToProps(
    { comics }: { comics: ComicsState },
    ownProps: ChapterListOwnProps,
  ): ChapterListStateProps {
    if (!ownProps.show) {
      if (!previousShow) {
        return previousResult;
      }
      previousShow = false;
      previousResult = {
        chapterList: EMPTY_CHAPTER_LIST,
        chapters: EMPTY_CHAPTERS,
        columnCount: 1,
        currentChapterID: "",
        currentChapterRowIndex: 0,
        gridWidth: getChapterGridWidth(0),
        readSet: EMPTY_READ_SET,
      };
      return previousResult;
    }

    const { read, chapterList, chapters, chapterNowIndex, innerWidth } = comics;
    if (
      previousShow &&
      previousChapterList === chapterList &&
      previousChapters === chapters &&
      previousChapterNowIndex === chapterNowIndex &&
      previousInnerWidth === innerWidth &&
      previousRead === read
    ) {
      return previousResult;
    }

    const columnCount = getChapterColumnCount(innerWidth);

    previousShow = true;
    previousChapterList = chapterList;
    previousChapters = chapters;
    previousChapterNowIndex = chapterNowIndex;
    previousInnerWidth = innerWidth;
    previousRead = read;
    previousResult = {
      chapterList,
      chapters,
      columnCount,
      currentChapterID: chapterList[chapterNowIndex] || "",
      currentChapterRowIndex: Math.max(0, Math.floor(chapterNowIndex / columnCount)),
      gridWidth: getChapterGridWidth(innerWidth),
      readSet: new Set(read),
    };
    return previousResult;
  };
}

export default connect(createChapterListStateSelector, {
  navigateChapter,
})(ChapterList);
