import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('.', import.meta.url).pathname, '..');
const pkgPath = resolve(root, 'package.json');
const manifestPaths = [
  resolve(root, 'src/manifest/manifest.json'),
  resolve(root, 'src/manifest/manifest.dev.json'),
];

const usage = () => {
  console.log('Usage: node scripts/bump-version.mjs <major|minor|patch|x.y.z>');
  process.exit(1);
};

const arg = process.argv[2];
if (!arg) usage();

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const current = String(pkg.version || '').trim();
const semverMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);

if (!semverMatch) {
  console.error(`Invalid current version in package.json: "${current}"`);
  process.exit(1);
}

let [major, minor, patch] = semverMatch.slice(1).map(Number);
let next = '';

if (arg === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
  next = `${major}.${minor}.${patch}`;
} else if (arg === 'minor') {
  minor += 1;
  patch = 0;
  next = `${major}.${minor}.${patch}`;
} else if (arg === 'patch') {
  patch += 1;
  next = `${major}.${minor}.${patch}`;
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  next = arg;
} else {
  usage();
}

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

for (const manifestPath of manifestPaths) {
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.version = next;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

console.log(`Version updated to ${next}`);
