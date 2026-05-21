/** Browser stub — Emscripten uses Node crypto only in the NODE code path. */
export function randomFillSync(view) {
  crypto.getRandomValues(view);
  return view;
}

export default { randomFillSync };
