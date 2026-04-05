import { combineEpics } from "redux-observable";

import {
  fetchChapterEpic,
  fetchImgListEpic,
  fetchImgSrcEpic,
  updateReadEpic,
} from "./getAction";
import navigationEpic from "./navigationEpic";
import readerLocationEpic from "./readerLocationEpic";
import resizeEpic from "./resizeEpic";
import scrollEpic from "./scrollEpic";
import subscribeEpic from "./subscribeEpic";

const rootEpic = combineEpics(
  fetchChapterEpic,
  fetchImgSrcEpic,
  scrollEpic,
  resizeEpic,
  navigationEpic,
  subscribeEpic,
  readerLocationEpic,
  fetchImgListEpic,
  updateReadEpic,
);

export default rootEpic;
