import { useCallback, useEffect, useState } from "react";
import { connect } from "react-redux";
import MenuIcon from "@imgs/menu.svg?react";
import NextIcon from "@imgs/circle-right.svg?react";
import PrevIcon from "@imgs/circle-left.svg?react";
import TagIcon from "@imgs/tag.svg?react";
import IconButton from "@components/IconButton";
import ImageContainer from "@containers/ImageContainer";
import ChapterList from "@containers/ChapterList";
import { type ComicsState, updateSubscribe } from "@domain/reducers/comics";
import {
  getReaderSeriesState,
  subscribeToLibrarySignal,
} from "@infra/services/library/reader";
import { devLog } from "@utils/devLog";
import {
  fetchChapter,
  navigateChapter,
  startResize,
  toggleSubscribe,
} from "@domain/actions/reader";

type AppStateProps = {
  chapterList: string[];
  chapterNowIndex: number;
  chapterTitle: string;
  comicsID: string;
  nextable: boolean;
  prevable: boolean;
  seriesKey: string;
  site: string;
  subscribe: boolean;
  title: string;
  url: string;
};

type AppDispatchProps = {
  fetchChapter: typeof fetchChapter;
  navigateChapter: typeof navigateChapter;
  startResize: typeof startResize;
  toggleSubscribe: typeof toggleSubscribe;
  updateSubscribe: typeof updateSubscribe;
};

type AppProps = AppStateProps & AppDispatchProps;

function getTagIconClass(chapterTitle: string, subscribe: boolean) {
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

function App(props: AppProps) {
  const [showChapterList, setShowChapterList] = useState(false);
  const {
    chapterList,
    chapterNowIndex,
    chapterTitle,
    comicsID,
    fetchChapter: fetchChapterProp,
    navigateChapter: navigateChapterProp,
    nextable,
    prevable,
    seriesKey,
    site,
    startResize: startResizeProp,
    subscribe,
    title,
    toggleSubscribe: toggleSubscribeProp,
    updateSubscribe: updateSubscribeProp,
    url,
  } = props;

  const syncLibraryState = useCallback(async () => {
    if (!seriesKey) return;
    const { series, subscribed } = await getReaderSeriesState(seriesKey);
    if (!series) {
      chrome.tabs.getCurrent((tab) => {
        if (tab?.id) {
          chrome.tabs.remove(tab.id);
        }
      });
      return;
    }
    updateSubscribeProp(subscribed);
  }, [seriesKey, updateSubscribeProp]);

  useEffect(() => {
    startResizeProp();
  }, [startResizeProp]);

  useEffect(() => {
    void syncLibraryState();
  }, [syncLibraryState]);

  useEffect(() => {
    const unsubscribeLibrary = subscribeToLibrarySignal((signal) => {
      if (!seriesKey) return;
      if (
        signal.seriesKeys?.length &&
        !signal.seriesKeys.includes(seriesKey) &&
        !signal.scopes.includes("subscriptions")
      ) {
        return;
      }
      void syncLibraryState();
    });
    return unsubscribeLibrary;
  }, [seriesKey, syncLibraryState]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chapter = params.get("chapter") || "";
    devLog("reader:mount", {
      chapter,
      propsSite: site,
      propsComicsID: comicsID,
      propsSeriesKey: seriesKey,
      search: window.location.search,
    });
    if (chapter && fetchChapterProp) {
      fetchChapterProp(chapter);
    }
  }, [comicsID, fetchChapterProp, seriesKey, site]);

  useEffect(() => {
    const body = document.body;
    if (!(body instanceof HTMLElement)) {
      return;
    }
    if (showChapterList) {
      body.style.overflowY = "hidden";
    } else {
      body.style.removeProperty("overflow-y");
    }
    return () => {
      body.style.removeProperty("overflow-y");
    };
  }, [showChapterList]);

  const showChapterListHandler = useCallback(() => {
    setShowChapterList((prevState) => !prevState);
  }, []);

  const prevChapterHandler = useCallback(() => {
    const index = chapterNowIndex + 1;
    navigateChapterProp(index);
  }, [chapterNowIndex, navigateChapterProp]);

  const nextChapterHandler = useCallback(() => {
    const index = chapterNowIndex - 1;
    navigateChapterProp(index);
  }, [chapterNowIndex, navigateChapterProp]);

  const subscribeHandler = useCallback(() => {
    toggleSubscribeProp();
  }, [toggleSubscribeProp]);

  return (
    <div className="reader-shell">
      <header className="fixed left-0 top-0 z-[900] flex h-12 w-full items-center justify-between border-b border-comic-ink/10 bg-white/88 px-3 text-comic-ink backdrop-blur-md will-change-[scroll-position] sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <IconButton
            ariaLabel="開啟章節列表"
            onClickHandler={showChapterListHandler}
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
              href={url}
            >{`${title}`}</a>
            <span className="shrink-0 text-comic-ink/20" aria-hidden="true">
              /
            </span>
            <span className="min-w-0 shrink truncate text-[13px] text-comic-ink/60">
              {chapterList.length > 0 ? chapterTitle : "載入中..."}
            </span>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-1.5">
          <IconButton
            ariaLabel="上一章"
            disabled={!prevable}
            onClickHandler={prevable ? prevChapterHandler : undefined}
          >
            <PrevIcon className={getNavigationIconClass(prevable)} />
          </IconButton>
          <IconButton
            ariaLabel="下一章"
            disabled={!nextable}
            onClickHandler={nextable ? nextChapterHandler : undefined}
          >
            <NextIcon className={getNavigationIconClass(nextable)} />
          </IconButton>
          <IconButton
            ariaLabel={subscribe ? "取消追蹤" : "追蹤作品"}
            disabled={chapterTitle === ""}
            onClickHandler={chapterTitle !== "" ? subscribeHandler : undefined}
          >
            <TagIcon className={getTagIconClass(chapterTitle, subscribe)} />
          </IconButton>
          </div>
        </div>
      </header>
      <ImageContainer />
      <ChapterList
        show={showChapterList}
        showChapterListHandler={showChapterListHandler}
      />
    </div>
  );
}

function mapStateToProps({ comics }: { comics: ComicsState }): AppStateProps {
  const {
    title,
    chapterNowIndex,
    chapterList,
    chapters,
    subscribe,
    site,
    comicsID,
    seriesKey,
    baseURL,
  } = comics;
  const chapterID = chapterList[chapterNowIndex];
  return {
    title,
    chapterTitle:
      chapterList.length > 0 && chapters[chapterID]
        ? chapters[chapterID].title
        : "",
    site,
    chapterList,
    prevable: chapterNowIndex < chapterList.length,
    nextable: chapterNowIndex > 0,
    chapterNowIndex,
    comicsID,
    seriesKey,
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

export default connectedApp;
export { App };
