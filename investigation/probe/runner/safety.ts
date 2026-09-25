// Keeping Kyler's game exactly as it was. Before a launch the runner records the game's settings
// (the registry key), the Unity logs, the player data and every file under Saves; after the game has
// quit it puts back whatever changed and deletes whatever the probe's games created. A marker file
// says a run is in progress, so a runner that died mid-run restores first on its next start.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { GAME_PROCESS, probePaths, REGISTRY_KEY, timberbornDocs, unityLogDir } from './paths';

export interface FileStamp {
  size: number;
  mtimeMs: number;
}
export type Listing = Record<string, FileStamp>;

interface Snapshot {
  at: string;
  registryFile: string;
  registryValues: Record<string, string>;
  logs: string[];
  playerData: string[];
  saves: Listing;
  saveDirs: string[];
  docs: Listing;
}

export function isGameRunning(): boolean {
  try {
    const out = execFileSync('tasklist.exe', ['/FI', `IMAGENAME eq ${GAME_PROCESS}.exe`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
    return out.toLowerCase().includes(`"${GAME_PROCESS.toLowerCase()}.exe"`);
  } catch {
    return false;
  }
}

export function gameProcessIds(): number[] {
  try {
    const out = execFileSync('tasklist.exe', ['/FI', `IMAGENAME eq ${GAME_PROCESS}.exe`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
    return [...out.matchAll(/"[^"]+","(\d+)"/g)].map((m) => Number(m[1]));
  } catch {
    return [];
  }
}

/** Every file under `root` (relative path â†’ size and time), skipping the folders in `skip`. */
export function listFiles(root: string, skip: string[] = []): Listing {
  const out: Listing = {};
  if (!existsSync(root)) return out;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(root, full);
      if (skip.some((s) => rel === s || rel.startsWith(s + '\\') || rel.startsWith(s + '/'))) continue;
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else out[rel] = { size: st.size, mtimeMs: st.mtimeMs };
    }
  };
  walk(root);
  return out;
}

/** The registry key's values as `reg query` prints them, one entry per value name. */
export function registryValues(): Record<string, string> {
  const out: Record<string, string> = {};
  let text = '';
  try {
    text = execFileSync('reg.exe', ['query', REGISTRY_KEY], { encoding: 'utf8', maxBuffer: 64 << 20 });
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^ {4}(.+?) {4}(REG_\w+) {4}(.*)$/.exec(line);
    if (m) out[m[1]] = `${m[2]} ${m[3]}`;
  }
  return out;
}

export const marker = () => join(probePaths().backup, 'in-progress.json');
const DOCS_SKIP = ['DGMProbe', 'Mods', 'Saves', 'ExperimentalSaves'];

/** Record everything a probe run could change. Refuses if an earlier run's backup was never restored. */
export function takeSnapshot(): Snapshot {
  const p = probePaths();
  if (existsSync(marker())) throw new Error(`An earlier run was not restored: run the restore first (${marker()}).`);
  mkdirSync(p.backup, { recursive: true });
  const registryFile = join(p.backup, 'registry.reg');
  execFileSync('reg.exe', ['export', REGISTRY_KEY, registryFile, '/y'], { stdio: 'ignore' });
  const logs: string[] = [];
  for (const name of ['Player.log', 'Player-prev.log']) {
    const f = join(unityLogDir(), name);
    if (existsSync(f)) {
      copyFileSync(f, join(p.backup, name));
      logs.push(name);
    }
  }
  const playerDataDir = join(timberbornDocs(), 'PlayerData');
  const playerData: string[] = [];
  if (existsSync(playerDataDir))
    for (const name of readdirSync(playerDataDir)) {
      const f = join(playerDataDir, name);
      if (statSync(f).isFile()) {
        copyFileSync(f, join(p.backup, 'PlayerData.' + name));
        playerData.push(name);
      }
    }
  const snap: Snapshot = {
    at: new Date().toISOString(),
    registryFile,
    registryValues: registryValues(),
    logs,
    playerData,
    saves: { ...listFiles(join(timberbornDocs(), 'Saves')), ...prefixed('ExperimentalSaves', listFiles(join(timberbornDocs(), 'ExperimentalSaves'))) },
    saveDirs: [...listDirs(join(timberbornDocs(), 'Saves')), ...listDirs(join(timberbornDocs(), 'ExperimentalSaves'))],
    docs: listFiles(timberbornDocs(), DOCS_SKIP),
  };
  writeFileSync(marker(), JSON.stringify(snap, null, 1));
  return snap;
}

function prefixed(prefix: string, l: Listing): Listing {
  return Object.fromEntries(Object.entries(l).map(([k, v]) => [`..\\${prefix}\\${k}`, v]));
}

export interface RestoreReport {
  registryChanged: string[];
  registryRestored: boolean;
  logsRestored: string[];
  playerDataRestored: string[];
  savesDeleted: string[];
  savesChanged: string[];
  docsMoved: string[];
  docsChanged: string[];
}

export function hasPendingRestore(): boolean {
  return existsSync(marker());
}

/**
 * Put Kyler's game back: settings, logs and player data as they were; files the probe's games created
 * under Saves deleted; other new files under Documents\Timberborn (error reports, for instance) moved
 * into the run's folder. Files that existed before and changed are reported, never deleted.
 * `keepLogsIn` receives the probe's own Player.log files.
 */
export function restore(keepLogsIn: string | null, opts: { registry?: boolean } = {}): RestoreReport {
  if (isGameRunning()) throw new Error('Timberborn is running: the restore waits until it has quit.');
  const p = probePaths();
  const snap = JSON.parse(readFileSync(marker(), 'utf8')) as Snapshot;
  const report: RestoreReport = { registryChanged: [], registryRestored: false, logsRestored: [], playerDataRestored: [], savesDeleted: [], savesChanged: [], docsMoved: [], docsChanged: [] };

  // Settings: compare value by value; if anything differs, put the exported key back whole.
  const now = opts.registry === false ? snap.registryValues : registryValues();
  const names = new Set([...Object.keys(now), ...Object.keys(snap.registryValues)]);
  for (const n of names) if (now[n] !== snap.registryValues[n]) report.registryChanged.push(n);
  if (report.registryChanged.length) {
    execFileSync('reg.exe', ['delete', REGISTRY_KEY, '/f'], { stdio: 'ignore' });
    execFileSync('reg.exe', ['import', snap.registryFile], { stdio: 'ignore' });
    const again = registryValues();
    const still = [...new Set([...Object.keys(again), ...Object.keys(snap.registryValues)])].filter((n) => again[n] !== snap.registryValues[n]);
    if (still.length) throw new Error(`The registry restore left ${still.length} values different: ${still.slice(0, 5).join(', ')}`);
    report.registryRestored = true;
  }

  // Unity logs: keep the probe's, put Kyler's back.
  if (keepLogsIn) mkdirSync(keepLogsIn, { recursive: true });
  for (const name of ['Player.log', 'Player-prev.log']) {
    const f = join(unityLogDir(), name);
    if (keepLogsIn && existsSync(f)) copyFileSync(f, join(keepLogsIn, name === 'Player.log' ? 'Player.log' : 'Player-prev.probe.log'));
    if (snap.logs.includes(name)) {
      copyFileSync(join(p.backup, name), f);
      report.logsRestored.push(name);
    } else if (existsSync(f)) rmSync(f);
  }

  // Player data (small files, synced by Steam Cloud): restore any that changed.
  const playerDataDir = join(timberbornDocs(), 'PlayerData');
  for (const name of snap.playerData) {
    const f = join(playerDataDir, name);
    const b = join(p.backup, 'PlayerData.' + name);
    if (!existsSync(f) || !readFileSync(f).equals(readFileSync(b))) {
      copyFileSync(b, f);
      report.playerDataRestored.push(name);
    }
  }

  // Saves: delete what the probe's games created; report (never touch) what changed.
  const savesRoot = join(timberbornDocs(), 'Saves');
  const saves = { ...listFiles(savesRoot), ...prefixed('ExperimentalSaves', listFiles(join(timberbornDocs(), 'ExperimentalSaves'))) };
  for (const [rel, st] of Object.entries(saves)) {
    const before = snap.saves[rel];
    if (!before) {
      rmSync(join(savesRoot, rel));
      report.savesDeleted.push(rel);
    } else if (before.size !== st.size || before.mtimeMs !== st.mtimeMs) report.savesChanged.push(rel);
  }
  // Only folders the probe's games created, once empty; Kyler's own folders stay even if empty.
  const keep = new Set(snap.saveDirs);
  for (const dir of [...listDirs(savesRoot), ...listDirs(join(timberbornDocs(), 'ExperimentalSaves'))].sort((a, b) => b.length - a.length))
    if (!keep.has(dir) && readdirSync(dir).length === 0) {
      rmSync(dir, { recursive: true });
      report.savesDeleted.push(dir + '\\');
    }

  // Anything else new under Documents\Timberborn: moved into the run's folder, so it leaves no trace.
  const docs = listFiles(timberbornDocs(), DOCS_SKIP);
  for (const [rel, st] of Object.entries(docs)) {
    const before = snap.docs[rel];
    if (!before) {
      if (keepLogsIn) {
        const to = join(keepLogsIn, 'created', rel);
        mkdirSync(dirname(to), { recursive: true });
        renameSync(join(timberbornDocs(), rel), to);
      } else rmSync(join(timberbornDocs(), rel));
      report.docsMoved.push(rel);
    } else if (before.size !== st.size || before.mtimeMs !== st.mtimeMs) report.docsChanged.push(rel);
  }

  rmSync(marker());
  return report;
}

/** Every folder under root (absolute paths), root included. */
function listDirs(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const walk = (dir: string) => {
    out.push(dir);
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      try {
        if (statSync(full).isDirectory()) walk(full);
      } catch {
        // vanished while listing
      }
    }
  };
  walk(root);
  return out;
}
/**
 * A copy of the game's settings kept by hand, before a launch: the whole registry key as a .reg file, and
 * the mods' on/off values and load order in plain text. Nothing is changed.
 */
export function backupSettings(): { dir: string; regFile: string; modsFile: string } {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = join(probePaths().home, 'settings-backup', stamp);
  mkdirSync(dir, { recursive: true });
  const regFile = join(dir, 'Timberborn-settings.reg');
  execFileSync('reg.exe', ['export', REGISTRY_KEY, regFile, '/y'], { stdio: 'ignore' });
  const values = registryValues();
  const mods = Object.entries(values)
    .filter(([k]) => /^Mod(Enabled|Priority)\./.test(k))
    .map(([k, v]) => `${k.replace(/_h\d+$/, '')} = ${Number.parseInt(v.split(' ')[1], 16) | 0}`)
    .sort();
  const modsFile = join(dir, 'mod-settings.txt');
  writeFileSync(modsFile, [`Timberborn mod settings on ${new Date().toISOString()} (from ${REGISTRY_KEY}).`, 'ModEnabled: 1 on, 0 off; a mod with no line is on. ModPriority: load order.', '', ...mods, ''].join('\r\n'));
  return { dir, regFile, modsFile };
}

/** A .reg export read into value name → its exact text (type and data), continuation lines joined. */
export function parseRegFile(file: string): Map<string, string> {
  const buf = readFileSync(file);
  const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le').slice(1) : buf.toString('utf8');
  const out = new Map<string, string>();
  const lines = text.replace(/\\\r?\n\s*/g, '').split(/\r?\n/);
  for (const line of lines) {
    const m = /^"((?:[^"\\]|\\.)*)"=(.*)$/.exec(line);
    if (m) out.set(m[1].replace(/\\(.)/g, '$1'), m[2].trim());
    else if (/^@=/.test(line)) out.set('(default)', line.slice(2).trim());
  }
  return out;
}

export interface SettingsDiff {
  equal: boolean;
  missing: string[];
  extra: string[];
  changed: string[];
}

/** The key as it is now against a .reg backup, value by value (types and data), load order included. */
export function compareWithBackup(backupReg: string): SettingsDiff {
  const now = join(probePaths().runner, `settings-now-${Date.now()}.reg`);
  mkdirSync(probePaths().runner, { recursive: true });
  execFileSync('reg.exe', ['export', REGISTRY_KEY, now, '/y'], { stdio: 'ignore' });
  const a = parseRegFile(backupReg), b = parseRegFile(now);
  rmSync(now, { force: true });
  const missing = [...a.keys()].filter((k) => !b.has(k));
  const extra = [...b.keys()].filter((k) => !a.has(k));
  const changed = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
  return { equal: !missing.length && !extra.length && !changed.length, missing, extra, changed };
}

export function handRestore(backupReg: string): string[] {
  return ['Close Timberborn, then in PowerShell:', `  reg delete "${REGISTRY_KEY}" /f`, `  reg import "${backupReg}"`];
}
