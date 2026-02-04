// @flow
import { combineEpics } from 'redux-observable';
import {
  fetchChapterEpic,
  fetchImgSrcEpic,
  fetchImgListEpic,
  updateReadEpic,
} from '../container/App/reducers/getAction';
import scrollEpic from '../container/App/reducers/scrollEpic';
import resizeEpic from '../container/App/reducers/resizeEpic';

const rootEpic = combineEpics(
  fetchChapterEpic,
  fetchImgSrcEpic,
  scrollEpic,
  resizeEpic,
  fetchImgListEpic,
  updateReadEpic,
);

export default rootEpic;
