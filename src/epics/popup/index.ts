import { combineEpics } from "redux-observable";
import removeCardEpic from "./removeCardEpic";

const popupEpic = combineEpics(removeCardEpic);

export default popupEpic;
