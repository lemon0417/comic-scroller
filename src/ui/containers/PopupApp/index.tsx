import React, { Component } from "react";
import { connect } from "react-redux";
import map from "lodash/map";
import MoreIcon from "@imgs/more_vert.svg?react";
import ComicCard from "@components/ComicCard";
import ripple from "@components/Ripple";
import { clearExportConfig, shiftCards } from "./reducers/popup";
import filter from "lodash/filter";
import {
  requestExportConfig,
  requestImportConfig,
  requestPopupData,
  requestResetConfig,
} from "@domain/actions/popup";

declare var chrome: any;
const isDev = import.meta.env.MODE !== "production";

const headerContainerClass =
  "relative z-[100] flex border-b-2 border-comic-ink bg-comic-paper shadow-comic-sm";
const buttonClass =
  "relative flex h-12 w-8 items-center justify-center border-l-2 border-comic-ink bg-comic-paper2 cursor-pointer self-stretch";
const rippleContainerClass = "absolute inset-0 overflow-hidden";
const menuBaseClass =
  "absolute right-2 top-[52px] z-[200] w-[180px] origin-top rounded-md border-2 border-comic-ink bg-comic-paper shadow-comic-sm transition-[transform,opacity] duration-[160ms] ease-in-out";
const menuItemClass =
  "h-9 text-center font-display text-[13px] uppercase tracking-[0.1em] leading-9 text-comic-ink hover:bg-comic-accent hover:text-white";
const headerClass =
  "relative z-[100] flex h-12 w-[calc(100vw-32px)] leading-[48px]";
const tabBaseClass =
  "relative w-[calc((100vw-32px)/3)] cursor-pointer overflow-hidden text-center font-display text-[15px] uppercase tracking-[0.14em] text-comic-ink transition-colors duration-150 hover:text-comic-accent";
const tabActiveClass = `${tabBaseClass} text-comic-accent`;
const shiftMarkerBaseClass =
  "absolute bottom-0 left-0 h-1 w-[calc((100vw-32px)/3)] bg-comic-accent transition-transform duration-[330ms] ease-in-out";
const shiftMarkerLeftClass = `${shiftMarkerBaseClass} translate-x-0`;
const shiftMarkerMidClass = `${shiftMarkerBaseClass} translate-x-full`;
const shiftMarkerRightClass = `${shiftMarkerBaseClass} translate-x-[200%]`;
const cardContainerBaseClass =
  "absolute top-12 flex h-[calc(100vh-48px)] overflow-x-hidden overflow-y-auto bg-comic-paper transition-transform duration-[330ms] ease-in-out popup-scrollbar";
const cardContainerLeftClass = `${cardContainerBaseClass} translate-x-0`;
const cardContainerMidClass = `${cardContainerBaseClass} -translate-x-[500px]`;
const cardContainerRightClass = `${cardContainerBaseClass} -translate-x-[1000px]`;
const cardColumnClass =
  "h-[calc(100vh-48px)] w-[500px] flex-none overflow-y-auto px-1 py-1";

function stopImmediatePropagation(e: any) {
  e.stopPropagation();
  e.nativeEvent.stopImmediatePropagation();
}

function preventDefault(e: any) {
  e.preventDefault();
}

function getShiftMarkerClass(
  selectedType: "update" | "subscribe" | "history",
): string {
  switch (selectedType) {
    case "update":
      return shiftMarkerLeftClass;
    case "subscribe":
      return shiftMarkerMidClass;
    case "history":
      return shiftMarkerRightClass;
    default:
      return shiftMarkerLeftClass;
  }
}

function getContainerClass(
  selectedType: "update" | "subscribe" | "history",
): string {
  switch (selectedType) {
    case "update":
      return cardContainerLeftClass;
    case "subscribe":
      return cardContainerMidClass;
    case "history":
      return cardContainerRightClass;
    default:
      return cardContainerLeftClass;
  }
}

const Tab = ({
  className,
  children,
  type,
  onMouseDownHandler,
}: {
  className: string;
  children?: any;
  type: string;
  onMouseDownHandler?: React.MouseEventHandler<HTMLSpanElement>;
}) => (
  <span className={className} onMouseDown={onMouseDownHandler}>
    <div data-type={type}>{type}</div>
    {children}
  </span>
);

const RippleTab = ripple(Tab);

const MenuButton = ({
  children,
  showMenu,
  showMenuHandler,
  onMouseDownHandler,
  downloadHandler,
  uploadHandler,
  resetHandler,
  backgroundCheckHandler,
  showBackgroundCheck,
  aRefHandler,
  inputRefHandler,
  fileOnChangeHandler,
}: {
  children?: any;
  showMenu: boolean;
  showMenuHandler: React.MouseEventHandler<HTMLSpanElement>;
  onMouseDownHandler?: React.MouseEventHandler<HTMLSpanElement>;
  downloadHandler: React.MouseEventHandler<HTMLDivElement>;
  uploadHandler: React.MouseEventHandler<HTMLDivElement>;
  resetHandler: React.MouseEventHandler<HTMLDivElement>;
  backgroundCheckHandler: React.MouseEventHandler<HTMLDivElement>;
  showBackgroundCheck?: boolean;
  aRefHandler: React.Ref<HTMLAnchorElement>;
  inputRefHandler: React.Ref<HTMLInputElement>;
  fileOnChangeHandler: React.ChangeEventHandler<HTMLInputElement>;
}) => (
  <span
    className={buttonClass}
    onClick={showMenuHandler}
    onMouseDown={onMouseDownHandler}
  >
    <MoreIcon className="fill-current text-comic-ink" />
    <div className={rippleContainerClass}>{children}</div>
    <div
      className={
        showMenu
          ? `${menuBaseClass} scale-y-100 opacity-100`
          : `${menuBaseClass} scale-y-0 opacity-0`
      }
    >
      <div
        className={menuItemClass}
        onMouseDown={preventDefault}
        onClick={downloadHandler}
      >
        Download Config
      </div>
      <div
        className={menuItemClass}
        onMouseDown={preventDefault}
        onClick={uploadHandler}
      >
        Upload Config
      </div>
      <div
        className={menuItemClass}
        onMouseDown={preventDefault}
        onClick={resetHandler}
      >
        Reset Config
      </div>
      {showBackgroundCheck ? (
        <div
          className={menuItemClass}
          onMouseDown={preventDefault}
          onClick={backgroundCheckHandler}
        >
          Background Check
        </div>
      ) : null}
      <a
        style={{ display: "none" }}
        ref={aRefHandler}
        onClick={stopImmediatePropagation}
      >
        Download Config
      </a>
      <input
        ref={inputRefHandler}
        type={"file"}
        style={{ display: "none" }}
        onChange={fileOnChangeHandler}
        onClick={stopImmediatePropagation}
      />
    </div>
  </span>
);

const RippleMenu = ripple(MenuButton);

type SelectedType = "update" | "subscribe" | "history";
type PopupState = {
  selectedType: SelectedType;
  showMenu: boolean;
};

class PopupApp extends Component<any, PopupState> {
  fileInput: HTMLInputElement | null = null;
  aRef: HTMLAnchorElement | null = null;

  state: PopupState = {
    selectedType: "update",
    showMenu: false,
  };

  componentDidMount() {
    this.props.requestPopupData();
  }

  componentDidUpdate(prevProps: any) {
    if (this.props.exportUrl && this.props.exportUrl !== prevProps.exportUrl) {
      if (this.aRef) {
        this.aRef.href = this.props.exportUrl;
        this.aRef.download =
          this.props.exportFilename || "comic-scroller-config.json";
        this.aRef.click();
        window.URL.revokeObjectURL(this.props.exportUrl);
        this.props.clearExportConfig();
      }
    }
  }

  componentWillUnmount() {
    document.removeEventListener("click", this.hideMenuHandler);
  }

  tabOnClickHandler = (e: any) => {
    const selectedType = e.target.getAttribute(
      "data-type",
    ) as SelectedType | null;
    if (selectedType) {
      this.setState({ selectedType });
    }
  };

  transitionEndHandler = (e: any) => {
    const index = parseInt(e.target.getAttribute("data-index"), 10);
    const move = e.target.getAttribute("data-move");
    const shift = e.target.getAttribute("data-shift");
    const category = this.state.selectedType;
    const len = this.props[category].length;
    if (move === "true") {
      if (len > 1) {
        this.props.shiftCards(category, index);
      } else {
        this.props.requestPopupData();
      }
    } else if (shift === "true" && index === len - 1) {
      this.props.requestPopupData();
    }
  };

  hideMenuHandler = () => {
    document.removeEventListener("click", this.hideMenuHandler);
    this.setState({ showMenu: false });
  };

  showMenuHandler = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (this.state.showMenu) {
      this.hideMenuHandler();
      return;
    }
    document.addEventListener("click", this.hideMenuHandler);
    this.setState({ showMenu: true });
  };

  inputRefHandler = (node: HTMLInputElement | null) => {
    this.fileInput = node;
  };

  uploadHandler = () => {
    if (this.fileInput) {
      this.fileInput.click();
    }
  };

  fileOnChangeHandler = () => {
    if (!this.fileInput || !this.fileInput.files) return;
    const fr = new FileReader();
    fr.onload = (e) => {
      const raw = e.target && (e.target as FileReader).result;
      let result: any = {};
      try {
        result = JSON.parse(String(raw || "{}"));
      } catch {
        return;
      }
      this.props.requestImportConfig(result);
    };
    const file = this.fileInput.files.item(0);
    if (file) fr.readAsText(file);
  };

  aRefHandler = (node: HTMLAnchorElement | null) => {
    this.aRef = node;
  };

  downloadHandler = () => {
    this.props.requestExportConfig();
  };

  backgroundCheckHandler = () => {
    if (!isDev) return;
    chrome.runtime.sendMessage({ msg: "PING_BACKGROUND" }, (response: any) => {
      if (response && response.ok) {
        const time = new Date(response.at).toLocaleTimeString();
        const summary = response.summary || {};
        const diff = summary.diff || {};
        const details = [
          `checked ${summary.checked ?? 0}`,
          `new ${summary.updated ?? 0}`,
          `added ${diff.added ?? 0}`,
          `update ${diff.before ?? 0} -> ${diff.after ?? 0}`,
          `errors ${summary.errors ?? 0}`,
        ].join(" | ");
        chrome.notifications.create(`bg-check-${response.at}`, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("imgs/comics-128.png"),
          title: "Background Check",
          message: `OK @ ${time} (${details})`,
        });
      }
    });
    this.hideMenuHandler();
  };

  resetHandler = () => {
    this.props.requestResetConfig();
  };

  render() {
    return (
      <div className="relative h-full w-full bg-comic-paper bg-halftone [background-size:12px_12px]">
        <div className={headerContainerClass}>
          <header className={headerClass} onClick={this.tabOnClickHandler}>
            <RippleTab
              className={
                this.state.selectedType === "update"
                  ? tabActiveClass
                  : tabBaseClass
              }
              type={"update"}
            />
            <RippleTab
              className={
                this.state.selectedType === "subscribe"
                  ? tabActiveClass
                  : tabBaseClass
              }
              type={"subscribe"}
            />
            <RippleTab
              className={
                this.state.selectedType === "history"
                  ? tabActiveClass
                  : tabBaseClass
              }
              type={"history"}
            />
            <span className={getShiftMarkerClass(this.state.selectedType)} />
          </header>
          <RippleMenu
            showMenu={this.state.showMenu}
            showMenuHandler={this.showMenuHandler}
            downloadHandler={this.downloadHandler}
            uploadHandler={this.uploadHandler}
            resetHandler={this.resetHandler}
            backgroundCheckHandler={this.backgroundCheckHandler}
            showBackgroundCheck={isDev}
            aRefHandler={this.aRefHandler}
            inputRefHandler={this.inputRefHandler}
            fileOnChangeHandler={this.fileOnChangeHandler}
          />
        </div>
        <div
          className={getContainerClass(this.state.selectedType)}
          onTransitionEnd={this.transitionEndHandler}
        >
          <div className={cardColumnClass}>
            {map(this.props.update, (item, i) => (
              <ComicCard
                key={`update_${item.comicsID}_${item.chapterID}`}
                category={this.state.selectedType}
                shift={item.shift}
                move={item.move}
                site={item.site}
                index={i}
                updateChapter={item.updateChapter}
                comicsID={item.comicsID}
                chapterID={item.chapterID}
                last={i === this.props[this.state.selectedType].length - 1}
              />
            ))}
          </div>
          <div className={cardColumnClass}>
            {map(this.props.subscribe, (item, i) => (
              <ComicCard
                key={`subscribe_${item.comicsID}`}
                category={this.state.selectedType}
                shift={item.shift}
                move={item.move}
                site={item.site}
                index={i}
                comicsID={item.comicsID}
                last={i === this.props[this.state.selectedType].length - 1}
              />
            ))}
          </div>
          <div className={cardColumnClass}>
            {map(this.props.history, (item, i) => (
              <ComicCard
                key={`history_${item.comicsID}`}
                category={this.state.selectedType}
                shift={item.shift}
                move={item.move}
                site={item.site}
                index={i}
                comicsID={item.comicsID}
                last={i === this.props[this.state.selectedType].length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: any) {
  const resolveComicsKeyForBucket = (bucket: any, rawKey: string) => {
    if (!bucket) return null;
    if (rawKey && bucket[rawKey]) return rawKey;
    const withPrefix = rawKey ? `m${rawKey}` : "";
    if (withPrefix && bucket[withPrefix]) return withPrefix;
    if (rawKey.startsWith("m")) {
      const stripped = rawKey.slice(1);
      if (stripped && bucket[stripped]) return stripped;
    }
    return null;
  };

  const resolveItem = (item: any) => {
    if (!item) return null;
    const rawKey = String(item.comicsID ?? "");
    if (!rawKey) return null;

    const site = item.site as string;
    if (site) {
      const bucket = state.popup[site];
      const resolvedKey = resolveComicsKeyForBucket(bucket, rawKey);
      return resolvedKey
        ? {
            ...item,
            comicsID: resolvedKey,
          }
        : null;
    }

    const sites = ["dm5", "sf", "comicbus"];
    for (const candidateSite of sites) {
      const bucket = state.popup[candidateSite];
      const resolvedKey = resolveComicsKeyForBucket(bucket, rawKey);
      if (resolvedKey) {
        return {
          ...item,
          site: candidateSite,
          comicsID: resolvedKey,
        };
      }
    }
    return null;
  };

  const normalizeList = (list: any[]) =>
    filter(map(list, resolveItem), Boolean);

  return {
    update: normalizeList(state.popup.update),
    subscribe: normalizeList(state.popup.subscribe),
    history: normalizeList(state.popup.history),
    exportUrl: state.popup.exportUrl,
    exportFilename: state.popup.exportFilename,
  };
}

export default connect(mapStateToProps, {
  shiftCards,
  clearExportConfig,
  requestPopupData,
  requestImportConfig,
  requestResetConfig,
  requestExportConfig,
})(PopupApp);
