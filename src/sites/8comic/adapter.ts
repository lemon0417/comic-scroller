import type { SiteAdapter } from "../types";
import { fetchMeta$ } from "./meta";
import { EIGHT_COMIC_BASE_URL } from "./url";

const eightComicAdapter: SiteAdapter = {
  key: "8comic",
  baseURL: EIGHT_COMIC_BASE_URL,
  fetchMeta: fetchMeta$,
};

export default eightComicAdapter;
