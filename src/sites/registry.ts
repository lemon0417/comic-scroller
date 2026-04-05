import comicbusAdapter from "./comicbus/adapter";
import dm5Adapter from "./dm5/adapter";
import sfAdapter from "./sf/adapter";
import type { SiteAdapter } from "./types";

const adapters: Record<string, SiteAdapter> = {
  dm5: dm5Adapter,
  sf: sfAdapter,
  comicbus: comicbusAdapter,
};

export function getSiteAdapter(site: string) {
  return adapters[site];
}
