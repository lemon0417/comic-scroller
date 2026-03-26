import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "@styles/tailwind.css";
import ManageApp from "@containers/ManageApp";
import configureStore from "@domain/store/configurePopStore";

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
