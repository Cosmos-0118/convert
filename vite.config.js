import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfigPaths from "vite-tsconfig-paths";

const root = path.dirname(fileURLToPath(import.meta.url));
const shims = (name) => path.resolve(root, "vite/shims", name);

export default defineConfig({
  resolve: {
    alias: {
      // Browser-safe entry (ESM build pulls `import("module")` at top level).
      "7z-wasm": path.resolve(root, "node_modules/7z-wasm/7zz.umd.js"),
      fs: shims("fs.js"),
      crypto: shims("crypto.js"),
      module: shims("node-module.js"),
      "node:module": shims("node-module.js"),
    },
  },
  optimizeDeps: {
    exclude: [
      "@ffmpeg/ffmpeg",
      "@sqlite.org/sqlite-wasm",
      "@bokuweb/zstd-wasm",
    ],
  },
  base: "/convert/",
  build: {
    // vendor-sass is ~3.3 MB (full Sass compiler); loaded only for SCSS conversions.
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/sass/")) return "vendor-sass";
          if (id.includes("/less/")) return "vendor-less";
          if (id.includes("pdf-parse") || id.includes("pdftoimg")) return "vendor-pdf";
          if (id.includes("vexflow") || id.includes("vexml") || id.includes("@stringsync")) {
            return "vendor-notation";
          }
          if (id.includes("typst") || id.includes("@myriaddreamin")) return "vendor-typst";
          if (id.includes("@ffmpeg")) return "vendor-ffmpeg";
          if (id.includes("/three/") || id.includes("three-mesh-bvh") || id.includes("three-bvh-csg")) {
            return "vendor-three";
          }
          if (id.includes("@imagemagick")) return "vendor-imagemagick";
          if (id.includes("7z-wasm")) return "vendor-7z";
          if (id.includes("wabt")) return "vendor-wabt";
          if (id.includes("chess.js")) return "vendor-chess";
          if (id.includes("@sqlite.org")) return "vendor-sqlite";
        },
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/@flo-audio/reflo/reflo_bg.wasm",
          dest: "wasm",
        },
        {
          src: "src/handlers/vendor/pandoc/pandoc.wasm",
          dest: "wasm",
        },
        {
          src: "node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.*",
          dest: "wasm",
        },
        {
          src: "node_modules/@imagemagick/magick-wasm/dist/magick.wasm",
          dest: "wasm",
        },
        {
          src: "src/handlers/vendor/libopenmpt/libopenmpt.wasm",
          dest: "wasm",
        },
        {
          src: "src/handlers/vendor/libopenmpt/libopenmpt.js",
          dest: "wasm",
        },
        {
          src: "node_modules/js-synthesizer/externals/libfluidsynth-2.4.6.js",
          dest: "wasm",
        },
        {
          src: "node_modules/js-synthesizer/dist/js-synthesizer.js",
          dest: "wasm",
        },
        {
          src: "src/handlers/vendor/midi/TimGM6mb.sf2",
          dest: "wasm",
        },
        {
          src: "src/handlers/vendor/espeakng.js/js/espeakng.worker.js",
          dest: "js",
        },
        {
          src: "src/handlers/vendor/espeakng.js/js/espeakng.worker.data",
          dest: "js",
        },
        {
          src: "node_modules/pdf-parse/dist/pdf-parse/web/pdf.worker.mjs",
          dest: "js",
        },
        {
          src: "src/handlers/vendor/tarCompressed/liblzma.wasm",
          dest: "wasm",
        },
        {
          src: "node_modules/turbowarp-packager-browser/dist/scaffolding/*",
          dest: "js/turbowarp-scaffolding",
        },
        {
          src: "node_modules/7z-wasm/7zz.wasm",
          dest: "wasm",
        },
        {
          src: "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
          dest: "wasm",
        },
        {
          src: "node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm",
          dest: "wasm",
        },
      ],
    }),
    tsconfigPaths(),
  ],
});
