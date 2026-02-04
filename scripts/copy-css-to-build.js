const fs = require('fs');
const path = require('path');

const srcRoot = path.join(__dirname, '..', 'src', 'js');
const destRoot = path.join(__dirname, '..', 'build', 'js');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyCssFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      copyCssFiles(srcPath);
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name) !== '.css') continue;

    const relPath = path.relative(srcRoot, srcPath);
    const destPath = path.join(destRoot, relPath);
    ensureDir(path.dirname(destPath));
    fs.copyFileSync(srcPath, destPath);
  }
}

if (fs.existsSync(srcRoot)) {
  copyCssFiles(srcRoot);
}
