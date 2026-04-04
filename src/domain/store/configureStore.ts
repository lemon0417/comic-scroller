import {
  configureStore as configureToolkitStore,
  Tuple,
} from "@reduxjs/toolkit";
import { createEpicMiddleware } from "redux-observable";
import rootReducer, { type RootState } from "../reducers";
import rootEpic from "../../epics";
import { getDebugLogger } from "./debugLogger";
import type { EpicAction } from "@epics/types";

type AppStore = ReturnType<typeof configureToolkitStore<RootState>>;

const epicDependencies: { store: AppStore | null } = { store: null };
const epicMiddleware = createEpicMiddleware<
  EpicAction,
  EpicAction,
  RootState,
  typeof epicDependencies
>({
  dependencies: epicDependencies,
});

const buildMiddleware = () => {
  const logger = getDebugLogger();
  return logger ? new Tuple(epicMiddleware, logger) : new Tuple(epicMiddleware);
};

export default function configureStore(initialState?: Partial<RootState>) {
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
