import { navigateChapter } from "@domain/actions/reader";
import type {
  ComicsChapterRecord,
  ComicsState,
} from "@domain/reducers/comics";
import { type MouseEvent, useCallback, useEffect } from "react";
import { connect } from "react-redux";
import { Grid } from "react-window";

import {
  CHAPTER_LIST_HEIGHT,
  CHAPTER_OVERSCAN_COUNT,
  CHAPTER_ROW_HEIGHT,
  getChapterColumnCount,
  getChapterGridWidth,
  useChapterGridLayout,
} from "./layout";
import { getChapterColumnWidth, VirtualChapterCell } from "./VirtualChapterCell";

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

const EMPTY_CHAPTER_LIST: string[] = [];
const EMPTY_CHAPTERS: Record<string, ComicsChapterRecord> = {};
const EMPTY_READ_SET = new Set<string>();

function ChapterList(props: ChapterListProps) {
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
        <div ref={bodyRefHandler} className="reader-chapter-dialog__body">
          <Grid
            cellComponent={VirtualChapterCell}
            cellProps={{
              chapterList,
              chapters,
              columnCount,
              currentChapterID,
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
      currentChapterRowIndex: Math.max(
        0,
        Math.floor(chapterNowIndex / columnCount),
      ),
      gridWidth: getChapterGridWidth(innerWidth),
      readSet: new Set(read),
    };
    return previousResult;
  };
}

export default connect(createChapterListStateSelector, {
  navigateChapter,
})(ChapterList);
