import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('.', import.meta.url).pathname, '..');
const pkgPath = resolve(root, 'package.json');
const manifestPath = resolve(root, 'src/manifest/manifest.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const pkgVersion = String(pkg.version || '').trim();
const manifestVersion = String(manifest.version || '').trim();

if (!pkgVersion || !manifestVersion) {
  console.error(
    'Release check failed: missing version in package.json or manifest.json',
  );
  process.exit(1);
}

if (pkgVersion !== manifestVersion) {
  console.error(
    `Release check failed: package.json (${pkgVersion}) does not match manifest.json (${manifestVersion}).`,
  );
  process.exit(1);
}

console.log(`Release check OK: version ${pkgVersion}`);
