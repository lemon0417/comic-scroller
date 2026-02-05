import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import 'normalize.css/normalize.css';
import '@css/tag_popup.css';
import App from './container/PopUpApp';
import configureStore from './store/configurePopStore';

const store = configureStore();
const rootEl = document.getElementById('app');

function renderApp(NextApp: typeof App) {
  if (!rootEl) return;
  render(
    <Provider store={store}>
      <NextApp />
    </Provider>,
    rootEl,
  );
}

renderApp(App);

if (import.meta.hot) {
  import.meta.hot.accept('./container/PopUpApp', module => {
    if (module && module.default) {
      renderApp(module.default);
    }
  });
}
