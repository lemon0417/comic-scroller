import { combineEpics } from "redux-observable";
import removeCardEpic from "./removeCardEpic";
import popupConfigEpic from "./configEpic";
import popupSyncEpic from "./syncEpic";

const popupEpic = combineEpics(removeCardEpic, popupConfigEpic, popupSyncEpic);

export default popupEpic;
