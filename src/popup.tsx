import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "@styles/tailwind.css";
import PopupApp from "@containers/PopupApp";
import configureStore from "@domain/store/configurePopStore";

const store = configureStore();
const rootEl = document.getElementById("app");
const root = rootEl ? createRoot(rootEl) : null;
const isExtensionPopup = (() => {
  if (typeof chrome === "undefined" || !chrome.extension?.getViews) {
    return false;
  }
  try {
    const views = chrome.extension.getViews({ type: "popup" }) || [];
    return views.includes(window);
  } catch {
    return false;
  }
})();
document.body.classList.toggle("popup-extension", isExtensionPopup);

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
