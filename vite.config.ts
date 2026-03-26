import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";
import fs from "fs";

const rootDir = process.cwd();
const srcDir = path.join(rootDir, "src");
const outDir = path.join(rootDir, "dist");
const manifestDir = path.join(srcDir, "manifest");

function copyManifest(mode: string) {
  return {
    name: "copy-extension-manifest",
    apply: "build",
    writeBundle() {
      const manifestName =
        mode === "development" ? "manifest.dev.json" : "manifest.json";
      const srcPath = path.join(manifestDir, manifestName);
      const destPath = path.join(outDir, "manifest.json");
      if (!fs.existsSync(srcPath)) {
        throw new Error(`Missing manifest file: ${srcPath}`);
      }
      fs.copyFileSync(srcPath, destPath);
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: "./",
  root: rootDir,
  publicDir: "public",
  plugins: [react(), svgr({ exportAsDefault: true }), copyManifest(mode)],
  resolve: {
    alias: {
      "@styles": path.join(srcDir, "styles"),
      "@assets": path.join(srcDir, "assets"),
      "@imgs": path.join(srcDir, "assets", "imgs"),
      "@ui": path.join(srcDir, "ui"),
      "@components": path.join(srcDir, "ui", "components"),
      "@containers": path.join(srcDir, "ui", "containers"),
      "@domain": path.join(srcDir, "domain"),
      "@epics": path.join(srcDir, "epics"),
      "@sites": path.join(srcDir, "sites"),
      "@infra": path.join(srcDir, "infra"),
      "@utils": path.join(srcDir, "utils"),
    },
  },
  css: {
    modules: {
      scopeBehaviour: "local",
      globalModulePaths: [/node_modules/, /src\/styles\//],
      generateScopedName: "[name]__[local]__[hash:base64:5]",
      localsConvention: (name) => name,
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode),
  },
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: path.join(rootDir, "app.html"),
        manage: path.join(rootDir, "manage.html"),
        popup: path.join(rootDir, "popup.html"),
        background: path.join(rootDir, "src", "background.ts"),
      },
      output: {
        entryFileNames: "js/[name].js",
        chunkFileNames: "js/[name].js",
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "";
          if (name.endsWith(".css")) {
            return "css/[name][extname]";
          }
          if (/\.(png|jpe?g|gif|svg)$/.test(name)) {
            return "imgs/[name][extname]";
          }
          return "assets/[name][extname]";
        },
      },
    },
  },
}));
