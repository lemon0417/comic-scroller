import { Component } from "react";
import { connect } from "react-redux";
import TrashTopIcon from "@imgs/bin_top.svg?react";
import TrashBodyIcon from "@imgs/bin_body.svg?react";
import { requestRemoveCard } from "@domain/actions/popup";

declare var chrome: any;

function getComicCardClass(shift: boolean, move: boolean) {
  const base =
    "relative m-1 flex h-[180px] rounded-md border-2 border-comic-ink bg-comic-paper shadow-comic-sm transition-none opacity-100";
  if (move) {
    return `${base} transition-[transform,opacity] duration-300 ease-in-out -translate-x-[calc(100%+8px)] scale-0 opacity-0`;
  }
  if (shift) {
    return `${base} transition-transform duration-300 ease-in-out -translate-y-[calc(100%+8px)]`;
  }
  return base;
}

type Props = {
  url: string;
  category: string;
  comicsID: string;
  chapterID?: string;
  cover: string;
  title: string;
  site: string;
  index: number | string;
  move: boolean;
  shift: boolean;
  requestRemoveCard: Function;
  lastRead: {
    href: string;
    title: string;
  };
  lastChapter: {
    href: string;
    title: string;
  };
  updateChapter: {
    href: string;
    title: string;
  };
};

class ComicCard extends Component<Props> {
  pageClickHandler = () => {
    chrome.tabs.create({ url: this.props.url });
  };

  lastReadHandler = () => {
    chrome.tabs.create({ url: this.props.lastRead.href });
  };

  lastChapterHandler = () => {
    chrome.tabs.create({ url: this.props.lastChapter.href });
  };

  updateChapterHandler = () => {
    chrome.tabs.create({ url: this.props.updateChapter.href });
  };

  removeHandler = () => {
    this.props.requestRemoveCard({
      category: this.props.category,
      index: this.props.index,
      comicsID: this.props.comicsID,
      chapterID: this.props.chapterID,
      site: this.props.site,
    });
  };

  render() {
    return (
      <div
        className={getComicCardClass(this.props.shift, this.props.move)}
        data-index={this.props.index}
        data-move={this.props.move}
        data-shift={this.props.shift}
      >
        <img
          className="h-[180px] min-w-[120px] flex-none border-r-2 border-comic-ink"
          src={this.props.cover}
          alt={"cover"}
        />
        <div
          className="group absolute right-4 top-4 cursor-pointer"
          onClick={this.removeHandler}
        >
          <TrashTopIcon className="absolute right-0 top-0 fill-current text-comic-accent transition-transform duration-300 ease-in-out origin-top-left group-hover:-rotate-[20deg]" />
          <TrashBodyIcon className="absolute right-0 top-0 fill-current text-comic-ink" />
        </div>
        <div className="flex flex-1 flex-col px-3 text-comic-ink">
          <h1
            className="mr-4 font-display text-[17px] text-comic-accent cursor-pointer"
            onClick={this.pageClickHandler}
          >
            {this.props.title}
          </h1>
          <div>
            {this.props.updateChapter ? (
              <div className="text-sm leading-6">
                <span className="mr-2">更新章節</span>
                <span
                  className="mr-2 cursor-pointer text-comic-accent"
                  onClick={this.updateChapterHandler}
                >
                  {this.props.updateChapter.title}
                </span>
              </div>
            ) : undefined}
            <div className="text-sm leading-6">
              <span className="mr-2">上次看到</span>
              <span
                className="mr-2 cursor-pointer text-comic-accent"
                onClick={this.lastReadHandler}
              >
                {this.props.lastRead.title}
              </span>
            </div>
            <div className="text-sm leading-6">
              <span className="mr-2">最新一話</span>
              <span
                className="mr-2 cursor-pointer text-comic-accent"
                onClick={this.lastChapterHandler}
              >
                {this.props.lastChapter.title}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: any, ownProps: any) {
  const bucket = state.popup[ownProps.site] || {};
  const record = bucket[ownProps.comicsID];
  if (!record) {
    return {
      title: "",
      url: "",
      cover: "",
      lastRead: {},
      lastChapter: {},
    };
  }
  const { title, lastRead, cover, url, chapters, chapterList } = record;
  return {
    title,
    url,
    cover,
    lastRead: chapters[lastRead] || {},
    lastChapter:
      chapterList[0] && chapters[chapterList[0]]
        ? chapters[chapterList[0]]
        : {},
  };
}

export default connect(mapStateToProps, {
  requestRemoveCard,
})(ComicCard);
