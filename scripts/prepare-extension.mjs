#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'ComicsScroller');
const extDir = path.join(rootDir, 'src', 'extensions');

const ensureDir = async dir => {
  await fs.mkdir(dir, { recursive: true });
};

const clean = async () => {
  await fs.rm(outDir, { recursive: true, force: true });
};

const mkdir = async () => {
  await ensureDir(outDir);
};

const copyFile = async (src, dest) => {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
};

const copyDir = async (src, dest) => {
  await fs.rm(dest, { recursive: true, force: true });
  await fs.cp(src, dest, { recursive: true });
};

const copy = async mode => {
  if (!['dev', 'prod'].includes(mode)) {
    throw new Error(`Unknown mode "${mode}". Use "dev" or "prod".`);
  }
  await ensureDir(outDir);
  await copyDir(path.join(extDir, 'imgs'), path.join(outDir, 'imgs'));
  await copyFile(path.join(extDir, 'rules.json'), path.join(outDir, 'rules.json'));
  const manifestName = mode === 'dev' ? 'manifest_dev.json' : 'manifest.json';
  await copyFile(path.join(extDir, manifestName), path.join(outDir, 'manifest.json'));
};

const cleanZip = async () => {
  await fs.rm(path.join(rootDir, 'ComicsScroller.zip'), { force: true });
};

const [command, arg] = process.argv.slice(2);

const run = async () => {
  switch (command) {
    case 'clean':
      await clean();
      break;
    case 'mkdir':
      await mkdir();
      break;
    case 'copy':
      await copy(arg);
      break;
    case 'clean-zip':
      await cleanZip();
      break;
    default:
      throw new Error(
        `Unknown command "${command}". Use clean | mkdir | copy <dev|prod> | clean-zip.`,
      );
  }
};

run().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
