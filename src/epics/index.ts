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

const rootEpic = combineEpics(
  fetchChapterEpic,
  fetchImgSrcEpic,
  scrollEpic,
  resizeEpic,
  navigationEpic,
  subscribeEpic,
  fetchImgListEpic,
  updateReadEpic,
);

export default rootEpic;
