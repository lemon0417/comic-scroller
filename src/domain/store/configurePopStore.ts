import {
  configureStore as configureToolkitStore,
  Tuple,
} from "@reduxjs/toolkit";
import rootReducer from "../reducers/popup";
import { getDebugLogger } from "./debugLogger";

const buildMiddleware = () => {
  const logger = getDebugLogger();
  return logger ? new Tuple(logger) : new Tuple();
};

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
