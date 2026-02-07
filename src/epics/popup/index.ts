import { combineEpics } from "redux-observable";
import removeCardEpic from "./removeCardEpic";
import popupConfigEpic from "./configEpic";

const popupEpic = combineEpics(removeCardEpic, popupConfigEpic);

export default popupEpic;
