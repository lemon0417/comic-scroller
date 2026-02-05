import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import fs from 'fs';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');
const outDir = path.join(rootDir, 'ComicsScroller');

const htmlOutputFiles = ['app.html', 'popup.html'];

function relocateHtmlOutputs() {
  return {
    name: 'relocate-extension-html',
    apply: 'build',
    writeBundle() {
      const nestedDir = path.join(outDir, 'src', 'extensions');
      if (!fs.existsSync(nestedDir)) return;

      for (const file of htmlOutputFiles) {
        const srcPath = path.join(nestedDir, file);
        const destPath = path.join(outDir, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          fs.unlinkSync(srcPath);
        }
      }

      try {
        const remaining = fs.readdirSync(nestedDir);
        if (remaining.length === 0) {
          fs.rmdirSync(nestedDir);
        }
        const srcRoot = path.join(outDir, 'src');
        if (fs.existsSync(srcRoot) && fs.readdirSync(srcRoot).length === 0) {
          fs.rmdirSync(srcRoot);
        }
      } catch {
        // Ignore cleanup failures in watch mode.
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  root: rootDir,
  publicDir: false,
  plugins: [
    react(),
    svgr({ exportAsDefault: true }),
    relocateHtmlOutputs(),
  ],
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
    emptyOutDir: false,
    rollupOptions: {
      input: {
        app: path.join(rootDir, 'src', 'extensions', 'app.html'),
        popup: path.join(rootDir, 'src', 'extensions', 'popup.html'),
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
