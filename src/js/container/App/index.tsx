import React, { Component } from 'react';
import { connect } from 'react-redux';
import some from 'lodash/some';
import filter from 'lodash/filter';
import MenuIcon from '@imgs/menu.svg?react';
import NextIcon from '@imgs/circle-right.svg?react';
import PrevIcon from '@imgs/circle-left.svg?react';
import TagIcon from '@imgs/tag.svg?react';
import IconButton from '../../component/IconButton';
import cn from './App.module.css';
import ImgContainer from '../ImgContainer';
import ChapterList from '../ChapterList';
import {
  resetImg,
  updateChapterLatestIndex,
  updateSubscribe,
} from '../../reducers/comics';
import { fetchImgList, fetchChapter, updateRead } from '../../epics/getAction';
import { stopScroll } from '../../epics/scrollEpic';
import { startResize } from '../../epics/resizeEpic';
import { storageGet, storageSet } from '../../services/storage';

declare var chrome: any;

const ImgContainerAny: any = ImgContainer;
const ChapterListAny: any = ChapterList;

function getTagIconClass(chapterTitle: any, subscribe: any) {
  if (chapterTitle === '') return cn.icon_deactive;
  if (subscribe) return cn.icon_subscribe;
  return cn.icon;
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
          chrome.tabs.getCurrent((tab: { id: any; }) => {
            chrome.tabs.remove(tab.id);
          });
        }
        if (
          !some(
            item.subscribe,
            citem => citem.site === site && citem.comicsID === comicsID,
          ) &&
          subscribe
        ) {
          this.props.updateSubscribe(false);
        }
      });
    });
    const chapter = window.location.search.split('&chapter=')[1];
    this.props.fetchChapter(chapter);
  }

  showChapterListHandler = () => {
    const body = document.body;
    if (!(body instanceof HTMLElement)) {
      return;
    }
    if (!this.state.showChapterList) {
      body.style.overflowY = 'hidden';
    } else {
      body.removeAttribute('style');
    }
    this.setState({ showChapterList: !this.state.showChapterList });
  };

  prevChapterHandler = () => {
    const index = this.props.chapterNowIndex + 1;
    this.props.stopScroll();
    this.props.resetImg();
    this.props.updateRead(index);
    this.props.updateChapterLatestIndex(index);
    this.props.fetchImgList(index);
  };

  nextChapterHandler = () => {
    const index = this.props.chapterNowIndex - 1;
    this.props.stopScroll();
    this.props.resetImg();
    this.props.updateRead(index);
    this.props.updateChapterLatestIndex(index);
    this.props.fetchImgList(index);
  };

  subscribeHandler = () => {
    const { site, comicsID } = this.props;
    storageGet((item: any) => {
      if (item.subscribe) {
        let newItem = {};
        if (
          some(
            item.subscribe,
            citem => citem.site === site && citem.comicsID === comicsID,
          )
        ) {
          newItem = {
            ...item,
            subscribe: filter(
              item.subscribe,
              citem => citem.site !== site || citem.comicsID !== comicsID,
            ),
          };
          storageSet(newItem, () =>
            this.props.updateSubscribe(false),
          );
        } else {
          newItem = {
            ...item,
            subscribe: [
              {
                site,
                comicsID,
              },
              ...item.subscribe,
            ],
          };
          storageSet(newItem, () =>
            this.props.updateSubscribe(true),
          );
        }
      }
    });
  };

  render() {
    const { prevable, nextable, chapterTitle, subscribe } = this.props;
    return (
      <div className={cn.App}>
        <header className={cn.Header}>
          <span className={cn.leftContainer}>
            <IconButton onClickHandler={this.showChapterListHandler}>
              <MenuIcon className={cn.icon} />
            </IconButton>
            <span>Comics Scroller</span>
            <a target="_blank" rel="noreferrer" href={this.props.url}>{`${
              this.props.title
            }`}</a>
            <span>&gt;</span>
            <span>
              {this.props.chapterList.length > 0
                ? this.props.chapterTitle
                : 'Loading ...'}
            </span>
          </span>
          <span className={cn.rigthtContainer}>
            <IconButton
              onClickHandler={prevable ? this.prevChapterHandler : undefined}
            >
              <PrevIcon className={prevable ? cn.icon : cn.icon_deactive} />
            </IconButton>
            <IconButton
              onClickHandler={nextable ? this.nextChapterHandler : undefined}
            >
              <NextIcon className={nextable ? cn.icon : cn.icon_deactive} />
            </IconButton>
            <IconButton
              onClickHandler={
                chapterTitle !== '' ? this.subscribeHandler : undefined
              }
            >
              <TagIcon className={getTagIconClass(chapterTitle, subscribe)} />
            </IconButton>
          </span>
        </header>
        <ImgContainerAny />
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
        : '',
    site,
    chapter:
      chapterList.length > 0 && chapters[chapterID]
        ? chapters[chapterID].chapter
        : '',
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
  stopScroll,
  startResize,
  resetImg,
  updateRead,
  updateChapterLatestIndex,
  updateSubscribe,
  fetchImgList,
})(App);

export default connectedApp as any;
