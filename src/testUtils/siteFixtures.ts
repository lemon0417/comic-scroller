import type { SiteKey } from "@domain/library";
import { readFileSync } from "fs";
import { join } from "path";

/** Test-only response data; never import this helper from extension runtime code. */
export function readSiteFixture(site: SiteKey, filename: string): string {
  return readFileSync(
    join(__dirname, "../sites", site, "fixtures", filename),
    "utf8",
  );
}
