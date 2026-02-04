// @flow
import React, { Component } from 'react';
import { connect } from 'react-redux';
import 'rxjs/add/operator/takeUntil';
import map from 'lodash/map';
import {
  resetImg,
  updateChapterLatestIndex,
  updateRenderIndex,
} from '../App/reducers/comics';
import { dm5 } from '../../epics/sites';
import { stopScroll } from '../../epics/scrollEpic';
import cn from './ChapterList.css';

const { fetchImgList, updateRead } = dm5;

class ChapterList extends Component {
  props!: {
    show: boolean,
    chapterList: Array<any>,
    showChapterListHandler: Function,
    stopScroll: Function,
    resetImg: Function,
    updateRead: Function,
    updateRenderIndex: Function,
    updateChapterLatestIndex: Function,
    fetchImgList: Function,
  };

  node!: HTMLBaseElement;

  onClickHandler = () => {
    this.node.scrollTop = 0;
    this.props.showChapterListHandler();
  };

  refHandler = (node: HTMLBaseElement) => {
    this.node = node;
  };

  chapterClickHandler = (e: any) => {
    if (e.target.matches(`.${cn.content} > div`)) {
      const index = parseInt(e.target.dataset.index, 10);
      this.props.stopScroll();
      this.props.resetImg();
      this.props.updateRead(index);
      this.props.updateChapterLatestIndex(index);
      this.props.updateRenderIndex(0, 6);
      this.props.fetchImgList(index);
    }
  };

  render() {
    return (
      <div
        className={this.props.show ? cn.modalActive : cn.modal}
        onClick={this.props.show ? this.onClickHandler : undefined}
      >
        <div
          className={this.props.show ? cn.ChapterListActive : cn.ChapterList}
          ref={this.refHandler}
        >
          <div className={cn.header}>章節</div>
          <div className={cn.content} onClick={this.chapterClickHandler}>
            {map(this.props.chapterList, (item, i) => (
              <div
                className={item.read ? cn.chapter_read : cn.chapter}
                key={i}
                data-chapter={item.chapter}
                data-index={i}
              >
                {item.title}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: any) {
  const { read, chapterList, chapters } = state.comics;
  return {
    chapterList: map(chapterList, item => ({
      ...chapters[item],
      read: read.includes(item) ,
    })),
  };
}

export default connect(mapStateToProps, {
  stopScroll,
  resetImg,
  updateRead,
  updateRenderIndex,
  updateChapterLatestIndex,
  fetchImgList,
})(ChapterList);
