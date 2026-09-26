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
const DB_VERSION = 2;
const STORE = "autosave";
const KEY = "current";
const FOLDER_STORE = "folders";
const FOLDER_KEY = "timberborn-maps";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(FOLDER_STORE)) db.createObjectStore(FOLDER_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("storage is blocked"));
  });
}

async function withStore<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
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
      await withStore(STORE, "readwrite", (s) => s.put(a, KEY));
      return true;
    } catch {
      return false;
    }
  },
  async load(): Promise<Autosave | null> {
    try {
      const a = (await withStore<Autosave | undefined>(STORE, "readonly", (s) => s.get(KEY) as IDBRequest<Autosave | undefined>)) ?? null;
      return a && a.bytes instanceof Uint8Array ? a : null;
    } catch {
      return null;
    }
  },
  async clear(): Promise<void> {
    try {
      await withStore(STORE, "readwrite", (s) => s.delete(KEY));
    } catch {
      // nothing to clear
    }
  },
};

// ---------------------------------------------------------------------- save to Timberborn (D162)

declare global {
  interface Window {
    /** Chrome and Edge only; undefined everywhere else. */
    showDirectoryPicker?(options?: {
      id?: string;
      mode?: "read" | "readwrite";
      startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
    }): Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemHandle {
    /** Chromium's permission extension to the File System Access API; not in the DOM lib. */
    queryPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
    requestPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
  }
}

/** Whether this browser can save straight into a folder. Chrome and Edge; not Firefox or Safari. */
export function canSaveToTimberborn(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/** The remembered Maps folder, if permission still stands (asking again counts as "still stands"). */
async function recallFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await withStore<FileSystemDirectoryHandle | undefined>(FOLDER_STORE, "readonly", (s) => s.get(FOLDER_KEY) as IDBRequest<FileSystemDirectoryHandle | undefined>);
    if (!handle) return null;
    const mode = { mode: "readwrite" as const };
    if ((await handle.queryPermission?.(mode)) === "granted") return handle;
    if ((await handle.requestPermission?.(mode)) === "granted") return handle;
    return null;
  } catch {
    return null;
  }
}

async function rememberFolder(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    await withStore(FOLDER_STORE, "readwrite", (s) => s.put(handle, FOLDER_KEY));
  } catch {
    // the folder still works this once; it just won't be remembered next time
  }
}

async function pickFolder(): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker!({ id: "timberborn-maps", mode: "readwrite", startIn: "documents" });
  const granted = await handle.requestPermission?.({ mode: "readwrite" });
  if (granted && granted !== "granted") throw new DOMException("the player refused write access", "NotAllowedError");
  return handle;
}

async function writeIntoFolder(folder: FileSystemDirectoryHandle, name: string, bytes: Uint8Array): Promise<void> {
  const file = await folder.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(bytes as unknown as ArrayBuffer);
  await writable.close();
}

export type SaveToTimberbornResult = { via: "fsa"; folder: string } | { via: "download" };

/** Swapped out in tests so the fallback and the write can be checked without a real browser. */
export interface SaveToTimberbornDeps {
  supported(): boolean;
  recall(): Promise<FileSystemDirectoryHandle | null>;
  remember(handle: FileSystemDirectoryHandle): Promise<void>;
  pick(): Promise<FileSystemDirectoryHandle>;
  write(folder: FileSystemDirectoryHandle, name: string, bytes: Uint8Array): Promise<void>;
  download(bytes: Uint8Array, name: string): void;
}

const liveDeps: SaveToTimberbornDeps = { supported: canSaveToTimberborn, recall: recallFolder, remember: rememberFolder, pick: pickFolder, write: writeIntoFolder, download: saveFile };

/**
 * Save straight into the player's Timberborn Maps folder (D162): the first call asks the player
 * to pick it and remembers the folder; later calls reuse it, asking again only if permission has
 * lapsed. Falls back to the normal download - the same bytes, just not placed in the folder - on
 * every other browser, a declined picker or permission, or a write that fails.
 */
export async function saveToTimberborn(bytes: Uint8Array, name: string, deps: SaveToTimberbornDeps = liveDeps): Promise<SaveToTimberbornResult> {
  if (deps.supported()) {
    try {
      let folder = await deps.recall();
      if (!folder) {
        folder = await deps.pick();
        await deps.remember(folder);
      }
      await deps.write(folder, name, bytes);
      return { via: "fsa", folder: folder.name };
    } catch {
      // the player's browser refused, they closed the picker, or the write failed: fall back
    }
  }
  deps.download(bytes, name);
  return { via: "download" };
}
