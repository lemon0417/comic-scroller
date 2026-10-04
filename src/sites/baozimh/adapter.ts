import type { SiteAdapter } from "../types";
import { fetchMeta$ } from "./meta";
import { BAOZIMH_BASE_URL } from "./url";

const baozimhAdapter: SiteAdapter = {
  key: "baozimh",
  baseURL: BAOZIMH_BASE_URL,
  fetchMeta: fetchMeta$,
};

export default baozimhAdapter;
