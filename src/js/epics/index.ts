// @flow
import { combineEpics } from 'redux-observable';
import {
  fetchChapterEpic,
  fetchImgSrcEpic,
  fetchImgListEpic,
  updateReadEpic,
} from './getAction';
import scrollEpic from './scrollEpic';
import resizeEpic from './resizeEpic';

const rootEpic = combineEpics(
  fetchChapterEpic,
  fetchImgSrcEpic,
  scrollEpic,
  resizeEpic,
  fetchImgListEpic,
  updateReadEpic,
);

export default rootEpic;
