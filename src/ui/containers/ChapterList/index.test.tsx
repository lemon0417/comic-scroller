import { fireEvent, render, screen } from "@testing-library/react";
import { ChapterList } from "./index";

const baseProps = {
  show: true,
  chapterList: [
    { chapter: "c1", title: "第1話", read: true, current: false },
    { chapter: "c2", title: "第2話", read: true, current: true },
    { chapter: "c3", title: "第3話", read: false, current: false },
  ],
  navigateChapter: jest.fn(),
  showChapterListHandler: jest.fn(),
};

function renderChapterList(overrideProps: Partial<typeof baseProps> = {}) {
  const props = {
    ...baseProps,
    navigateChapter: jest.fn(),
    showChapterListHandler: jest.fn(),
    ...overrideProps,
  };

  const result = render(<ChapterList {...props} />);
  return {
    ...result,
    props,
  };
}

describe("ChapterList", () => {
  it("renders as an accessible dialog", () => {
    renderChapterList();

    expect(screen.getByRole("dialog", { name: "章節" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close" }),
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
});
