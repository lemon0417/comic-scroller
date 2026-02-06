import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import fs from 'fs';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');
const outDir = path.join(rootDir, 'dist');
const manifestDir = path.join(srcDir, 'manifest');

function copyManifest(mode: string) {
  return {
    name: 'copy-extension-manifest',
    apply: 'build',
    writeBundle() {
      const manifestName =
        mode === 'development' ? 'manifest.dev.json' : 'manifest.json';
      const srcPath = path.join(manifestDir, manifestName);
      const destPath = path.join(outDir, 'manifest.json');
      if (!fs.existsSync(srcPath)) {
        throw new Error(`Missing manifest file: ${srcPath}`);
      }
      fs.copyFileSync(srcPath, destPath);
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  root: rootDir,
  publicDir: 'public',
  plugins: [react(), svgr({ exportAsDefault: true }), copyManifest(mode)],
  resolve: {
    alias: {
      css: path.join(srcDir, 'css'),
      '@css': path.join(srcDir, 'css'),
      imgs: path.join(srcDir, 'imgs'),
      '@imgs': path.join(srcDir, 'imgs'),
      cmp: path.join(srcDir, 'js', 'component'),
    },
  },
  css: {
    modules: {
      scopeBehaviour: 'local',
      globalModulePaths: [/node_modules/, /src\/css\//],
      generateScopedName: '[name]__[local]__[hash:base64:5]',
      localsConvention: name => name,
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: path.join(rootDir, 'app.html'),
        popup: path.join(rootDir, 'popup.html'),
        background: path.join(rootDir, 'src', 'js', 'background.ts'),
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: assetInfo => {
          const name = assetInfo.name || '';
          if (name.endsWith('.css')) {
            return 'css/[name][extname]';
          }
          if (/\.(png|jpe?g|gif|svg)$/.test(name)) {
            return 'imgs/[name][extname]';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
}));
