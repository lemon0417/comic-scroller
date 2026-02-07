import { Component } from "react";
import { connect } from "react-redux";
import some from "lodash/some";
import MenuIcon from "@imgs/menu.svg?react";
import NextIcon from "@imgs/circle-right.svg?react";
import PrevIcon from "@imgs/circle-left.svg?react";
import TagIcon from "@imgs/tag.svg?react";
import IconButton from "@components/IconButton";
import ImageContainer from "@containers/ImageContainer";
import ChapterList from "@containers/ChapterList";
import { updateSubscribe } from "@domain/reducers/comics";
import {
  fetchChapter,
  navigateChapter,
  startResize,
  toggleSubscribe,
} from "@domain/actions/reader";
import { storageGet } from "@infra/services/storage";

declare var chrome: any;

const ImageContainerAny: any = ImageContainer;
const ChapterListAny: any = ChapterList;

function getTagIconClass(chapterTitle: any, subscribe: any) {
  if (chapterTitle === "") return "fill-current text-comic-ink/30";
  if (subscribe) return "fill-current text-comic-accent cursor-pointer";
  return "fill-current text-comic-ink cursor-pointer";
}

class App extends Component<any, any> {
  state = {
    showChapterList: false,
  };

  componentDidMount() {
    this.props.startResize();
    chrome.runtime.onMessage.addListener(() => {
      storageGet((item: any) => {
        const { subscribe, site, comicsID } = this.props;
        if (!item[this.props.site][comicsID]) {
          chrome.tabs.getCurrent((tab: { id: any }) => {
            chrome.tabs.remove(tab.id);
          });
        }
        if (
          !some(
            item.subscribe,
            (citem) => citem.site === site && citem.comicsID === comicsID,
          ) &&
          subscribe
        ) {
          this.props.updateSubscribe(false);
        }
      });
    });
    const params = new URLSearchParams(window.location.search);
    const chapter = params.get("chapter") || "";
    if (chapter && this.props.fetchChapter) {
      this.props.fetchChapter(chapter);
    }
  }

  showChapterListHandler = () => {
    const body = document.body;
    if (!(body instanceof HTMLElement)) {
      return;
    }
    if (!this.state.showChapterList) {
      body.style.overflowY = "hidden";
    } else {
      body.removeAttribute("style");
    }
    this.setState({ showChapterList: !this.state.showChapterList });
  };

  prevChapterHandler = () => {
    const index = this.props.chapterNowIndex + 1;
    this.props.navigateChapter(index);
  };

  nextChapterHandler = () => {
    const index = this.props.chapterNowIndex - 1;
    this.props.navigateChapter(index);
  };

  subscribeHandler = () => {
    this.props.toggleSubscribe();
  };

  render() {
    const { prevable, nextable, chapterTitle, subscribe } = this.props;
    return (
      <div className="min-h-screen bg-comic-paper">
        <header className="fixed left-0 top-0 z-[900] flex h-12 w-full items-center justify-between border-b-2 border-comic-ink bg-comic-paper px-3 text-comic-ink shadow-comic-sm will-change-[scroll-position]">
          <span className="flex items-center">
            <IconButton onClickHandler={this.showChapterListHandler}>
              <MenuIcon className="fill-current text-comic-ink" />
            </IconButton>
            <span className="mx-1 font-display text-[17px] uppercase tracking-[0.06em]">
              Comics Scroller
            </span>
            <a
              className="mx-1 font-display text-[15px] text-comic-accent underline decoration-[3px] decoration-comic-ink underline-offset-4"
              target="_blank"
              rel="noreferrer"
              href={this.props.url}
            >{`${this.props.title}`}</a>
            <span className="mx-1">&gt;</span>
            <span className="mx-1 font-display text-[15px]">
              {this.props.chapterList.length > 0
                ? this.props.chapterTitle
                : "Loading ..."}
            </span>
          </span>
          <span className="mr-3 flex items-center gap-1.5">
            <IconButton
              onClickHandler={prevable ? this.prevChapterHandler : undefined}
            >
              <PrevIcon
                className={
                  prevable
                    ? "fill-current text-comic-ink"
                    : "fill-current text-comic-ink/30"
                }
              />
            </IconButton>
            <IconButton
              onClickHandler={nextable ? this.nextChapterHandler : undefined}
            >
              <NextIcon
                className={
                  nextable
                    ? "fill-current text-comic-ink"
                    : "fill-current text-comic-ink/30"
                }
              />
            </IconButton>
            <IconButton
              onClickHandler={
                chapterTitle !== "" ? this.subscribeHandler : undefined
              }
            >
              <TagIcon className={getTagIconClass(chapterTitle, subscribe)} />
            </IconButton>
          </span>
        </header>
        <ImageContainerAny />
        <ChapterListAny
          show={this.state.showChapterList}
          showChapterListHandler={this.showChapterListHandler}
        />
      </div>
    );
  }
}

function mapStateToProps(state: any) {
  const {
    title,
    chapterNowIndex,
    chapterList,
    chapters,
    subscribe,
    site,
    comicsID,
    baseURL,
  } = state.comics;
  const chapterID = chapterList[chapterNowIndex];
  return {
    title,
    chapterTitle:
      chapterList.length > 0 && chapters[chapterID]
        ? chapters[chapterID].title
        : "",
    site,
    chapter:
      chapterList.length > 0 && chapters[chapterID]
        ? chapters[chapterID].chapter
        : "",
    chapterList,
    prevable: chapterNowIndex < chapterList.length,
    nextable: chapterNowIndex > 0,
    chapterNowIndex,
    comicsID,
    subscribe,
    url: `${baseURL}/${comicsID}`,
  };
}

const connectedApp = connect(mapStateToProps, {
  fetchChapter,
  startResize,
  navigateChapter,
  updateSubscribe,
  toggleSubscribe,
})(App);

export default connectedApp as any;
