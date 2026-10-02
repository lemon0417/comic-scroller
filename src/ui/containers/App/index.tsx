import IconButton from "@components/IconButton";
import ChapterList from "@containers/ChapterList";
import ImageContainer from "@containers/ImageContainer";
import {
  fetchChapter,
  navigateChapter,
  toggleSubscribe,
} from "@domain/actions/reader";
import {
  adjustReaderImageScale,
  type ComicsState,
  getReaderZoomScaleForTarget,
  type ReaderZoomTarget,
  resetReaderImageScale,
  setReaderZoomTarget,
} from "@domain/reducers/comics";
import {
  getReaderHeaderHeight,
  getReaderImageScalePercent,
  READER_IMAGE_SCALE_MAX,
  READER_IMAGE_SCALE_MIN,
  READER_IMAGE_SCALE_STEP,
} from "@domain/utils/readerLayout";
import PrevIcon from "@imgs/circle-left.svg?react";
import NextIcon from "@imgs/circle-right.svg?react";
import FullscreenEnterIcon from "@imgs/fullscreen-enter.svg?react";
import FullscreenExitIcon from "@imgs/fullscreen-exit.svg?react";
import MenuIcon from "@imgs/menu.svg?react";
import TagIcon from "@imgs/tag.svg?react";
import { devLog } from "@utils/devLog";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { connect } from "react-redux";

type AppStateProps = {
  innerWidth: number;
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
  canDecreaseReaderZoom: boolean;
  canIncreaseReaderZoom: boolean;
  canUseSelectedReaderZoom: boolean;
  readerZoomPercent: number;
  readerZoomTarget: ReaderZoomTarget;
};

type AppDispatchProps = {
  adjustReaderImageScale: typeof adjustReaderImageScale;
  fetchChapter: typeof fetchChapter;
  navigateChapter: typeof navigateChapter;
  resetReaderImageScale: typeof resetReaderImageScale;
  setReaderZoomTarget: typeof setReaderZoomTarget;
  toggleSubscribe: typeof toggleSubscribe;
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

function getFullscreenIconClass(isFullscreen: boolean) {
  if (isFullscreen) {
    return "fill-current text-comic-accent transition-colors duration-150";
  }
  return "fill-current text-comic-ink/60 transition-colors duration-150";
}

function getZoomModeButtonClass(active: boolean) {
  return active
    ? "reader-zoom-mode-button reader-zoom-mode-button-active"
    : "reader-zoom-mode-button";
}

const READER_ZOOM_TOOLS_ID = "reader-zoom-tools";

function App(props: AppProps) {
  const hasFetchedInitialChapterRef = useRef(false);
  const readerZoomTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(() =>
    Boolean(document.fullscreenElement),
  );
  const [showChapterList, setShowChapterList] = useState(false);
  const [showReaderZoomTools, setShowReaderZoomTools] = useState(false);
  const {
    innerWidth = 0,
    chapterList,
    chapterNowIndex,
    chapterTitle,
    comicsID,
    adjustReaderImageScale: adjustReaderImageScaleProp = () => undefined,
    canDecreaseReaderZoom = true,
    canIncreaseReaderZoom = true,
    canUseSelectedReaderZoom = false,
    fetchChapter: fetchChapterProp,
    navigateChapter: navigateChapterProp,
    nextable,
    prevable,
    readerZoomPercent = 100,
    readerZoomTarget = "all",
    resetReaderImageScale: resetReaderImageScaleProp = () => undefined,
    seriesKey,
    site,
    setReaderZoomTarget: setReaderZoomTargetProp = () => undefined,
    subscribe,
    title,
    toggleSubscribe: toggleSubscribeProp,
    url,
  } = props;

  useEffect(() => {
    if (hasFetchedInitialChapterRef.current) {
      return;
    }
    hasFetchedInitialChapterRef.current = true;

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const closeReaderZoomTools = useCallback(() => {
    setShowReaderZoomTools(false);
    readerZoomTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!showReaderZoomTools) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeReaderZoomTools();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeReaderZoomTools, showReaderZoomTools]);

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

  const fullscreenHandler = useCallback(() => {
    if (document.fullscreenElement) {
      if (typeof document.exitFullscreen !== "function") {
        return;
      }
      void document.exitFullscreen().catch((error: unknown) => {
        devLog("reader:fullscreen-exit-failed", error);
      });
      return;
    }

    if (typeof document.documentElement.requestFullscreen !== "function") {
      return;
    }

    void document.documentElement
      .requestFullscreen()
      .catch((error: unknown) => {
        devLog("reader:fullscreen-enter-failed", error);
      });
  }, []);

  const setAllZoomTargetHandler = useCallback(() => {
    setReaderZoomTargetProp("all");
  }, [setReaderZoomTargetProp]);

  const setSelectedZoomTargetHandler = useCallback(() => {
    setReaderZoomTargetProp("selected");
  }, [setReaderZoomTargetProp]);

  const decreaseZoomHandler = useCallback(() => {
    adjustReaderImageScaleProp(-READER_IMAGE_SCALE_STEP);
  }, [adjustReaderImageScaleProp]);

  const increaseZoomHandler = useCallback(() => {
    adjustReaderImageScaleProp(READER_IMAGE_SCALE_STEP);
  }, [adjustReaderImageScaleProp]);

  const resetZoomHandler = useCallback(() => {
    resetReaderImageScaleProp(readerZoomTarget);
  }, [readerZoomTarget, resetReaderImageScaleProp]);

  const toggleReaderZoomToolsHandler = useCallback(() => {
    setShowReaderZoomTools((prevState) => !prevState);
  }, []);

  return (
    <div
      className="reader-shell"
      data-compact={innerWidth > 0 && innerWidth < 640}
      style={
        {
          "--cs-reader-header-height": `${getReaderHeaderHeight(innerWidth)}px`,
        } as CSSProperties
      }
    >
      <header className="reader-toolbar">
        <div className="reader-info">
          <IconButton
            ariaLabel="開啟章節列表"
            onClickHandler={showChapterListHandler}
          >
            <MenuIcon className="fill-current text-comic-ink/60" />
          </IconButton>
          <div className="reader-title">
            <span className="reader-brand">Comic Scroller</span>
            <span
              className="hidden h-4 w-px shrink-0 bg-comic-line lg:inline-block"
              aria-hidden="true"
            />
            <a
              className="reader-title-link"
              target="_blank"
              rel="noreferrer"
              href={url}
            >{`${title}`}</a>
            <span className="reader-title-divider" aria-hidden="true">
              /
            </span>
            <span className="reader-chapter-title">
              {chapterList.length > 0 ? chapterTitle : "載入中..."}
            </span>
          </div>
        </div>
        <div className="reader-actions">
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
          <button
            type="button"
            className="reader-zoom-trigger"
            ref={readerZoomTriggerRef}
            aria-controls={READER_ZOOM_TOOLS_ID}
            aria-expanded={showReaderZoomTools}
            onClick={toggleReaderZoomToolsHandler}
          >
            <span className="reader-zoom-trigger-label">縮放</span>
            <span className="reader-zoom-trigger-value">
              {readerZoomPercent}%
            </span>
          </button>
          {showReaderZoomTools ? (
            <div
              id={READER_ZOOM_TOOLS_ID}
              className="reader-zoom-popover"
              role="toolbar"
              aria-label="圖片縮放工具"
            >
              <button
                type="button"
                className={getZoomModeButtonClass(readerZoomTarget === "all")}
                aria-pressed={readerZoomTarget === "all"}
                onClick={setAllZoomTargetHandler}
              >
                全部
              </button>
              <button
                type="button"
                className={getZoomModeButtonClass(
                  readerZoomTarget === "selected",
                )}
                aria-pressed={readerZoomTarget === "selected"}
                disabled={!canUseSelectedReaderZoom}
                onClick={setSelectedZoomTargetHandler}
              >
                本頁
              </button>
              <IconButton
                ariaLabel="縮小圖片"
                className="reader-zoom-step"
                disabled={!canDecreaseReaderZoom}
                onClickHandler={
                  canDecreaseReaderZoom ? decreaseZoomHandler : undefined
                }
              >
                <span className="reader-zoom-step-label">-</span>
              </IconButton>
              <button
                type="button"
                className="reader-zoom-percent"
                aria-label={`重設圖片縮放，目前 ${readerZoomPercent}%`}
                onClick={resetZoomHandler}
              >
                {readerZoomPercent}%
              </button>
              <IconButton
                ariaLabel="放大圖片"
                className="reader-zoom-step"
                disabled={!canIncreaseReaderZoom}
                onClickHandler={
                  canIncreaseReaderZoom ? increaseZoomHandler : undefined
                }
              >
                <span className="reader-zoom-step-label">+</span>
              </IconButton>
              <button
                type="button"
                className="reader-zoom-close-button"
                aria-label="關閉縮放工具"
                onClick={closeReaderZoomTools}
              />
            </div>
          ) : undefined}
          <IconButton
            ariaLabel={subscribe ? "取消追蹤" : "追蹤作品"}
            disabled={chapterTitle === ""}
            onClickHandler={chapterTitle !== "" ? subscribeHandler : undefined}
          >
            <TagIcon className={getTagIconClass(chapterTitle, subscribe)} />
          </IconButton>
          <IconButton
            ariaLabel={isFullscreen ? "離開全螢幕" : "進入全螢幕"}
            onClickHandler={fullscreenHandler}
          >
            {isFullscreen ? (
              <FullscreenExitIcon
                className={getFullscreenIconClass(isFullscreen)}
              />
            ) : (
              <FullscreenEnterIcon
                className={getFullscreenIconClass(isFullscreen)}
              />
            )}
          </IconButton>
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
    currentChapterTitle,
    chapterNowIndex,
    chapterList,
    subscribe,
    site,
    comicsID,
    seriesKey,
    baseURL,
  } = comics;
  const activeReaderZoomScale = getReaderZoomScaleForTarget(comics);
  return {
    innerWidth: comics.innerWidth,
    title,
    chapterTitle: currentChapterTitle,
    site,
    chapterList,
    prevable: chapterNowIndex < chapterList.length,
    nextable: chapterNowIndex > 0,
    chapterNowIndex,
    comicsID,
    seriesKey,
    subscribe,
    url: `${baseURL}/${comicsID}`,
    canDecreaseReaderZoom: activeReaderZoomScale > READER_IMAGE_SCALE_MIN,
    canIncreaseReaderZoom: activeReaderZoomScale < READER_IMAGE_SCALE_MAX,
    canUseSelectedReaderZoom: typeof comics.selectedImageId === "number",
    readerZoomPercent: getReaderImageScalePercent(activeReaderZoomScale),
    readerZoomTarget: comics.readerZoomTarget,
  };
}

const connectedApp = connect(mapStateToProps, {
  adjustReaderImageScale,
  fetchChapter,
  navigateChapter,
  resetReaderImageScale,
  setReaderZoomTarget,
  toggleSubscribe,
})(App);

export default connectedApp;
