import type { FormatHandler } from "@/core/format-handler.ts";

type HandlerCtor = new () => FormatHandler;
type HandlerModule = Record<string, unknown>;

async function registerDefault(
  handlers: FormatHandler[],
  loader: () => Promise<{ default: HandlerCtor }>,
) {
  try {
    handlers.push(new (await loader()).default());
  } catch {
    /* handler unavailable in this environment */
  }
}

async function registerNamed(
  handlers: FormatHandler[],
  loader: () => Promise<HandlerModule>,
  specs: Array<{ name: string; construct?: boolean }>,
) {
  try {
    const mod = await loader();
    for (const { name, construct } of specs) {
      const entry = mod[name];
      if (!entry) continue;
      handlers.push(
        construct
          ? new (entry as HandlerCtor)()
          : (entry as FormatHandler),
      );
    }
  } catch {
    /* handler unavailable in this environment */
  }
}

/** Load all format handlers (code-split per module). */
export async function loadHandlers(): Promise<FormatHandler[]> {
  const handlers: FormatHandler[] = [];
  const tasks: [
    Promise<void>,
    ...Promise<void>[],
  ] = [
    registerDefault(handlers, () => import("./modules/image/svgTrace.ts")),
    registerDefault(handlers, () => import("./modules/image/canvasToBlob.ts")),
    registerDefault(handlers, () => import("./modules/media/meyda.ts")),
    registerDefault(handlers, () => import("./modules/utility/htmlEmbed.ts")),
    registerDefault(handlers, () => import("./modules/media/FFmpeg.ts")),
    registerDefault(handlers, () => import("./modules/media/pdftoimg.ts")),
    registerDefault(handlers, () => import("./modules/media/ImageMagick.ts")),
    registerDefault(handlers, () => import("./modules/image/curani.ts")),
    registerDefault(handlers, () => import("./modules/image/bunburrows.ts")),
    registerDefault(handlers, () => import("./modules/image/rgba.ts")),
    registerNamed(handlers, () => import("./modules/utility/rename.ts"), [
      { name: "renameZipHandler" },
      { name: "renameTxtHandler" },
      { name: "renameJsonHandler" },
    ]),
    registerDefault(handlers, () => import("./modules/documents/envelope.ts")),
    registerDefault(handlers, () => import("./modules/documents/pandoc.ts")),
    registerDefault(handlers, () => import("./modules/image/svgForeignObject.ts")),
    registerDefault(handlers, () => import("./modules/image/qoi-fu.ts")),
    registerDefault(handlers, () => import("./modules/image/sppd.ts")),
    registerDefault(handlers, () => import("./modules/image/threejs.ts")),
    registerDefault(handlers, () => import("./modules/utility/sqlite.ts")),
    registerDefault(handlers, () => import("./modules/image/vtf.ts")),
    registerDefault(handlers, () => import("./modules/games/mcmap.ts")),
    registerDefault(handlers, () => import("./modules/archives/sevenZip.ts")),
    registerDefault(handlers, () => import("./modules/utility/config.ts")),
    registerDefault(handlers, () => import("./modules/media/als.ts")),
    registerDefault(handlers, () => import("./modules/media/qoa-fu.ts")),
    registerDefault(handlers, () => import("./modules/utility/pyTurtle.ts")),
    registerNamed(handlers, () => import("./modules/documents/json.ts"), [
      { name: "fromJsonHandler", construct: true },
      { name: "toJsonHandler", construct: true },
    ]),
    registerDefault(handlers, () => import("./modules/games/nbt.ts")),
    registerDefault(handlers, () => import("./modules/archives/petozip.ts")),
    registerDefault(handlers, () => import("./modules/games/flptojson.ts")),
    registerDefault(handlers, () => import("./modules/media/flo.ts")),
    registerDefault(handlers, () => import("./modules/image/cgbi-to-png.ts")),
    registerDefault(handlers, () => import("./modules/archives/batToExe.ts")),
    registerDefault(handlers, () => import("./modules/games/turbowarp.ts")),
    registerDefault(handlers, () => import("./modules/utility/textEncoding.ts")),
    registerDefault(handlers, () => import("./modules/utility/jsonToC.ts")),
    registerDefault(handlers, () => import("./modules/media/libopenmpt.ts")),
    registerNamed(handlers, () => import("./modules/media/midi.ts"), [
      { name: "midiCodecHandler", construct: true },
      { name: "midiSynthHandler", construct: true },
    ]),
    registerDefault(handlers, () => import("./modules/archives/lzh.ts")),
    registerDefault(handlers, () => import("./modules/games/wad.ts")),
    registerDefault(handlers, () => import("./modules/games/txtToInfiniteCraft.ts")),
    registerDefault(handlers, () => import("./modules/media/espeakng.ts")),
    registerDefault(handlers, () => import("./modules/archives/exeToBat.ts")),
    registerDefault(handlers, () => import("./modules/games/bsor.ts")),
    registerDefault(handlers, () => import("./modules/image/font.ts")),
    registerDefault(handlers, () => import("./modules/image/icns.ts")),
    registerDefault(handlers, () => import("./modules/games/mcSchematicHandler.ts")),
    registerDefault(handlers, () => import("./modules/utility/bson.ts")),
    registerDefault(handlers, () => import("./modules/image/aseprite.ts")),
    registerDefault(handlers, () => import("./modules/documents/har.ts")),
    registerDefault(handlers, () => import("./modules/games/n64rom.ts")),
    registerDefault(handlers, () => import("./modules/media/vexflow.ts")),
    registerDefault(handlers, () => import("./modules/documents/toon.ts")),
    registerDefault(handlers, () => import("./modules/games/rpgmvp.ts")),
    registerDefault(handlers, () => import("./modules/games/ota.ts")),
    registerDefault(handlers, () => import("./modules/image/comics.ts")),
    registerDefault(handlers, () => import("./modules/games/terrariawld.ts")),
    registerDefault(handlers, () => import("./modules/games/opusMagnum.ts")),
    registerDefault(handlers, () => import("./modules/image/aperturePicture.ts")),
    registerDefault(handlers, () => import("./modules/image/xcf.ts")),
    registerDefault(handlers, () => import("./modules/documents/pdfparse.ts")),
    registerDefault(handlers, () => import("./modules/games/minecraftLangfileHandler.ts")),
    registerDefault(handlers, () => import("./modules/games/celariaMap.ts")),
    registerDefault(handlers, () => import("./modules/games/cybergrindHandler.ts")),
    registerDefault(handlers, () => import("./modules/utility/textToSource.ts")),
    registerDefault(handlers, () => import("./modules/utility/wabtHandler.ts")),
    registerDefault(handlers, () => import("./modules/utility/chessjs.ts")),
    registerDefault(handlers, () => import("./modules/utility/fenToJson.ts")),
    registerDefault(handlers, () => import("./modules/image/piskel.ts")),
    registerDefault(handlers, () => import("./modules/image/xcursor.ts")),
    registerDefault(handlers, () => import("./modules/utility/shToElf.ts")),
    registerDefault(handlers, () => import("./modules/image/css.ts")),
    registerDefault(handlers, () => import("./modules/documents/typst.ts")),
  ];

  await Promise.all(tasks);
  return handlers;
}
