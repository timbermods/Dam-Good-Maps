// Platform adapters (PLAN §19.9): the only code that differs between the website and the future
// Claude artifact edition. The core never touches the DOM or a platform API.

import { wrap, type Remote } from "comlink";
import type { GeneratorApi } from "../worker/generator.worker";

/** workers: a module URL on the website (the artifact build will inline it as a blob). */
export function createGenerator(): Remote<GeneratorApi> {
  const worker = new Worker(new URL("../worker/generator.worker.ts", import.meta.url), { type: "module" });
  return wrap<GeneratorApi>(worker);
}

/** files: save bytes under a file name. The artifact edition wraps .timber in a .zip (D10). */
export function saveFile(bytes: Uint8Array, name: string, type = "application/octet-stream"): void {
  const blob = new Blob([bytes as unknown as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
