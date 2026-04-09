import { combineEpics } from "redux-observable";

import popupConfigEpic from "./configEpic";
import releaseNoticeEpic from "./releaseNoticeEpic";
import removeCardEpic from "./removeCardEpic";
import popupSyncEpic from "./syncEpic";

const popupEpic = combineEpics(
  removeCardEpic,
  popupConfigEpic,
  popupSyncEpic,
  releaseNoticeEpic,
);

export default popupEpic;
