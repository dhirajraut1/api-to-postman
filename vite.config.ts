import { defineConfig } from "vite";
import { resolve } from "node:path";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const root = __dirname;

export default defineConfig({
  base: "./",
  publicDir: "public",
  plugins: [{
    name: "write-extension-manifests",
    closeBundle() {
      const sourceManifest = JSON.parse(
        readFileSync(resolve(root, "manifest.json"), "utf8")
      );

      // The project-root manifest loads the compiled files from ./dist.
      // The dist manifest loads those same files relative to dist itself.
      mkdirSync(resolve(root, "dist"), { recursive: true });
      writeFileSync(
        resolve(root, "dist/manifest.json"),
        JSON.stringify({
          ...sourceManifest,
          background: {
            ...sourceManifest.background,
            service_worker: "background/service-worker.js"
          },
          devtools_page: "devtools.html"
        }, null, 2) + "\n"
      );
    }
  }],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "background/service-worker": resolve(root, "src/background/service-worker.ts"),
        devtools: resolve(root, "devtools.html"),
        panel: resolve(root, "panel.html"),
        index: resolve(root, "index.html"),
        privacy: resolve(root, "privacy-policy.html")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
