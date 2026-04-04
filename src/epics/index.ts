import { combineEpics } from "redux-observable";
import {
  fetchChapterEpic,
  fetchImgSrcEpic,
  fetchImgListEpic,
  updateReadEpic,
} from "./getAction";
import scrollEpic from "./scrollEpic";
import resizeEpic from "./resizeEpic";
import navigationEpic from "./navigationEpic";
import subscribeEpic from "./subscribeEpic";
import readerLocationEpic from "./readerLocationEpic";

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
