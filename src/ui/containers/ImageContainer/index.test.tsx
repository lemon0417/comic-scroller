import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";

jest.mock("react-redux", () => ({
  connect: () => (Component: unknown) => Component,
}));

import ImageContainer, {
  getAppendStartIndex,
  getLeadingTrimStartIndex,
  getReaderRowOffset,
} from "./index";

jest.mock("@components/ComicImage", () => ({
  __esModule: true,
  default: function MockComicImage({ index }: { index: number }) {
    const { useState } = jest.requireActual("react") as typeof import("react");
    const [mountedImageId] = useState(index);
    return (
      <div
        data-mounted-image-id={mountedImageId}
        data-testid={`comic-image-${index}`}
      >
        {index}
      </div>
    );
  },
}));

type ImageContainerProps = {
  chapterLoadStatus: "failed" | "idle" | "loading" | "ready";
  clearLeadingEvictionRestore: jest.Mock;
  fetchChapter: jest.Mock;
  hasPendingChapterGate: boolean;
  imageListKey: string;
  imageResult: number[];
  imageRowHeights?: number[];
  innerHeight: number;
  innerWidth?: number;
  leadingEvictionRestore: {
    sequence: number;
    firstRetainedImageId: number;
    removedScrollHeight: number;
  } | null;
  requestedChapter: string;
  nativeChapterURL?: string;
  updateVisibleImageRange: jest.Mock;
};

const TestImageContainer =
  ImageContainer as unknown as ComponentType<ImageContainerProps>;

describe("ImageContainer", () => {
  it.each([
    [390, 96, 504],
    [640, 48, 552],
    [1440, 48, 552],
  ])(
    "keeps the canvas below the toolbar at width %i",
    (innerWidth, top, height) => {
      const { container } = render(
        <TestImageContainer
          chapterLoadStatus="ready"
          clearLeadingEvictionRestore={jest.fn()}
          fetchChapter={jest.fn()}
          hasPendingChapterGate={false}
          imageListKey="reader-list"
          imageResult={[0, 1]}
          imageRowHeights={[480, 360]}
          innerHeight={600}
          innerWidth={innerWidth}
          leadingEvictionRestore={null}
          requestedChapter="m100"
          updateVisibleImageRange={jest.fn()}
        />,
      );

      expect(container.querySelector(".reader-canvas")).toHaveStyle({
        top: `${top}px`,
        height: `${height}px`,
      });
      expect(screen.getByTestId("comic-image-0")).toBeInTheDocument();
    },
  );

  it("renders a loading state when no images are available", () => {
    render(
      <TestImageContainer
        chapterLoadStatus="loading"
        clearLeadingEvictionRestore={jest.fn()}
        fetchChapter={jest.fn()}
        hasPendingChapterGate={false}
        imageListKey="reader-list"
        imageResult={[]}
        innerHeight={900}
        leadingEvictionRestore={null}
        requestedChapter="m100"
        updateVisibleImageRange={jest.fn()}
      />,
    );

    expect(screen.getByText("載入中...")).toBeInTheDocument();
  });

  it("virtualizes image rows and reports the visible range", () => {
    const updateVisibleImageRange = jest.fn();
    const imageResult = Array.from({ length: 200 }, (_, index) => index);

    render(
      <TestImageContainer
        chapterLoadStatus="ready"
        clearLeadingEvictionRestore={jest.fn()}
        fetchChapter={jest.fn()}
        hasPendingChapterGate={false}
        imageListKey="m1"
        imageResult={imageResult}
        innerHeight={900}
        leadingEvictionRestore={null}
        requestedChapter="m100"
        updateVisibleImageRange={updateVisibleImageRange}
      />,
    );

    expect(screen.getAllByTestId(/^comic-image-/).length).toBeLessThan(
      imageResult.length,
    );
    expect(updateVisibleImageRange).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("shows a retry button when the current chapter failed to load", () => {
    const fetchChapter = jest.fn();

    render(
      <TestImageContainer
        chapterLoadStatus="failed"
        clearLeadingEvictionRestore={jest.fn()}
        fetchChapter={fetchChapter}
        hasPendingChapterGate={false}
        imageListKey="reader-list"
        imageResult={[]}
        innerHeight={900}
        leadingEvictionRestore={null}
        requestedChapter="m100"
        updateVisibleImageRange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "重試" }));

    expect(screen.getByText("載入失敗")).toBeInTheDocument();
    expect(fetchChapter).toHaveBeenCalledWith("m100");
    expect(
      screen.queryByRole("link", { name: "開啟原站" }),
    ).not.toBeInTheDocument();
  });

  it("offers native verification without losing the failed chapter retry", () => {
    const fetchChapter = jest.fn();
    render(
      <TestImageContainer
        chapterLoadStatus="failed"
        clearLeadingEvictionRestore={jest.fn()}
        fetchChapter={fetchChapter}
        hasPendingChapterGate={false}
        imageListKey="reader-list"
        imageResult={[]}
        innerHeight={900}
        leadingEvictionRestore={null}
        requestedChapter="chapters/790421"
        nativeChapterURL="https://mycomic.com/chapters/790421?cs_open_native=1"
        updateVisibleImageRange={jest.fn()}
      />,
    );
    const link = screen.getByRole("link", { name: "開啟原站" });
    expect(link).toHaveAttribute(
      "href",
      "https://mycomic.com/chapters/790421?cs_open_native=1",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(screen.getByRole("button", { name: "重試" }));
    expect(fetchChapter).toHaveBeenCalledWith("chapters/790421");
  });

  it("detects leading trims only when the next list is a suffix of the previous list", () => {
    const removedStartIndex = getLeadingTrimStartIndex(
      [10, 11, 12, 13],
      [12, 13, 20, 21],
    );
    const unrelatedResetIndex = getLeadingTrimStartIndex(
      [10, 11, 12, 13],
      [50, 51, 52],
    );

    expect(removedStartIndex).toBe(2);
    expect(unrelatedResetIndex).toBe(-1);
  });

  it("detects append-only list changes", () => {
    expect(getAppendStartIndex([10, 11], [10, 11, 12, 13])).toBe(2);
    expect(getAppendStartIndex([10, 11], [10, 12, 13])).toBe(-1);
  });

  it("calculates deterministic row offsets from rendered heights", () => {
    expect(getReaderRowOffset([132, 164, 420], 0)).toBe(0);
    expect(getReaderRowOffset([132, 164, 420], 2)).toBe(296);
  });

  it("suppresses the automatic visible range expansion after appending images", () => {
    const updateVisibleImageRange = jest.fn();
    const commonProps = {
      chapterLoadStatus: "ready" as const,
      clearLeadingEvictionRestore: jest.fn(),
      fetchChapter: jest.fn(),
      hasPendingChapterGate: false,
      imageListKey: "m1",
      innerHeight: 5000,
      leadingEvictionRestore: null,
      requestedChapter: "m100",
      updateVisibleImageRange,
    };

    const { rerender } = render(
      <TestImageContainer {...commonProps} imageResult={[0]} />,
    );

    expect(updateVisibleImageRange).toHaveBeenCalledWith(0, 0);
    updateVisibleImageRange.mockClear();

    rerender(<TestImageContainer {...commonProps} imageResult={[0, 1, 2]} />);

    expect(updateVisibleImageRange).not.toHaveBeenCalledWith(0, 2);
  });

  it("compensates scroll position when leading chapters are evicted", () => {
    const clearLeadingEvictionRestore = jest.fn();
    const updateVisibleImageRange = jest.fn();
    const commonProps = {
      chapterLoadStatus: "ready" as const,
      clearLeadingEvictionRestore,
      fetchChapter: jest.fn(),
      hasPendingChapterGate: false,
      imageListKey: "m1",
      innerHeight: 900,
      requestedChapter: "m100",
      updateVisibleImageRange,
    };

    const { container, rerender } = render(
      <TestImageContainer
        {...commonProps}
        imageResult={[10, 11, 12, 13]}
        leadingEvictionRestore={null}
      />,
    );
    const listElement = container.querySelector(".reader-canvas");

    expect(listElement).toBeInstanceOf(HTMLDivElement);
    expect((listElement as HTMLDivElement).style.overflowAnchor).toBe("none");
    (listElement as HTMLDivElement).scrollTop = 900;
    const dispatchEvent = jest.spyOn(
      listElement as HTMLDivElement,
      "dispatchEvent",
    );

    rerender(
      <TestImageContainer
        {...commonProps}
        imageResult={[12, 13]}
        leadingEvictionRestore={{
          sequence: 1,
          firstRetainedImageId: 12,
          removedScrollHeight: 264,
        }}
      />,
    );

    expect((listElement as HTMLDivElement).scrollTop).toBe(636);
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "scroll" }),
    );
    expect(clearLeadingEvictionRestore).toHaveBeenCalledWith(1);
  });

  it("does not reuse image component state after leading rows are evicted", () => {
    const commonProps = {
      chapterLoadStatus: "ready" as const,
      clearLeadingEvictionRestore: jest.fn(),
      fetchChapter: jest.fn(),
      hasPendingChapterGate: false,
      imageListKey: "m1",
      imageRowHeights: [132, 132, 132, 132],
      innerHeight: 900,
      requestedChapter: "m100",
      updateVisibleImageRange: jest.fn(),
    };
    const { rerender } = render(
      <TestImageContainer
        {...commonProps}
        imageResult={[10, 11, 12, 13]}
        leadingEvictionRestore={null}
      />,
    );

    rerender(
      <TestImageContainer
        {...commonProps}
        imageResult={[12, 13]}
        imageRowHeights={[132, 132]}
        leadingEvictionRestore={{
          sequence: 1,
          firstRetainedImageId: 12,
          removedScrollHeight: 264,
        }}
      />,
    );

    expect(screen.getByTestId("comic-image-12")).toHaveAttribute(
      "data-mounted-image-id",
      "12",
    );
    expect(screen.getByTestId("comic-image-13")).toHaveAttribute(
      "data-mounted-image-id",
      "13",
    );
  });

  it("preserves a partially visible retained anchor after leading eviction", () => {
    const clearLeadingEvictionRestore = jest.fn();
    const updateVisibleImageRange = jest.fn();
    const commonProps = {
      chapterLoadStatus: "ready" as const,
      clearLeadingEvictionRestore,
      fetchChapter: jest.fn(),
      hasPendingChapterGate: false,
      imageListKey: "m1",
      innerHeight: 320,
      requestedChapter: "m100",
      updateVisibleImageRange,
    };
    const { container, rerender } = render(
      <TestImageContainer
        {...commonProps}
        imageResult={[10, 11, 12, 13]}
        imageRowHeights={[132, 132, 400, 200]}
        leadingEvictionRestore={null}
      />,
    );
    const listElement = container.querySelector(
      ".reader-canvas",
    ) as HTMLDivElement;

    listElement.scrollTop = 300;
    fireEvent.scroll(listElement);
    rerender(
      <TestImageContainer
        {...commonProps}
        imageResult={[12, 13]}
        imageRowHeights={[400, 200]}
        leadingEvictionRestore={{
          sequence: 1,
          firstRetainedImageId: 12,
          removedScrollHeight: 264,
        }}
      />,
    );

    expect(listElement.scrollTop).toBe(36);
    expect(clearLeadingEvictionRestore).toHaveBeenCalledWith(1);
  });

  it("keeps the viewport stable across consecutive leading evictions", () => {
    const clearLeadingEvictionRestore = jest.fn();
    const commonProps = {
      chapterLoadStatus: "ready" as const,
      clearLeadingEvictionRestore,
      fetchChapter: jest.fn(),
      hasPendingChapterGate: false,
      imageListKey: "m1",
      innerHeight: 900,
      requestedChapter: "m100",
      updateVisibleImageRange: jest.fn(),
    };
    const { container, rerender } = render(
      <TestImageContainer
        {...commonProps}
        imageResult={[10, 11, 12, 13, 14, 15]}
        imageRowHeights={[132, 132, 132, 132, 132, 132]}
        leadingEvictionRestore={null}
      />,
    );
    const listElement = container.querySelector(
      ".reader-canvas",
    ) as HTMLDivElement;
    listElement.scrollTop = 900;

    rerender(
      <TestImageContainer
        {...commonProps}
        imageResult={[12, 13, 14, 15]}
        imageRowHeights={[132, 132, 132, 132]}
        leadingEvictionRestore={{
          sequence: 1,
          firstRetainedImageId: 12,
          removedScrollHeight: 264,
        }}
      />,
    );
    expect(listElement.scrollTop).toBe(636);

    rerender(
      <TestImageContainer
        {...commonProps}
        imageResult={[14, 15]}
        imageRowHeights={[132, 132]}
        leadingEvictionRestore={{
          sequence: 2,
          firstRetainedImageId: 14,
          removedScrollHeight: 264,
        }}
      />,
    );

    expect(listElement.scrollTop).toBe(372);
    expect(clearLeadingEvictionRestore).toHaveBeenNthCalledWith(1, 1);
    expect(clearLeadingEvictionRestore).toHaveBeenNthCalledWith(2, 2);
  });

  it("renders a single tail loading gate without reporting it as visible content", () => {
    const updateVisibleImageRange = jest.fn();

    render(
      <TestImageContainer
        chapterLoadStatus="ready"
        clearLeadingEvictionRestore={jest.fn()}
        fetchChapter={jest.fn()}
        hasPendingChapterGate
        imageListKey="m1"
        imageResult={[0]}
        innerHeight={900}
        leadingEvictionRestore={null}
        requestedChapter="m100"
        updateVisibleImageRange={updateVisibleImageRange}
      />,
    );

    expect(screen.getByText("載入中...")).toBeInTheDocument();
    expect(updateVisibleImageRange).toHaveBeenCalledWith(0, 0);
  });

  it("keeps one scroll listener while image data changes", () => {
    const commonProps = {
      chapterLoadStatus: "ready" as const,
      clearLeadingEvictionRestore: jest.fn(),
      fetchChapter: jest.fn(),
      hasPendingChapterGate: false,
      imageListKey: "m1",
      innerHeight: 900,
      leadingEvictionRestore: null,
      requestedChapter: "m100",
      updateVisibleImageRange: jest.fn(),
    };
    const { container, rerender, unmount } = render(
      <TestImageContainer
        {...commonProps}
        imageResult={[10, 11]}
        imageRowHeights={[132, 132]}
      />,
    );
    const listElement = container.querySelector(
      ".reader-canvas",
    ) as HTMLDivElement;
    const addEventListener = jest.spyOn(listElement, "addEventListener");
    const removeEventListener = jest.spyOn(listElement, "removeEventListener");

    rerender(
      <TestImageContainer
        {...commonProps}
        imageResult={[10, 11, 12]}
        imageRowHeights={[132, 164, 200]}
      />,
    );

    expect(
      addEventListener.mock.calls.filter(
        ([event, listener]) =>
          event === "scroll" &&
          typeof listener === "function" &&
          listener.name === "captureScrollAnchor",
      ),
    ).toHaveLength(0);
    expect(
      removeEventListener.mock.calls.filter(
        ([event, listener]) =>
          event === "scroll" &&
          typeof listener === "function" &&
          listener.name === "captureScrollAnchor",
      ),
    ).toHaveLength(0);

    const removeCountBeforeUnmount = removeEventListener.mock.calls.filter(
      ([event]) => event === "scroll",
    ).length;

    unmount();

    expect(
      removeEventListener.mock.calls.filter(([event]) => event === "scroll"),
    ).toHaveLength(removeCountBeforeUnmount + 1);
    addEventListener.mockRestore();
    removeEventListener.mockRestore();
  });
});
