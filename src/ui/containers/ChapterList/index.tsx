import { Component, type MouseEvent } from "react";
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

type ChapterListComponentState = {
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

export class ChapterList extends Component<
  ChapterListProps,
  ChapterListComponentState
> {
  gridApi: GridImperativeAPI | null = null;
  bodyNode: HTMLDivElement | null = null;
  bodyResizeObserver: ResizeObserver | null = null;
  closeButton!: HTMLButtonElement | null;
  gridViewportAnimationFrame = 0;
  scrollAnimationFrame = 0;
  state: ChapterListComponentState = {
    bodyWidth: 0,
    gridViewportWidth: 0,
  };

  componentDidMount() {
    document.addEventListener("keydown", this.keydownHandler);
  }

  componentDidUpdate(prevProps: ChapterListProps) {
    if (!prevProps.show && this.props.show) {
      this.closeButton?.focus();
      this.scrollToCurrentChapter();
    }

    if (
      this.props.show &&
      (
        prevProps.show !== this.props.show ||
        prevProps.chapterList !== this.props.chapterList ||
        prevProps.columnCount !== this.props.columnCount ||
        prevProps.gridWidth !== this.props.gridWidth ||
        prevProps.currentChapterRowIndex !== this.props.currentChapterRowIndex ||
        prevProps.readSet !== this.props.readSet
      )
    ) {
      this.scheduleGridViewportSync();
    }
  }

  componentWillUnmount() {
    if (this.gridViewportAnimationFrame) {
      window.cancelAnimationFrame(this.gridViewportAnimationFrame);
    }
    if (this.scrollAnimationFrame) {
      window.cancelAnimationFrame(this.scrollAnimationFrame);
    }
    this.bodyResizeObserver?.disconnect();
    document.removeEventListener("keydown", this.keydownHandler);
  }

  onClickHandler = () => {
    this.gridApi?.scrollToCell({
      columnIndex: 0,
      rowIndex: 0,
      rowAlign: "start",
    });
    this.props.showChapterListHandler();
  };

  keydownHandler = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.props.show) {
      this.onClickHandler();
    }
  };

  gridRefHandler = (gridApi: GridImperativeAPI | null) => {
    this.gridApi = gridApi;
    this.scheduleGridViewportSync();
    if (this.props.show && gridApi) {
      this.scrollToCurrentChapter();
    }
  };

  gridResizeHandler = (size: { height: number; width: number }) => {
    const viewportWidth = Math.max(0, Math.floor(size.width));

    if (viewportWidth !== this.state.gridViewportWidth) {
      this.setState({ gridViewportWidth: viewportWidth });
    }
    this.scheduleGridViewportSync();
  };

  scheduleGridViewportSync = () => {
    if (this.gridViewportAnimationFrame) {
      window.cancelAnimationFrame(this.gridViewportAnimationFrame);
    }

    this.gridViewportAnimationFrame = window.requestAnimationFrame(() => {
      this.gridViewportAnimationFrame = 0;
      const viewportWidth = Math.max(
        0,
        Math.floor(this.gridApi?.element?.clientWidth ?? 0),
      );

      if (
        viewportWidth > 0 &&
        viewportWidth !== this.state.gridViewportWidth
      ) {
        this.setState({ gridViewportWidth: viewportWidth });
      }
    });
  };

  closeButtonRefHandler = (node: HTMLButtonElement | null) => {
    this.closeButton = node;
  };

  bodyRefHandler = (node: HTMLDivElement | null) => {
    if (this.bodyResizeObserver) {
      this.bodyResizeObserver.disconnect();
      this.bodyResizeObserver = null;
    }

    this.bodyNode = node;
    if (!node) {
      return;
    }

    this.measureBodyWidth();

    if (typeof ResizeObserver !== "undefined") {
      this.bodyResizeObserver = new ResizeObserver(() => {
        this.measureBodyWidth();
      });
      this.bodyResizeObserver.observe(node);
    }
  };

  measureBodyWidth = () => {
    if (!this.bodyNode) return;

    const styles = window.getComputedStyle(this.bodyNode);
    const paddingLeft = Number.parseFloat(styles.paddingLeft || "0");
    const paddingRight = Number.parseFloat(styles.paddingRight || "0");
    const nextBodyWidth = Math.max(
      0,
      Math.floor(this.bodyNode.clientWidth - paddingLeft - paddingRight),
    );

    if (nextBodyWidth !== this.state.bodyWidth) {
      this.setState({ bodyWidth: nextBodyWidth });
    }
  };

  chapterSelectHandler = (event: MouseEvent<HTMLButtonElement>) => {
    const index = Number(event.currentTarget.dataset.chapterIndex);
    if (!Number.isInteger(index) || index < 0) return;
    this.props.navigateChapter(index);
    this.onClickHandler();
  };

  getChapterClass(item: Pick<ChapterListItem, "current" | "read">) {
    if (item.current) {
      return "reader-chapter-item reader-chapter-item-active";
    }
    if (item.read) {
      return "reader-chapter-item reader-chapter-item-read";
    }
    return "reader-chapter-item reader-chapter-item-default";
  }

  scrollToCurrentChapter = () => {
    if (this.scrollAnimationFrame) {
      window.cancelAnimationFrame(this.scrollAnimationFrame);
    }
    this.scrollAnimationFrame = window.requestAnimationFrame(() => {
      this.scrollAnimationFrame = 0;
      this.gridApi?.scrollToCell({
        columnIndex: 0,
        rowIndex: this.props.currentChapterRowIndex,
        rowAlign: "center",
      });
    });
  };

  render() {
    if (!this.props.show) {
      return null;
    }

    const outerGridWidth =
      this.state.bodyWidth > 0 ? this.state.bodyWidth : this.props.gridWidth;
    const contentGridWidth =
      this.state.gridViewportWidth > 0
        ? this.state.gridViewportWidth
        : outerGridWidth;

    return (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(15,23,42,0.18)] px-4 py-6"
        onClick={this.onClickHandler}
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
              ref={this.closeButtonRefHandler}
              type="button"
              className="ds-btn-secondary"
              onClick={this.onClickHandler}
            >
              關閉
            </button>
          </div>
          <div
            ref={this.bodyRefHandler}
            className="reader-chapter-dialog__body"
          >
            <Grid
              cellComponent={VirtualChapterCell}
              cellProps={{
                chapterList: this.props.chapterList,
                chapters: this.props.chapters,
                columnCount: this.props.columnCount,
                currentChapterID: this.props.currentChapterID,
                getChapterClass: this.getChapterClass,
                gridWidth: contentGridWidth,
                onChapterSelect: this.chapterSelectHandler,
                readSet: this.props.readSet,
              }}
              className="popup-scrollbar"
              columnCount={this.props.columnCount}
              columnWidth={getChapterColumnWidth}
              gridRef={this.gridRefHandler}
              onResize={this.gridResizeHandler}
              overscanCount={CHAPTER_OVERSCAN_COUNT}
              rowCount={Math.ceil(
                this.props.chapterList.length / this.props.columnCount,
              )}
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
