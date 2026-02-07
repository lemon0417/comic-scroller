import {
  configureStore as configureToolkitStore,
  Tuple,
} from "@reduxjs/toolkit";
import { createEpicMiddleware } from "redux-observable";
import rootReducer from "../reducers";
import rootEpic from "@epics";
import { getDebugLogger } from "./debugLogger";

const epicDependencies: { store: any } = { store: null };
const epicMiddleware = createEpicMiddleware({ dependencies: epicDependencies });

const buildMiddleware = () => {
  const logger = getDebugLogger();
  return logger ? new Tuple(epicMiddleware, logger) : new Tuple(epicMiddleware);
};

export default function configureStore(initialState?: any) {
  const store = configureToolkitStore({
    reducer: rootReducer,
    middleware: buildMiddleware,
    preloadedState: initialState,
    devTools: process.env.NODE_ENV !== "production",
  });
  epicDependencies.store = store;
  epicMiddleware.run(rootEpic);

  if (import.meta.hot) {
    import.meta.hot.accept("../reducers", (module) => {
      if (module && module.default) {
        store.replaceReducer(module.default);
      }
    });
  }
  return store;
}
