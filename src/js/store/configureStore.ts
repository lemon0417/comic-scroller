import { createStore, applyMiddleware } from 'redux';
import { createEpicMiddleware } from 'redux-observable';
import { createLogger } from 'redux-logger';
import rootReducer from '../reducers';
import rootEpic from '../epics';

const epicMiddleware = createEpicMiddleware(rootEpic as any);

const middlewares = [epicMiddleware];
if (process.env.NODE_ENV !== 'production') {
  middlewares.push(createLogger());
}

const createStoreWithMiddleware = applyMiddleware(...middlewares)(createStore);

export default function configureStore(initialState?: any) {
  const store = createStoreWithMiddleware(rootReducer, initialState);
  // sagaMiddleware.run(sagas);
  if (import.meta.hot) {
    import.meta.hot.accept('../reducers', module => {
      if (module && module.default) {
        store.replaceReducer(module.default);
      }
    });
  }
  return store;
}
