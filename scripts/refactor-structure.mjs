#!/usr/bin/env node
/**
 * One-shot project structure refactor. Run from repo root:
 *   node scripts/refactor-structure.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function sh(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function gitMv(from, to) {
  const src = path.join(root, from);
  const dst = path.join(root, to);
  if (!fs.existsSync(src)) {
    console.warn(`skip missing: ${from}`);
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  sh(`git mv "${from}" "${to}"`);
}

const coreMoves = [
  ["src/FormatHandler.ts", "src/core/format-handler.ts"],
  ["src/CommonFormats.ts", "src/core/common-formats.ts"],
  ["src/TraversionGraph.ts", "src/core/traversion-graph.ts"],
  ["src/PriorityQueue.ts", "src/core/priority-queue.ts"],
  ["src/normalizeMimeType.ts", "src/core/normalize-mime-type.ts"],
  ["src/main.ts", "src/app/main.ts"],
];

const vendorDirs = [
  "envelope",
  "qoi-fu",
  "qoa-fu",
  "sppd",
  "image-to-txt",
  "espeakng.js",
  "rpgmvp-decrypter",
  "terraria-wld-parser",
  "gimper",
  "libopenmpt",
  "lzh",
  "midi",
  "jsonToC",
  "bsor",
  "batToExe",
  "pandoc",
  "shToElf",
  "tarCompressed",
];

const moduleMoves = {
  media: [
    "FFmpeg.ts",
    "flo.ts",
    "libopenmpt.ts",
    "midi.ts",
    "espeakng.ts",
    "meyda.ts",
    "als.ts",
    "qoa-fu.ts",
    "vexflow.ts",
    "ImageMagick.ts",
    "pdftoimg.ts",
  ], // qoi-fu wrapper lives under image/
  image: [
    "canvasToBlob.ts",
    "rgba.ts",
    "svgTrace.ts",
    "svgForeignObject.ts",
    "qoi-fu.ts",
    "sppd.ts",
    "threejs.ts",
    "vtf.ts",
    "cgbi-to-png.ts",
    "font.ts",
    "icns.ts",
    "aseprite.ts",
    "comics.ts",
    "aperturePicture.ts",
    "curani.ts",
    "bunburrows.ts",
    "xcf.ts",
    "piskel.ts",
    "css.ts",
    "xcursor.ts",
  ],
  documents: [
    "envelope.ts",
    "pandoc.ts",
    "typst.ts",
    "pdfparse.ts",
    "har.ts",
    "toon.ts",
    "json.ts",
  ],
  archives: ["sevenZip.ts", "lzh.ts", "petozip.ts", "batToExe.ts", "exeToBat.ts"],
  games: [
    "nbt.ts",
    "mcmap.ts",
    "mcSchematicHandler.ts",
    "minecraftLangfileHandler.ts",
    "celariaMap.ts",
    "terrariawld.ts",
    "rpgmvp.ts",
    "wad.ts",
    "bsor.ts",
    "n64rom.ts",
    "ota.ts",
    "turbowarp.ts",
    "opusMagnum.ts",
    "cybergrindHandler.ts",
    "txtToInfiniteCraft.ts",
    "flptojson.ts",
  ],
  utility: [
    "sqlite.ts",
    "bson.ts",
    "jsonToC.ts",
    "fenToJson.ts",
    "chessjs.ts",
    "wabtHandler.ts",
    "shToElf.ts",
    "textToSource.ts",
    "pyTurtle.ts",
    "config.ts",
    "rename.ts",
    "textEncoding.ts",
    "htmlEmbed.ts",
  ],
};

// --- phase 1: directories ---
for (const d of [
  "src/app",
  "src/core",
  "src/handlers/vendor",
  "src/handlers/workers",
  ...Object.keys(moduleMoves).map((k) => `src/handlers/modules/${k}`),
]) {
  fs.mkdirSync(path.join(root, d), { recursive: true });
}

for (const [from, to] of coreMoves) gitMv(from, to);

for (const dir of vendorDirs) {
  gitMv(`src/handlers/${dir}`, `src/handlers/vendor/${dir}`);
}

if (fs.existsSync(path.join(root, "src/handlers/flo.worker.ts"))) {
  gitMv("src/handlers/flo.worker.ts", "src/handlers/workers/flo.worker.ts");
}

for (const [domain, files] of Object.entries(moduleMoves)) {
  for (const file of files) {
    gitMv(`src/handlers/${file}`, `src/handlers/modules/${domain}/${file}`);
  }
}

if (fs.existsSync(path.join(root, "src/handlers/index.ts"))) {
  gitMv("src/handlers/index.ts", "src/handlers/registry.ts");
}

console.log("\nStructure moves complete. Run import fix + registry separately.");
