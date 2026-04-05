import popupEpic from "@epics/popup";
import type { EpicAction, PopupRootState } from "@epics/types";
import {
  configureStore as configureToolkitStore,
  Tuple,
} from "@reduxjs/toolkit";
import { createEpicMiddleware } from "redux-observable";

import rootReducer from "../reducers/popup";
import { getDebugLogger } from "./debugLogger";

const epicMiddleware = createEpicMiddleware<
  EpicAction,
  EpicAction,
  PopupRootState
>();

const buildMiddleware = () => {
  const logger = getDebugLogger();
  return logger ? new Tuple(epicMiddleware, logger) : new Tuple(epicMiddleware);
};

export default function configureStore(initialState?: Partial<PopupRootState>) {
  const store = configureToolkitStore({
    reducer: rootReducer,
    middleware: buildMiddleware,
    preloadedState: initialState,
    devTools: process.env.NODE_ENV !== "production",
  });

  epicMiddleware.run(popupEpic);

  if (import.meta.hot) {
    import.meta.hot.accept("../reducers/popup", (module) => {
      if (module && module.default) {
        store.replaceReducer(module.default);
      }
    });
  }
  return store;
}
