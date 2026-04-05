import { useCallback, useEffect, useRef, useState } from "react";
import type { GridImperativeAPI } from "react-window";

const CHAPTER_PANEL_MAX_WIDTH = 960;

export const CHAPTER_ROW_HEIGHT = 52;
export const CHAPTER_LIST_HEIGHT = 520;
export const CHAPTER_OVERSCAN_COUNT = 4;
export const CHAPTER_CELL_GUTTER = 8;

type ChapterGridLayoutState = {
  bodyWidth: number;
  gridViewportWidth: number;
};

type UseChapterGridLayoutArgs = {
  show: boolean;
  currentChapterRowIndex: number;
  fallbackGridWidth: number;
  chapterList: string[];
  columnCount: number;
  readSet: Set<string>;
};

export function getChapterColumnCount(innerWidth: number) {
  if (innerWidth >= 1024) return 3;
  if (innerWidth >= 640) return 2;
  return 1;
}

export function getChapterGridWidth(innerWidth: number) {
  return Math.max(
    288,
    Math.min(CHAPTER_PANEL_MAX_WIDTH, Number(innerWidth || 0) - 32),
  );
}

export function useChapterGridLayout({
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

  const gridRefHandler = useCallback(
    (gridApi: GridImperativeAPI | null) => {
      gridApiRef.current = gridApi;
      syncGridViewportWidth();
    },
    [syncGridViewportWidth],
  );

  const gridResizeHandler = useCallback(
    (size: { height: number; width: number }) => {
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
    },
    [syncGridViewportWidth],
  );

  const bodyRefHandler = useCallback(
    (node: HTMLDivElement | null) => {
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
    },
    [measureBodyWidth],
  );

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
    currentChapterRowIndex,
    fallbackGridWidth,
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
