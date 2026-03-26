import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "@styles/tailwind.css";
import App from "@containers/App";
import configureStore from "@domain/store/configureStore";

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
