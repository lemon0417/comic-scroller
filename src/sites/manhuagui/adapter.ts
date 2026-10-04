import type { SiteAdapter } from "../types";
import { fetchMeta$ } from "./meta";
import { MANHUAGUI_BASE_URL, manhuaguiChapterURL } from "./url";

const manhuaguiAdapter: SiteAdapter = {
  key: "manhuagui",
  baseURL: MANHUAGUI_BASE_URL,
  fetchMeta: fetchMeta$,
  getChapterURL: manhuaguiChapterURL,
};

export default manhuaguiAdapter;
