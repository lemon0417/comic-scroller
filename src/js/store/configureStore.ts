import { createStore, applyMiddleware } from 'redux';
import { createEpicMiddleware } from 'redux-observable';
import rootReducer from '../reducers';
import rootEpic from '../epics';

const epicMiddleware = createEpicMiddleware(rootEpic as any);

const middlewares = [epicMiddleware];
if (process.env.NODE_ENV !== 'production') {
  // Lazy-load dev-only logger to avoid bundling in production.
  const { createLogger } = require('redux-logger'); // eslint-disable-line global-require
  middlewares.push(createLogger());
}

const createStoreWithMiddleware = applyMiddleware(...middlewares)(createStore);

export default function configureStore(initialState?: any) {
  const store = createStoreWithMiddleware(rootReducer, initialState);
  // sagaMiddleware.run(sagas);
  if (module.hot) {
    // Enable Webpack hot module replacement for reducers
    module.hot.accept('../reducers', () => {
      const nextReducer = require('../reducers'); //eslint-disable-line
      store.replaceReducer(nextReducer);
    });
  }
  return store;
}
