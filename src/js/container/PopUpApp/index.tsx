import React, { Component } from 'react';
import { connect } from 'react-redux';
import map from 'lodash/map';
import MoreIcon from 'imgs/more_vert.svg?react';
import ComicCard from 'cmp/ComicCard';
import ripple from 'cmp/Ripple';
import { updatePopupData, shiftCards } from './reducers/popup';
import cn from './PopUpApp.module.css';
import initObject from '../../util/initObject';
import filter from 'lodash/filter';
import { storageGet, storageSet, storageClear } from '../../services/storage';

declare var chrome: any;

function stopImmediatePropagation(e: any) {
  e.stopPropagation();
  e.nativeEvent.stopImmediatePropagation();
}

function preventDefault(e: any) {
  e.preventDefault();
}

function getShiftMarkerClass(
  selectedType: 'update' | 'subscribe' | 'history',
): string {
  switch (selectedType) {
    case 'update':
      return cn.shiftMarker_left;
    case 'subscribe':
      return cn.shiftMarker_mid;
    case 'history':
      return cn.shiftMarker_right;
    default:
      return cn.shiftMarker_left;
  }
}

function getContainerClass(
  selectedType: 'update' | 'subscribe' | 'history',
): string {
  switch (selectedType) {
    case 'update':
      return cn.CardContainer_left;
    case 'subscribe':
      return cn.CardContainer_mid;
    case 'history':
      return cn.CardContainer_right;
    default:
      return cn.CardContainer_left;
  }
}

const Tab = ({
  className,
  children,
  type,
  onMouseDownHandler,
}: {
  className: string,
  children?: any,
  type: string,
  onMouseDownHandler?: React.MouseEventHandler<HTMLSpanElement>,
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
  aRefHandler,
  inputRefHandler,
  fileOnChangeHandler,
}: {
  children?: any,
  showMenu: boolean,
  showMenuHandler: React.MouseEventHandler<HTMLSpanElement>,
  onMouseDownHandler?: React.MouseEventHandler<HTMLSpanElement>,
  downloadHandler: React.MouseEventHandler<HTMLDivElement>,
  uploadHandler: React.MouseEventHandler<HTMLDivElement>,
  resetHandler: React.MouseEventHandler<HTMLDivElement>,
  aRefHandler: React.Ref<HTMLAnchorElement>,
  inputRefHandler: React.Ref<HTMLInputElement>,
  fileOnChangeHandler: React.ChangeEventHandler<HTMLInputElement>,
}) => (
  <span
    className={cn.button}
    onClick={showMenuHandler}
    onMouseDown={onMouseDownHandler}
  >
    <MoreIcon />
    <div className={cn.rippleContainer}>{children}</div>
    <div className={showMenu ? cn.menuOn : cn.menuOff}>
      <div onMouseDown={preventDefault} onClick={downloadHandler}>
        Download Config
      </div>
      <div onMouseDown={preventDefault} onClick={uploadHandler}>
        Upload Config
      </div>
      <div onMouseDown={preventDefault} onClick={resetHandler}>
        Reset Config
      </div>
      <a
        style={{ display: 'none' }}
        ref={aRefHandler}
        onClick={stopImmediatePropagation}
      >
        Download Config
      </a>
      <input
        ref={inputRefHandler}
        type={'file'}
        style={{ display: 'none' }}
        onChange={fileOnChangeHandler}
        onClick={stopImmediatePropagation}
      />
    </div>
  </span>
);

const RippleMenu = ripple(MenuButton);

type SelectedType = 'update' | 'subscribe' | 'history';
type PopUpState = {
  selectedType: SelectedType,
  showMenu: boolean,
};

class PopUpApp extends Component<any, PopUpState> {
  fileInput: HTMLInputElement | null = null;
  aRef: HTMLAnchorElement | null = null;

  state: PopUpState = {
    selectedType: 'update',
    showMenu: false,
  };

  componentDidMount() {
    storageGet((item: any) => {
      this.props.updatePopupData(item);
    });
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.hideMenuHandler);
  }

  tabOnClickHandler = (e: any) => {
    const selectedType = e.target.getAttribute('data-type') as
      | SelectedType
      | null;
    if (selectedType) {
      this.setState({ selectedType });
    }
  };

  transitionEndHandler = (e: any) => {
    const index = parseInt(e.target.getAttribute('data-index'), 10);
    const move = e.target.getAttribute('data-move');
    const shift = e.target.getAttribute('data-shift');
    const category = this.state.selectedType;
    const len = this.props[category].length;
    if (move === 'true') {
      if (len > 1) {
        this.props.shiftCards(category, index);
      } else {
        storageGet((item: any) => {
          this.props.updatePopupData(item);
        });
      }
    } else if (shift === 'true' && index === len - 1) {
      storageGet((item: any) => {
        this.props.updatePopupData(item);
      });
    }
  };

  hideMenuHandler = () => {
    document.removeEventListener('click', this.hideMenuHandler);
    this.setState({ showMenu: false });
  };

  showMenuHandler = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (this.state.showMenu) {
      this.hideMenuHandler();
      return;
    }
    document.addEventListener('click', this.hideMenuHandler);
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
    fr.onload = e => {
      const raw = e.target && (e.target as FileReader).result;
      const result = JSON.parse(String(raw || '{}'));
      storageSet(result, err => {
        if (!err) {
          storageGet((item: { update: string | any[]; }) => {
            this.props.updatePopupData(item);
            chrome.action.setBadgeText({
              text: `${item.update.length === 0 ? '' : item.update.length}`,
            });
            chrome.runtime.sendMessage({ msg: 'UPDATE' });
          });
        }
      });
    };
    const file = this.fileInput.files.item(0);
    if (file) fr.readAsText(file);
  };

  aRefHandler = (node: HTMLAnchorElement | null) => {
    this.aRef = node;
  };

  downloadHandler = () => {
    storageGet((item: any) => {
      const json = JSON.stringify(item);
      const blob = new Blob([json], { type: 'octet/stream' });
      const url = window.URL.createObjectURL(blob);
      if (this.aRef) {
        this.aRef.href = url;
        this.aRef.download = 'ComicsScroller_config.json';
        this.aRef.click();
        window.URL.revokeObjectURL(url);
      }
    });
  };

  resetHandler = () => {
    storageClear();
    storageSet(initObject, () => {
      storageGet((item: { update: string | any[]; }) => {
        this.props.updatePopupData(item);
        chrome.action.setBadgeText({
          text: `${item.update.length === 0 ? '' : item.update.length}`,
        });
        chrome.runtime.sendMessage({ msg: 'UPDATE' });
      });
    });
  };

  render() {
    return (
      <div className={cn.PopUpApp}>
        <div className={cn.headerContainer}>
          <header className={cn.header} onClick={this.tabOnClickHandler}>
            <RippleTab
              className={
                this.state.selectedType === 'update' ? cn.tabActive : cn.tab
              }
              type={'update'}
            />
            <RippleTab
              className={
                this.state.selectedType === 'subscribe' ? cn.tabActive : cn.tab
              }
              type={'subscribe'}
            />
            <RippleTab
              className={
                this.state.selectedType === 'history' ? cn.tabActive : cn.tab
              }
              type={'history'}
            />
            <span className={getShiftMarkerClass(this.state.selectedType)} />
          </header>
          <RippleMenu
            showMenu={this.state.showMenu}
            showMenuHandler={this.showMenuHandler}
            downloadHandler={this.downloadHandler}
            uploadHandler={this.uploadHandler}
            resetHandler={this.resetHandler}
            aRefHandler={this.aRefHandler}
            inputRefHandler={this.inputRefHandler}
            fileOnChangeHandler={this.fileOnChangeHandler}
          />
        </div>
        <div
          className={getContainerClass(this.state.selectedType)}
          onTransitionEnd={this.transitionEndHandler}
        >
          <div>
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
          <div>
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
          <div>
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
    const withPrefix = rawKey ? `m${rawKey}` : '';
    if (withPrefix && bucket[withPrefix]) return withPrefix;
    if (rawKey.startsWith('m')) {
      const stripped = rawKey.slice(1);
      if (stripped && bucket[stripped]) return stripped;
    }
    return null;
  };

  const resolveItem = (item: any) => {
    if (!item) return null;
    const rawKey = String(item.comicsID ?? '');
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

    const sites = ['dm5', 'sf', 'comicbus'];
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
  };
}

export default connect(mapStateToProps, {
  updatePopupData,
  shiftCards,
})(PopUpApp);
