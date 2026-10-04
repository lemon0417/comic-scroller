import type { SeriesChapterSnapshot } from "@domain/library";
import type { Observable } from "rxjs";

export type FetchMetaOptions = {
  includeCover?: boolean;
  deferCover?: boolean;
};

export type SiteMeta = {
  title?: string;
  cover?: string;
} & SeriesChapterSnapshot;

export type SiteChapterSnapshot = SeriesChapterSnapshot;

export type SiteMetaFetcher = (
  url: string,
  options?: FetchMetaOptions,
) => Observable<SiteMeta>;

export type SiteChapterFetcher = (
  url: string,
) => Observable<SiteChapterSnapshot>;

export type SiteAdapter = {
  key: string;
  baseURL: string;
  fetchMeta: SiteMetaFetcher;
};
