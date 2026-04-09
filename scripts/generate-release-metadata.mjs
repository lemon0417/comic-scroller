import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJsonPath = resolve(root, "package.json");
const outputPath = resolve(root, "latest-release.json");
const repository = process.env.GITHUB_REPOSITORY || "lemon0417/comic-scroller";

function normalizeReleaseTagName(version) {
  const requestedTag = String(
    process.env.COMIC_SCROLLER_RELEASE_TAG || process.env.GITHUB_REF_NAME || "",
  ).trim();

  if (/^v?\d+\.\d+\.\d+$/.test(requestedTag)) {
    return requestedTag.startsWith("v") ? requestedTag : `v${requestedTag}`;
  }

  return `v${version}`;
}

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const version = String(pkg.version || "").trim();

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `generate-release-metadata: invalid package version "${version}"`,
    );
  }

  return version;
}

function buildReleaseMetadata() {
  const version = readPackageVersion();
  const tag = normalizeReleaseTagName(version);

  return {
    version,
    publishedAt:
      process.env.COMIC_SCROLLER_PUBLISHED_AT || new Date().toISOString(),
    releaseUrl: `https://github.com/${repository}/releases/tag/${tag}`,
  };
}

const metadata = buildReleaseMetadata();
writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
