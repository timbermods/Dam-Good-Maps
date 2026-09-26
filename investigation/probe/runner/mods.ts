// Which mods load during a probe run. The game keeps each mod's on/off state in its settings (Unity
// PlayerPrefs, the registry key in paths.ts) under `ModEnabled.<source>.<folder>.<manifest id>`, and a
// mod without a value is on. For a run the runner turns every other mod off and DGM Probe on, so the
// probe measures the unmodified game and no other mod's panels or files get involved; the restore in
// safety.ts puts the whole key back exactly as it was afterwards.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GAME_DIR, REGISTRY_KEY, timberbornDocs } from './paths';

export const PROBE_MOD_ID = 'kyler.dgmprobe';
export const PROBE_MOD_FOLDER = 'DGMProbe';

export interface InstalledMod {
  source: 'Local' | 'Steam Workshop';
  folder: string;
  id: string;
}

/** Unity's PlayerPrefs value name: the key and `_h` with a djb2-xor hash of its UTF-8 bytes. */
export function prefsValueName(key: string): string {
  let h = 5381 >>> 0;
  for (const b of Buffer.from(key, 'utf8')) h = (Math.imul(h, 33) ^ b) >>> 0;
  return `${key}_h${h}`;
}

function manifestIds(dir: string): string[] {
  const ids: string[] = [];
  const read = (f: string) => {
    try {
      const id = JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')).Id;
      if (typeof id === 'string' && id.trim()) ids.push(id);
    } catch {
      // not a readable manifest
    }
  };
  if (existsSync(join(dir, 'manifest.json'))) read(join(dir, 'manifest.json'));
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const sub = join(dir, name);
    if (/^version-/.test(name) && statSync(sub).isDirectory() && existsSync(join(sub, 'manifest.json'))) read(join(sub, 'manifest.json'));
  }
  return [...new Set(ids)];
}

export function installedMods(): InstalledMod[] {
  const mods: InstalledMod[] = [];
  const local = join(timberbornDocs(), 'Mods');
  if (existsSync(local))
    for (const folder of readdirSync(local)) {
      const dir = join(local, folder);
      if (!statSync(dir).isDirectory()) continue;
      for (const id of manifestIds(dir)) mods.push({ source: 'Local', folder, id });
    }
  const workshop = join(GAME_DIR, '..', '..', 'workshop', 'content', '1062090');
  if (existsSync(workshop))
    for (const folder of readdirSync(workshop)) {
      const dir = join(workshop, folder);
      if (!statSync(dir).isDirectory()) continue;
      for (const id of manifestIds(dir)) mods.push({ source: 'Steam Workshop', folder, id });
    }
  return mods;
}

export const enabledKey = (m: InstalledMod) => `ModEnabled.${m.source}.${m.folder}.${m.id}`;

/** Only DGM Probe on, every other installed mod off. Returns what it set. */
export function probeOnly(): { on: string[]; off: string[] } {
  const on: string[] = [];
  const off: string[] = [];
  for (const m of installedMods()) {
    const isProbe = m.source === 'Local' && m.folder === PROBE_MOD_FOLDER && m.id === PROBE_MOD_ID;
    const name = prefsValueName(enabledKey(m));
    execFileSync('reg.exe', ['add', REGISTRY_KEY, '/v', name, '/t', 'REG_DWORD', '/d', isProbe ? '1' : '0', '/f'], { stdio: 'ignore' });
    (isProbe ? on : off).push(`${m.source}/${m.folder} (${m.id})`);
  }
  if (!on.length) throw new Error('DGM Probe is not installed: run the build-mod step first.');
  return { on, off };
}
