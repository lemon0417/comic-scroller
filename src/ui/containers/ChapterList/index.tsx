import { Component } from "react";
import { connect } from "react-redux";
import map from "lodash/map";
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
  chapterList: ChapterListItem[];
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

export class ChapterList extends Component<ChapterListProps> {
  node!: HTMLDivElement;
  closeButton!: HTMLButtonElement | null;

  componentDidMount() {
    document.addEventListener("keydown", this.keydownHandler);
  }

  componentDidUpdate(prevProps: ChapterListProps) {
    if (!prevProps.show && this.props.show) {
      this.closeButton?.focus();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.keydownHandler);
  }

  onClickHandler = () => {
    if (this.node) {
      this.node.scrollTop = 0;
    }
    this.props.showChapterListHandler();
  };

  keydownHandler = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.props.show) {
      this.onClickHandler();
    }
  };

  refHandler = (node: HTMLDivElement | null) => {
    if (!node) return;
    this.node = node;
  };

  closeButtonRefHandler = (node: HTMLButtonElement | null) => {
    this.closeButton = node;
  };

  chapterSelectHandler = (index: number) => {
    this.props.navigateChapter(index);
    this.onClickHandler();
  };

  getChapterClass(item: ChapterListItem) {
    if (item.current) {
      return "reader-chapter-item reader-chapter-item-active";
    }
    if (item.read) {
      return "reader-chapter-item reader-chapter-item-read";
    }
    return "reader-chapter-item reader-chapter-item-default";
  }

  render() {
    if (!this.props.show) {
      return null;
    }

    return (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(15,23,42,0.18)] px-4 py-6 backdrop-blur-sm"
        onClick={this.onClickHandler}
        role="presentation"
      >
        <div
          className="ds-panel relative max-h-[88vh] w-full max-w-[960px] rounded-[24px]"
          ref={this.refHandler}
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
              Close
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto px-5 py-5 popup-scrollbar scrollbar-stable">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {map(this.props.chapterList, (item, i) => (
                <button
                  type="button"
                  className={this.getChapterClass(item)}
                  key={item.chapter || i}
                  onClick={() => this.chapterSelectHandler(i)}
                >
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps({ comics }: { comics: ComicsState }): ChapterListStateProps {
  const { read, chapterList, chapters, chapterNowIndex } = comics;
  return {
    chapterList: map(chapterList, (item, index) => ({
      chapter: item,
      ...chapters[item],
      read: read.includes(item),
      current: index === chapterNowIndex,
    })),
  };
}

export default connect(mapStateToProps, {
  navigateChapter,
})(ChapterList);
