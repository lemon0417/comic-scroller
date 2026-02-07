import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "normalize.css/normalize.css";
import "@css/tailwind.css";
import App from "./container/App";
import configureStore from "./store/configureStore";

const store = configureStore();
const rootEl = document.getElementById("app");

if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
}
