import type { SiteAdapter } from "../types";
import { fetchMeta$ } from "./meta";
import { dm5ChapterURL } from "./url";

const dm5Adapter: SiteAdapter = {
  key: "dm5",
  baseURL: "https://www.dm5.com",
  fetchMeta: fetchMeta$,
  getChapterURL: dm5ChapterURL,
};

export default dm5Adapter;
