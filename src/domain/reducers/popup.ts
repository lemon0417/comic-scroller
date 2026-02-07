import { combineReducers } from "redux";
import popup from "@containers/PopupApp/reducers/popup";

const rootReducer = combineReducers({
  popup,
});

export default rootReducer;
