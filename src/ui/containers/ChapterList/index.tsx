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
const CHAPTER_GRID_HORIZONTAL_PADDING = 20;
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

export class ChapterList extends Component<ChapterListProps> {
  gridApi: GridImperativeAPI | null = null;
  closeButton!: HTMLButtonElement | null;
  scrollAnimationFrame = 0;

  componentDidMount() {
    document.addEventListener("keydown", this.keydownHandler);
  }

  componentDidUpdate(prevProps: ChapterListProps) {
    if (!prevProps.show && this.props.show) {
      this.closeButton?.focus();
      this.scrollToCurrentChapter();
    }
  }

  componentWillUnmount() {
    if (this.scrollAnimationFrame) {
      window.cancelAnimationFrame(this.scrollAnimationFrame);
    }
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
    if (this.props.show && gridApi) {
      this.scrollToCurrentChapter();
    }
  };

  closeButtonRefHandler = (node: HTMLButtonElement | null) => {
    this.closeButton = node;
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

    return (
        <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(15,23,42,0.18)] px-4 py-6"
        onClick={this.onClickHandler}
        role="presentation"
      >
        <div
          className="ds-panel relative max-h-[88vh] w-full max-w-[960px] rounded-[24px]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chapter-list-title"
        >
          <div className="flex items-center justify-between gap-3 border-b border-comic-ink/10 px-5 py-4">
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
          <Grid
            cellComponent={VirtualChapterCell}
            cellProps={{
              chapterList: this.props.chapterList,
              chapters: this.props.chapters,
              columnCount: this.props.columnCount,
              currentChapterID: this.props.currentChapterID,
              getChapterClass: this.getChapterClass,
              gridWidth: this.props.gridWidth - CHAPTER_GRID_HORIZONTAL_PADDING * 2,
              onChapterSelect: this.chapterSelectHandler,
              readSet: this.props.readSet,
            }}
            className="popup-scrollbar scrollbar-stable px-5 py-5"
            columnCount={this.props.columnCount}
            columnWidth={getChapterColumnWidth}
            gridRef={this.gridRefHandler}
            overscanCount={CHAPTER_OVERSCAN_COUNT}
            rowCount={Math.ceil(
              this.props.chapterList.length / this.props.columnCount,
            )}
            rowHeight={CHAPTER_ROW_HEIGHT}
            style={{
              height: CHAPTER_LIST_HEIGHT,
              maxHeight: "calc(88vh - 73px)",
              width: this.props.gridWidth,
            }}
          />
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
