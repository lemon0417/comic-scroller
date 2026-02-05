import { configureStore as configureToolkitStore, Tuple } from '@reduxjs/toolkit';
import { createEpicMiddleware } from 'redux-observable';
import { createLogger } from 'redux-logger';
import rootReducer from '../reducers';
import rootEpic from '../epics';

const epicMiddleware = createEpicMiddleware(rootEpic as any);

const buildMiddleware = () =>
  process.env.NODE_ENV !== 'production'
    ? new Tuple(epicMiddleware, createLogger())
    : new Tuple(epicMiddleware);

export default function configureStore(initialState?: any) {
  const store = configureToolkitStore({
    reducer: rootReducer,
    middleware: buildMiddleware,
    preloadedState: initialState,
    devTools: process.env.NODE_ENV !== 'production',
  });

  if (import.meta.hot) {
    import.meta.hot.accept('../reducers', module => {
      if (module && module.default) {
        store.replaceReducer(module.default);
      }
    });
  }
  return store;
}
