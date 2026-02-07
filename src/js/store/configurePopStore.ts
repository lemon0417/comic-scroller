import {
  configureStore as configureToolkitStore,
  Tuple,
} from "@reduxjs/toolkit";
import { createLogger } from "redux-logger";
import rootReducer from "../reducers/popup";

const buildMiddleware = () =>
  process.env.NODE_ENV !== "production"
    ? new Tuple(createLogger())
    : new Tuple();

export default function configureStore(initialState?: any) {
  const store = configureToolkitStore({
    reducer: rootReducer,
    middleware: buildMiddleware,
    preloadedState: initialState,
    devTools: process.env.NODE_ENV !== "production",
  });

  if (import.meta.hot) {
    import.meta.hot.accept("../reducers/popup", (module) => {
      if (module && module.default) {
        store.replaceReducer(module.default);
      }
    });
  }
  return store;
}
