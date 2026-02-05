import { createStore, applyMiddleware } from 'redux';
import { createLogger } from 'redux-logger';
import rootReducer from '../reducers/popup';

const middlewares = [];
if (process.env.NODE_ENV !== 'production') {
  middlewares.push(createLogger());
}

const createStoreWithMiddleware =
  middlewares.length > 0
    ? applyMiddleware(...middlewares)(createStore)
    : createStore;

export default function configureStore(initialState?: any) {
  const store = createStoreWithMiddleware(rootReducer, initialState);
  // sagaMiddleware.run(sagas);
  if (import.meta.hot) {
    import.meta.hot.accept('../reducers/popup', module => {
      if (module && module.default) {
        store.replaceReducer(module.default);
      }
    });
  }
  return store;
}
