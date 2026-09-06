import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// content script は classic script として読み込まれるため ESM import を含められない。
// popup / background と同じビルドに入れると、共有モジュールが chunk として切り出され
// content.js に import 文が混入する。これを避けるため content だけ独立した iife ビルドにする。
// BUILD_TARGET=content のときは content 専用ビルド、それ以外は popup + background。
const isContentBuild = process.env.BUILD_TARGET === "content";

export default defineConfig({
  plugins: [react()],
  build: isContentBuild
    ? {
        emptyOutDir: false,
        rollupOptions: {
          input: resolve(__dirname, "src/content.ts"),
          output: {
            format: "iife",
            entryFileNames: "assets/content.js"
          }
        }
      }
    : {
        emptyOutDir: true,
        rollupOptions: {
          input: {
            popup: resolve(__dirname, "popup.html"),
            background: resolve(__dirname, "src/background.ts")
          },
          output: {
            entryFileNames: "assets/[name].js",
            chunkFileNames: "assets/[name].js",
            assetFileNames: "assets/[name][extname]"
          }
        }
      }
});
