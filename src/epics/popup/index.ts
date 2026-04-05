import { combineEpics } from "redux-observable";

import popupConfigEpic from "./configEpic";
import removeCardEpic from "./removeCardEpic";
import popupSyncEpic from "./syncEpic";

const popupEpic = combineEpics(removeCardEpic, popupConfigEpic, popupSyncEpic);

export default popupEpic;
