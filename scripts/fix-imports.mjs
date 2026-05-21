#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(ts|js|mjs|cjs)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const replacements = [
  // Core (old paths)
  [/from ["']src\/CommonFormats\.ts["']/g, 'from "@/core/common-formats.ts"'],
  [/from ["']src\/CommonFormats\.js["']/g, 'from "@/core/common-formats.ts"'],
  [/from ["']src\/FormatHandler["']/g, 'from "@/core/format-handler.ts"'],
  [/from ["']src\/FormatHandler\.ts["']/g, 'from "@/core/format-handler.ts"'],
  [/from ["']src\/FormatHandler\.js["']/g, 'from "@/core/format-handler.ts"'],
  [/from ["']\.\.\/FormatHandler\.ts["']/g, 'from "@/core/format-handler.ts"'],
  [/from ["']\.\.\/FormatHandler\.js["']/g, 'from "@/core/format-handler.ts"'],
  [/from ["']\.\.\/\.\.\/FormatHandler\.ts["']/g, 'from "@/core/format-handler.ts"'],
  [/from ["']\.\.\/\.\.\/\.\.\/FormatHandler\.ts["']/g, 'from "@/core/format-handler.ts"'],
  [/from ["']\.\.\/CommonFormats\.ts["']/g, 'from "@/core/common-formats.ts"'],
  [/from ["']\.\.\/CommonFormats\.js["']/g, 'from "@/core/common-formats.ts"'],
  [/from ["']src\/normalizeMimeType\.ts["']/g, 'from "@/core/normalize-mime-type.ts"'],
  [/from ["']\.\.\/normalizeMimeType\.ts["']/g, 'from "@/core/normalize-mime-type.ts"'],
  [/from ["']\.\.\/normalizeMimeType\.js["']/g, 'from "@/core/normalize-mime-type.ts"'],
  [/from ["']\.\.\/\.\.\/normalizeMimeType\.ts["']/g, 'from "@/core/normalize-mime-type.ts"'],
  [/from ["']\.\/FormatHandler\.ts["']/g, 'from "@/core/format-handler.ts"'],
  [/from ["']\.\/FormatHandler\.js["']/g, 'from "@/core/format-handler.ts"'],
  [/from ["']\.\/CommonFormats\.ts["']/g, 'from "@/core/common-formats.ts"'],
  [/from ["']\.\/normalizeMimeType\.ts["']/g, 'from "@/core/normalize-mime-type.ts"'],
  [/from ["']\.\/PriorityQueue\.ts["']/g, 'from "@/core/priority-queue.ts"'],
  [/from ["']\.\/TraversionGraph\.ts["']/g, 'from "@/core/traversion-graph.ts"'],
  [/from ["']\.\/TraversionGraph\.js["']/g, 'from "@/core/traversion-graph.ts"'],
  [/from ["']\.\/normalizeMimeType\.js["']/g, 'from "@/core/normalize-mime-type.ts"'],
  [/from ["']\.\/FormatHandler\.js["']/g, 'from "@/core/format-handler.ts"'],
  // Vendor-relative (handler modules)
  [/from ["']\.\/envelope\//g, 'from "@/handlers/vendor/envelope/'],
  [/from ["']\.\/gimper\//g, 'from "@/handlers/vendor/gimper/'],
  [/from ["']\.\/rpgmvp-decrypter\//g, 'from "@/handlers/vendor/rpgmvp-decrypter/'],
  [/from ["']\.\/espeakng\.js\//g, 'from "@/handlers/vendor/espeakng.js/'],
  [/from ["']\.\/image-to-txt\//g, 'from "@/handlers/vendor/image-to-txt/'],
  [/from ["']\.\/sppd\/sppd\//g, 'from "@/handlers/vendor/sppd/sppd/'],
  [/from ["']\.\/lzh\//g, 'from "@/handlers/vendor/lzh/'],
  [/from ["']\.\/midi\//g, 'from "@/handlers/vendor/midi/'],
  [/from ["']\.\/jsonToC\//g, 'from "@/handlers/vendor/jsonToC/'],
  [/from ["']\.\/bsor\//g, 'from "@/handlers/vendor/bsor/'],
  [/from ["']\.\/batToExe\//g, 'from "@/handlers/vendor/batToExe/'],
  [/from ["']\.\/shToElf\//g, 'from "@/handlers/vendor/shToElf/'],
  [
    /from ["']src\/handlers\/terraria-wld-parser\/src\/["']/g,
    'from "@/handlers/vendor/terraria-wld-parser/src/"',
  ],
  [/new URL\("\.\/flo\.worker\.ts"/g, 'new URL("../../workers/flo.worker.ts"'],
  // App entry
  [/from ["']\.\/handlers["']/g, 'from "@/handlers/registry.ts"'],
  [/from ["']\.\/handlers\/registry["']/g, 'from "@/handlers/registry.ts"'],
];

const files = [
  ...walk(path.join(root, "src")),
  ...walk(path.join(root, "test")),
  path.join(root, "index.html"),
];

let changed = 0;
for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  const orig = text;
  for (const [re, rep] of replacements) text = text.replace(re, rep);
  if (text !== orig) {
    fs.writeFileSync(file, text);
    changed++;
  }
}

console.log(`Updated ${changed} files`);
