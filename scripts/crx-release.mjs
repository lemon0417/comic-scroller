import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import crxReleaseUtils from './crx-release-utils.cjs';

const { decodePrivateKeyBase64, getCrxArtifactName } = crxReleaseUtils;

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pkgPath = resolve(root, 'package.json');
const distPath = resolve(root, 'dist');
const crx3BinPath = resolve(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'crx3.cmd' : 'crx3',
);

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = String(pkg.version || '').trim();
const crxName = getCrxArtifactName(version);
const crxPath = resolve(root, crxName);

if (!existsSync(distPath)) {
  console.error('crx-release: dist/ not found. Run `yarn build` first.');
  process.exit(1);
}

if (!existsSync(crx3BinPath)) {
  console.error('crx-release: missing local crx3 binary. Run `yarn install` first.');
  process.exit(1);
}

let tempDir = '';

try {
  const privateKeyPem = decodePrivateKeyBase64(
    process.env.CHROME_EXTENSION_PRIVATE_KEY_B64,
  );

  tempDir = mkdtempSync(resolve(tmpdir(), 'comic-scroller-crx-'));
  const keyPath = resolve(tempDir, 'release-key.pem');
  writeFileSync(keyPath, privateKeyPem, { mode: 0o600 });

  const result = spawnSync(
    crx3BinPath,
    ['-p', keyPath, '-o', crxPath, '--', distPath],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  console.log(`Wrote signed CRX to ${crxName}`);
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'crx-release: failed to build CRX.';
  console.error(message);
  process.exit(1);
} finally {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
