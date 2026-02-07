import { Component } from "react";
import { connect } from "react-redux";
import filter from "lodash/filter";
import pickBy from "lodash/pickBy";
import TrashTopIcon from "@imgs/bin_top.svg?react";
import TrashBodyIcon from "@imgs/bin_body.svg?react";
import { storageGet, storageSet } from "@infra/services/storage";
import {
  moveCard,
  removeCard,
  shiftCards,
} from "@containers/PopupApp/reducers/popup";

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
  chapterID: string;
  cover: string;
  title: string;
  site: string;
  index: number | string;
  move: boolean;
  shift: boolean;
  moveCard: Function;
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
    storageGet((store: any) => {
      let newStore: any = { update: [] };
      if (this.props.category === "history") {
        newStore = {
          history: filter(
            store.history,
            (item) => item.comicsID !== this.props.comicsID,
          ),
          subscribe: filter(
            store.subscribe,
            (item) => item.comicsID !== this.props.comicsID,
          ),
          update: filter(
            store.update,
            (item) => item.comicsID !== this.props.comicsID,
          ),
          [this.props.site]: pickBy(
            store[this.props.site],
            (_item, key) => key !== this.props.comicsID,
          ),
        };
      } else if (this.props.category === "subscribe") {
        newStore = {
          subscribe: filter(
            store.subscribe,
            (_item, i) => String(i) !== String(this.props.index),
          ),
          update: filter(
            store.update,
            (item) => item.comicsID !== this.props.comicsID,
          ),
        };
      } else if (this.props.category === "update") {
        newStore = {
          update: filter(
            store.update,
            (item) =>
              item.comicsID !== this.props.comicsID ||
              item.chapterID !== this.props.chapterID,
          ),
        };
      }
      storageSet(newStore, (err: any) => {
        if (!err) {
          chrome.action.setBadgeText({
            text: `${
              newStore.update.length === 0 ? "" : newStore.update.length
            }`,
          });
          this.props.moveCard(this.props.category, this.props.index);
          chrome.runtime.sendMessage({ msg: "UPDATE" });
        }
      });
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
  moveCard,
  shiftCards,
  removeCard,
})(ComicCard);
