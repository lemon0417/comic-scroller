import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";

jest.mock("react-redux", () => ({
  connect: () => (Component: unknown) => Component,
}));

import ChapterList from "./index";

type ChapterListProps = {
  show: boolean;
  chapterList: string[];
  chapters: Record<string, { title: string }>;
  columnCount: number;
  currentChapterID: string;
  currentChapterRowIndex: number;
  gridWidth: number;
  readSet: Set<string>;
  navigateChapter: jest.Mock;
  showChapterListHandler: jest.Mock;
};

const TestChapterList = ChapterList as unknown as ComponentType<ChapterListProps>;

const baseProps: ChapterListProps = {
  show: true,
  chapterList: ["c1", "c2", "c3"],
  chapters: {
    c1: { title: "第1話" },
    c2: { title: "第2話" },
    c3: { title: "第3話" },
  },
  columnCount: 2,
  currentChapterID: "c2",
  currentChapterRowIndex: 0,
  gridWidth: 640,
  readSet: new Set(["c1", "c2"]),
  navigateChapter: jest.fn(),
  showChapterListHandler: jest.fn(),
};

function renderChapterList(overrideProps: Partial<ChapterListProps> = {}) {
  const props = {
    ...baseProps,
    navigateChapter: jest.fn(),
    showChapterListHandler: jest.fn(),
    ...overrideProps,
  };

  const result = render(<TestChapterList {...props} />);
  return {
    ...result,
    props,
  };
}

describe("ChapterList", () => {
  it("does not render the dialog while hidden", () => {
    renderChapterList({ show: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders as an accessible dialog", () => {
    renderChapterList();

    expect(screen.getByRole("dialog", { name: "章節" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "關閉" }),
    ).toBeInTheDocument();
  });

  it("navigates and closes when selecting a chapter", () => {
    const { props } = renderChapterList();

    fireEvent.click(screen.getByRole("button", { name: "第3話" }));

    expect(props.navigateChapter).toHaveBeenCalledWith(2);
    expect(props.showChapterListHandler).toHaveBeenCalled();
  });

  it("shows current and read chapter states", () => {
    renderChapterList();

    expect(screen.getByRole("button", { name: "第1話" })).toHaveClass(
      "reader-chapter-item-read",
    );
    expect(screen.getByRole("button", { name: "第2話" })).toHaveClass(
      "reader-chapter-item-active",
    );
    expect(screen.getByRole("button", { name: "第3話" })).toHaveClass(
      "reader-chapter-item-default",
    );
  });

  it("closes on Escape when visible", () => {
    const { props } = renderChapterList();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(props.showChapterListHandler).toHaveBeenCalled();
  });

  it("virtualizes large chapter lists instead of mounting every chapter button", () => {
    renderChapterList({
      chapterList: Array.from({ length: 1200 }, (_item, index) => `c${index + 1}`),
      chapters: Array.from({ length: 1200 }, (_item, index) => `c${index + 1}`).reduce(
        (acc, chapterID, index) => ({
          ...acc,
          [chapterID]: {
            title: `第${index + 1}話`,
          },
        }),
        {},
      ),
      currentChapterID: "c31",
      currentChapterRowIndex: 10,
      columnCount: 3,
      gridWidth: 960,
      readSet: new Set(Array.from({ length: 20 }, (_item, index) => `c${index + 1}`)),
    });

    expect(screen.getByRole("button", { name: "第1話" })).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /^第\d+話$/ }).length).toBeLessThan(
      1200,
    );
  });
});
