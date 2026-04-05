import "@styles/tailwind.css";

import ManageApp from "@containers/ManageApp";
import configureStore from "@domain/store/configurePopStore";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

const store = configureStore();
const rootEl = document.getElementById("app");

if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <Provider store={store}>
      <ManageApp />
    </Provider>,
  );
}
