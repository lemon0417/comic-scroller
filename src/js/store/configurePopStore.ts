import { createStore, applyMiddleware } from 'redux';
import rootReducer from '../reducers/popup';

const middlewares = [];
if (process.env.NODE_ENV !== 'production') {
  // Lazy-load dev-only logger to avoid bundling in production.
  const { createLogger } = require('redux-logger'); // eslint-disable-line global-require
  middlewares.push(createLogger());
}

const createStoreWithMiddleware =
  middlewares.length > 0
    ? applyMiddleware(...middlewares)(createStore)
    : createStore;

export default function configureStore(initialState?: any) {
  const store = createStoreWithMiddleware(rootReducer, initialState);
  // sagaMiddleware.run(sagas);
  if (module.hot) {
    // Enable Webpack hot module replacement for reducers
    module.hot.accept('../reducers/popup', () => {
      const nextReducer = require('../reducers/popup'); // eslint-disable-line
      store.replaceReducer(nextReducer);
    });
  }
  return store;
}
