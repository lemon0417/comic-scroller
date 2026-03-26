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

const rootEpic = combineEpics<any, any, any, any>(
  fetchChapterEpic as any,
  fetchImgSrcEpic as any,
  scrollEpic as any,
  resizeEpic as any,
  navigationEpic as any,
  subscribeEpic as any,
  readerLocationEpic as any,
  fetchImgListEpic as any,
  updateReadEpic as any,
);

export default rootEpic;
