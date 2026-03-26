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
  if (chapterTitle === "") {
    return "fill-current text-comic-ink/25 transition-colors duration-150";
  }
  if (subscribe) {
    return "fill-current text-comic-accent transition-colors duration-150";
  }
  return "fill-current text-comic-ink/60 transition-colors duration-150";
}

function getNavigationIconClass(enabled: boolean) {
  if (!enabled) {
    return "fill-current text-comic-ink/25 transition-colors duration-150";
  }
  return "fill-current text-comic-ink/60 transition-colors duration-150";
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
      <div className="reader-shell">
        <header className="fixed left-0 top-0 z-[900] flex h-12 w-full items-center justify-between border-b border-comic-ink/10 bg-white/88 px-3 text-comic-ink backdrop-blur-md will-change-[scroll-position] sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <IconButton
              ariaLabel="Open chapter list"
              onClickHandler={this.showChapterListHandler}
            >
              <MenuIcon className="fill-current text-comic-ink/60" />
            </IconButton>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              <span className="hidden shrink-0 text-[11px] font-medium text-comic-ink/40 sm:inline">
                Comic Scroller
              </span>
              <span
                className="hidden h-4 w-px shrink-0 bg-comic-ink/10 sm:inline-block"
                aria-hidden="true"
              />
              <a
                className="min-w-0 shrink truncate text-[14px] font-semibold text-comic-ink transition-colors duration-150 hover:text-comic-accent"
                target="_blank"
                rel="noreferrer"
                href={this.props.url}
              >{`${this.props.title}`}</a>
              <span className="shrink-0 text-comic-ink/20" aria-hidden="true">
                /
              </span>
              <span className="min-w-0 shrink truncate text-[13px] text-comic-ink/60">
                {this.props.chapterList.length > 0
                  ? this.props.chapterTitle
                  : "Loading..."}
              </span>
            </div>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-1.5">
            <IconButton
              ariaLabel="Go to previous chapter"
              disabled={!prevable}
              onClickHandler={prevable ? this.prevChapterHandler : undefined}
            >
              <PrevIcon className={getNavigationIconClass(prevable)} />
            </IconButton>
            <IconButton
              ariaLabel="Go to next chapter"
              disabled={!nextable}
              onClickHandler={nextable ? this.nextChapterHandler : undefined}
            >
              <NextIcon className={getNavigationIconClass(nextable)} />
            </IconButton>
            <IconButton
              ariaLabel={subscribe ? "Unfollow series" : "Follow series"}
              disabled={chapterTitle === ""}
              onClickHandler={
                chapterTitle !== "" ? this.subscribeHandler : undefined
              }
            >
              <TagIcon className={getTagIconClass(chapterTitle, subscribe)} />
            </IconButton>
          </div>
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
export { App };
