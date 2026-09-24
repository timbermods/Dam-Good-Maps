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

/** files: read a file the player picked (a file input or a drop). */
export async function readFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

// ------------------------------------------------------------------------------------ storage

/** storage: the autosave (EDITOR_PLAN §3 "Persistence"). Browser storage can be missing or full
 *  (private windows, blocked site data): every call fails quietly and says so. */
export interface Autosave {
  bytes: Uint8Array;
  name: string;
  /** ISO time of the save. */
  savedAt: string;
  kind: "generated" | "import";
  /** The screen the player was on: a reload in the editor opens the editor again. */
  screen: "settings" | "editor";
}

const DB = "dam-good-maps";
const STORE = "autosave";
const KEY = "current";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB, 1);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("storage is blocked"));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("storage aborted"));
    });
  } finally {
    db.close();
  }
}

export const storage = {
  /** Save the autosave; false when browser storage is unavailable or full. */
  async save(a: Autosave): Promise<boolean> {
    try {
      await withStore("readwrite", (s) => s.put(a, KEY));
      return true;
    } catch {
      return false;
    }
  },
  async load(): Promise<Autosave | null> {
    try {
      const a = (await withStore<Autosave | undefined>("readonly", (s) => s.get(KEY) as IDBRequest<Autosave | undefined>)) ?? null;
      return a && a.bytes instanceof Uint8Array ? a : null;
    } catch {
      return null;
    }
  },
  async clear(): Promise<void> {
    try {
      await withStore("readwrite", (s) => s.delete(KEY));
    } catch {
      // nothing to clear
    }
  },
};
