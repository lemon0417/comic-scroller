import { map } from "rxjs/operators";

import eightComicAdapter from "./8comic/adapter";
import baozimhAdapter from "./baozimh/adapter";
import dm5Adapter from "./dm5/adapter";
import manhuaguiAdapter from "./manhuagui/adapter";
import myComicAdapter from "./mycomic/adapter";
import { withNativeReaderBypass } from "./native";
import type {
  SiteAdapter,
  SiteChapterFetcher,
  SiteChapterSnapshot,
} from "./types";

const adapters: Record<string, SiteAdapter> = {
  dm5: dm5Adapter,
  "8comic": eightComicAdapter,
  manhuagui: manhuaguiAdapter,
  baozimh: baozimhAdapter,
  mycomic: myComicAdapter,
};

export function getSiteAdapter(site: string) {
  return Object.hasOwn(adapters, site) ? adapters[site] : undefined;
}

export function getNativeChapterURL(site: string, chapterID: string) {
  try {
    const adapter = getSiteAdapter(site);
    return adapter
      ? withNativeReaderBypass(adapter.getChapterURL(chapterID))
      : "";
  } catch {
    return "";
  }
}

function projectChapterSnapshot({
  chapterList,
  chapters,
  chapterGroups,
}: SiteChapterSnapshot): SiteChapterSnapshot {
  return { chapterList, chapters, ...(chapterGroups ? { chapterGroups } : {}) };
}

export function getSiteChapterFetcher(
  site: string,
): SiteChapterFetcher | undefined {
  const adapter = getSiteAdapter(site);
  if (!adapter) return undefined;

  return (url) =>
    adapter
      .fetchMeta(url, { includeCover: false })
      .pipe(map(projectChapterSnapshot));
}
