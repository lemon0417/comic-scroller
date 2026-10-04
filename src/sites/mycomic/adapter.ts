import type { SiteAdapter } from "../types";
import { fetchMeta$ } from "./meta";
import { MYCOMIC_BASE_URL, myComicChapterURL } from "./url";

const myComicAdapter: SiteAdapter = {
  key: "mycomic",
  baseURL: MYCOMIC_BASE_URL,
  fetchMeta: fetchMeta$,
  getChapterURL: myComicChapterURL,
};

export default myComicAdapter;
