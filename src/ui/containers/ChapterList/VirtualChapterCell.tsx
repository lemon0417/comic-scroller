import type { MouseEvent } from "react";
import type { CellComponentProps } from "react-window";
import type { ComicsChapterRecord } from "@domain/reducers/comics";
import { CHAPTER_CELL_GUTTER } from "./layout";

type VirtualChapterCellProps = {
  chapterList: string[];
  chapters: Record<string, ComicsChapterRecord>;
  columnCount: number;
  currentChapterID: string;
  onChapterSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  readSet: Set<string>;
};

function getChapterClass(current: boolean, read: boolean) {
  if (current) {
    return "reader-chapter-item reader-chapter-item-active";
  }
  if (read) {
    return "reader-chapter-item reader-chapter-item-read";
  }
  return "reader-chapter-item reader-chapter-item-default";
}

export function getChapterColumnWidth(
  _index: number,
  cellProps: Pick<VirtualChapterCellProps, "columnCount"> & {
    gridWidth: number;
  },
) {
  return Math.floor(cellProps.gridWidth / cellProps.columnCount);
}

export function VirtualChapterCell({
  ariaAttributes,
  chapterList,
  chapters,
  columnCount,
  currentChapterID,
  columnIndex,
  onChapterSelect,
  readSet,
  rowIndex,
  style,
}: CellComponentProps<VirtualChapterCellProps & { gridWidth: number }>) {
  const index = rowIndex * columnCount + columnIndex;
  const chapterID = chapterList[index];

  if (!chapterID) {
    return null;
  }

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
        className={getChapterClass(
          chapterID === currentChapterID,
          readSet.has(chapterID),
        )}
        data-chapter-index={index}
        onClick={onChapterSelect}
      >
        <span className="truncate">{title}</span>
      </button>
    </div>
  );
}
