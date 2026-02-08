import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "normalize.css/normalize.css";
import "@styles/tailwind.css";
import PopupApp from "@containers/PopupApp";
import configureStore from "@domain/store/configurePopStore";

const store = configureStore();
const rootEl = document.getElementById("app");
const root = rootEl ? createRoot(rootEl) : null;

function renderApp(NextApp: typeof PopupApp) {
  if (!root) return;
  root.render(
    <Provider store={store}>
      <NextApp />
    </Provider>,
  );
}

renderApp(PopupApp);

if (import.meta.hot) {
  import.meta.hot.accept("@containers/PopupApp", (module) => {
    if (module && module.default) {
      renderApp(module.default);
    }
  });
}
