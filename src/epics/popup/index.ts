import { IS_DEVELOPMENT_BUILD } from "@utils/buildMode";
import { combineEpics } from "redux-observable";

import popupConfigEpic from "./configEpic";
import developerToolsEpic from "./developerToolsEpic";
import releaseNoticeEpic from "./releaseNoticeEpic";
import removeCardEpic from "./removeCardEpic";
import popupSyncEpic from "./syncEpic";

const popupEpic = combineEpics(
  removeCardEpic,
  popupConfigEpic,
  popupSyncEpic,
  releaseNoticeEpic,
  ...(IS_DEVELOPMENT_BUILD ? [developerToolsEpic] : []),
);

export default popupEpic;
