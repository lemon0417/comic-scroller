import { map } from "rxjs/operators";

import eightComicAdapter from "./8comic/adapter";
import baozimhAdapter from "./baozimh/adapter";
import dm5Adapter from "./dm5/adapter";
import manhuaguiAdapter from "./manhuagui/adapter";
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
};

export function getSiteAdapter(site: string) {
  return adapters[site];
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
