import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "normalize.css/normalize.css";
import "@css/tag_popup.css";
import App from "./container/PopUpApp";
import configureStore from "./store/configurePopStore";

const store = configureStore();
const rootEl = document.getElementById("app");
const root = rootEl ? createRoot(rootEl) : null;

function renderApp(NextApp: typeof App) {
  if (!root) return;
  root.render(
    <Provider store={store}>
      <NextApp />
    </Provider>,
  );
}

renderApp(App);

if (import.meta.hot) {
  import.meta.hot.accept("./container/PopUpApp", (module) => {
    if (module && module.default) {
      renderApp(module.default);
    }
  });
}
