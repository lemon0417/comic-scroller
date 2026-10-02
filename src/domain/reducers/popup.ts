import { IS_DEVELOPMENT_BUILD } from "@utils/buildMode";
import { combineReducers, type Reducer, type UnknownAction } from "redux";

import developerTools, { type DeveloperToolsState } from "./developerTools";
import popup, { type PopupState } from "./popupState";

export type PopupRootState = {
  popup: PopupState;
  developerTools?: DeveloperToolsState;
};

const rootReducer = combineReducers({
  popup,
  ...(IS_DEVELOPMENT_BUILD ? { developerTools } : {}),
}) as Reducer<PopupRootState, UnknownAction, Partial<PopupRootState>>;

export default rootReducer;
