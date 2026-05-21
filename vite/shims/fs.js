/** Browser stub — Emscripten fs branch is never taken in the web build. */
function unavailable(method) {
  return () => {
    throw new Error(`${method} is not available in the browser`);
  };
}

export const readFileSync = unavailable("fs.readFileSync");
export const writeFileSync = unavailable("fs.writeFileSync");
export const readlinkSync = unavailable("fs.readlinkSync");
export const lstatSync = unavailable("fs.lstatSync");
export const chmodSync = unavailable("fs.chmodSync");
export const utimesSync = unavailable("fs.utimesSync");
export const truncateSync = unavailable("fs.truncateSync");
export const mkdirSync = unavailable("fs.mkdirSync");
export const unlinkSync = unavailable("fs.unlinkSync");
export const rmdirSync = unavailable("fs.rmdirSync");
export const renameSync = unavailable("fs.renameSync");
export const readdirSync = unavailable("fs.readdirSync");
export const symlinkSync = unavailable("fs.symlinkSync");
export const openSync = unavailable("fs.openSync");
export const closeSync = unavailable("fs.closeSync");
export const readSync = unavailable("fs.readSync");
export const writeSync = unavailable("fs.writeSync");
export const fstatSync = unavailable("fs.fstatSync");
export const fchmodSync = unavailable("fs.fchmodSync");
export const futimesSync = unavailable("fs.futimesSync");
export const ftruncateSync = unavailable("fs.ftruncateSync");
export const statfsSync = unavailable("fs.statfsSync");

export default {
  readFileSync,
  writeFileSync,
  readlinkSync,
  lstatSync,
  chmodSync,
  utimesSync,
  truncateSync,
  mkdirSync,
  unlinkSync,
  rmdirSync,
  renameSync,
  readdirSync,
  symlinkSync,
  openSync,
  closeSync,
  readSync,
  writeSync,
  fstatSync,
  fchmodSync,
  futimesSync,
  ftruncateSync,
  statfsSync,
};
