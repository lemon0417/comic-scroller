import archiver from 'archiver';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('.', import.meta.url).pathname, '..');
const pkgPath = resolve(root, 'package.json');
const distPath = resolve(root, 'dist');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = String(pkg.version || '').trim();

if (!version) {
  console.error('zip-release: missing version in package.json');
  process.exit(1);
}

const zipName = `comic-scroller-${version}.zip`;
const zipPath = resolve(root, zipName);

if (!existsSync(distPath)) {
  console.error('zip-release: dist/ not found. Run `yarn build` first.');
  process.exit(1);
}

const output = createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Writing ${archive.pointer()} bytes to ${zipName}...`);
});

archive.on('warning', err => {
  if (err.code === 'ENOENT') {
    console.warn(err.message);
  } else {
    throw err;
  }
});

archive.on('error', err => {
  throw err;
});

archive.pipe(output);
archive.directory(distPath, false);
archive.finalize();
