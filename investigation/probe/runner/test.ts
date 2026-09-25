// The runner's checks without the game: npm --prefix investigation/probe test
// Everything runs in a sandbox: a temporary Documents folder, a throwaway registry key
// (HKCU\Software\DGMProbeTest\Timberborn) and a stand-in game (a copy of node.exe named
// FakeTimberborn.exe running test/fake-game.cjs). Kyler's own settings, saves and game are never touched.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sandbox = mkdtempSync(join(tmpdir(), 'dgm-probe-test-'));
const TEST_KEY = 'HKCU\\Software\\DGMProbeTest\\Timberborn';
process.env.DGM_PROBE_DOCUMENTS = join(sandbox, 'Documents');
process.env.DGM_PROBE_REGISTRY_KEY = TEST_KEY;
process.env.DGM_PROBE_UNITY_LOGS = join(sandbox, 'LocalLow');
process.env.DGM_PROBE_GAME_PROCESS = 'FakeTimberborn';
const fakeExe = join(sandbox, 'FakeTimberborn.exe');
copyFileSync(process.execPath, fakeExe);
process.env.DGM_PROBE_LAUNCH = JSON.stringify([fakeExe, join(__dirname, 'test', 'fake-game.cjs')]);

/* eslint-disable @typescript-eslint/no-require-imports */
const paths = require('./paths') as typeof import('./paths');
const safety = require('./safety') as typeof import('./safety');
const consent = require('./consent') as typeof import('./consent');
const mods = require('./mods') as typeof import('./mods');
const launch = require('./launch') as typeof import('./launch');
const catalogM = require('./catalog') as typeof import('./catalog');
const jobs = require('./jobs') as typeof import('./jobs');
const compare = require('./compare') as typeof import('./compare');
const mapfile = require('./mapfile') as typeof import('./mapfile');

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`);
  if (!ok) failures++;
};

async function main(): Promise<void> {
  if (paths.REGISTRY_KEY !== TEST_KEY || !paths.timberbornDocs().startsWith(sandbox)) throw new Error('the sandbox is not in place; refusing to run');
  const docs = paths.timberbornDocs();
  const logs = paths.unityLogDir();
  for (const d of ['Saves/Kyler colony', 'Saves/Empty folder', 'PlayerData', 'Mods/SomeMod/version-1.1', 'Mods/DGMProbe/version-1.1']) mkdirSync(join(docs, d), { recursive: true });
  mkdirSync(logs, { recursive: true });
  writeFileSync(join(docs, 'Saves/Kyler colony/Day 12.timber'), 'kyler save');
  writeFileSync(join(docs, 'PlayerData/player.data'), 'player data');
  writeFileSync(join(docs, 'Mods/SomeMod/version-1.1/manifest.json'), JSON.stringify({ Id: 'someone.somemod' }));
  writeFileSync(join(docs, 'Mods/DGMProbe/version-1.1/manifest.json'), JSON.stringify({ Id: mods.PROBE_MOD_ID }));
  writeFileSync(join(logs, 'Player.log'), 'kyler log');
  writeFileSync(join(logs, 'Player-prev.log'), 'kyler prev log');
  execFileSync('reg.exe', ['add', TEST_KEY, '/v', 'KylerSetting_h7', '/t', 'REG_DWORD', '/d', '5', '/f'], { stdio: 'ignore' });

  // 1. Unity's PlayerPrefs names
  check('prefs hash', mods.prefsValueName('ModEnabled.Local.MixedStorage.kyler.mixedstorage') === 'ModEnabled.Local.MixedStorage.kyler.mixedstorage_h637420546' && mods.prefsValueName('GraphicsQuality') === 'GraphicsQuality_h1581385789');

  // 1b. the game's own list of loaded mods, read from its log
  const sampleLog = 'Successfully connected to the Steam client.\nModded: true, official\n- DGM Probe (v0.1.0)\n- Harmony (v2.4.1)\n[DGMProbe] job x\n';
  check('loaded mods from the game log', JSON.stringify(launch.loadedMods(sampleLog)) === JSON.stringify(['DGM Probe (v0.1.0)', 'Harmony (v2.4.1)']) && launch.loadedMods('no mods').length === 0);

  // 2. consent: a code works once, for its own plan only
  const plan = { kind: 'smoke' as const, estimateMinutes: 3, maps: [{ id: 'a', title: 'A', checks: ['x'], days: 1 }] };
  const other = { ...plan, maps: [{ id: 'b', title: 'B', checks: ['x'], days: 1 }] };
  let code = consent.requestConsent(plan);
  check('consent: wrong plan refused', !consent.consumeConsent(other, code));
  code = consent.requestConsent(plan);
  check('consent: right plan accepted once', consent.consumeConsent(plan, code) && !consent.consumeConsent(plan, code));
  check('consent: the description says it launches Timberborn', /LAUNCHES TIMBERBORN/.test(consent.describe(plan)));

  // 3. the catalog builds every game's job offline (maps generated, poses, moments)
  const t0 = Date.now();
  const games = catalogM.catalog([join(paths.REPO, 'out', 'm8', 'River Valley (4242) M8 preview.timber')]);
  const prepared = jobs.prepare(games, 'test-run');
  const job = jobs.makeJob('test-run', prepared, 99);
  check('catalog: every game prepared', prepared.length === games.length, `${games.length} games in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  check('catalog: every map has a start moment with shots and an end', job.maps.every((m) => m.moments[0].id === 'start' && m.moments[0].shots.length > 0 && m.moments.some((x) => x.id === 'end')));
  check('catalog: moments inside each game', job.maps.every((m) => m.moments.every((x) => x.day >= catalogM.D0 - 1e-9 && x.day < m.endDay)));
  const high = prepared.filter((p) => p.game.group === 'High terrain');
  check('high terrain: three maps up to level 21, top layer empty', high.length === 3 && high.every((p) => p.info.maxHeight >= 17 && p.info.maxHeight <= 21), high.map((p) => `${p.game.id} max ${p.info.maxHeight}`).join(', '));
  const mesa = high.find((p) => p.game.id === 'high-highlands-mesa21');
  check('high terrain: the mesa carries objects above 16', !!mesa && mesa.info.entities.filter((e) => e.z > 16).length >= 7);
  const look = prepared.filter((p) => p.game.group === 'Map look');
  check('Map look: poses from the captures', look.filter((p) => p.map.poses.some((x) => x.lookCapture && existsSync(join(paths.REPO, x.lookCapture)))).length >= 7, look.map((p) => `${p.game.id} ${p.map.poses.filter((x) => x.lookCapture).length}`).join(', '));
  const cal = prepared.find((p) => p.game.id === 'cal-rv2')!;
  check('calibration: the drought and badtide moments', ['drought1-start', 'drought1-day1', 'badtide2-start', 'badtide2-day1'].every((id) => cal.map.moments.some((m) => m.id === id)));
  const e4 = prepared.find((p) => p.game.id === 'e4-no-start')!;
  check('E4: no StartingLocation, and it runs last', !e4.info.start && prepared[prepared.length - 1].game.id === 'e4-no-start');
  const pending = prepared.flatMap((p) => p.checks.map((c) => c.id));
  check('checks: ML-1 (received) is left out, ML-2 (pending) is in', !pending.includes('ML-1') && pending.includes('ML-2'));

  // 4. compare: a result that holds the file's own water passes the water check
  const m8 = prepared.find((p) => p.game.id === 'm8-preview')!;
  const resDir = join(sandbox, 'compare');
  mkdirSync(resDir, { recursive: true });
  const snap = (id: string, day: number) => ({ momentId: id, day, tick: 0, weather: 'temperate', width: m8.info.W, height: m8.info.H, depth: [...m8.info.depth], contamination: [...m8.info.contamination], floor: [...m8.info.floor], moisture: [...m8.info.moisture], soilContamination: [...m8.info.soilContamination], terrain: [...m8.info.heights], terrainColumns: new Array(m8.info.W * m8.info.H).fill(1), layered: [], plants: [], sources: [] });
  const zlib = require('node:zlib') as typeof import('node:zlib');
  const snaps: string[] = [];
  for (const m of m8.map.moments.filter((x) => x.snapshot)) {
    const f = `m8-preview-${m.id.replace(/[^A-Za-z0-9_-]/g, '_')}.snapshot.json.gz`;
    writeFileSync(join(resDir, f), zlib.gzipSync(JSON.stringify(snap(m.id, m.day))));
    snaps.push(f);
  }
  const entities = m8.info.entities.filter((e) => e.template !== 'StartingLocation').map((e) => ({ id: e.id, template: e.template, x: e.x, y: e.y, z: e.z, orientation: e.orientation }));
  const result = { runId: 't', mapId: 'm8-preview', title: 't', mapFile: '', status: 'done', log: [], notes: [], samples: [], snapshots: snaps, shots: [], entitiesAtStart: entities, entitiesAtEnd: entities, plantDeaths: [], loadingIssues: [], weather: [], weatherEvents: [], actions: [], start: { districtCenter: { id: 'dc', template: 'DistrictCenter.Folktails', x: 44, y: 54, z: 8, orientation: 'Cw0' }, adults: 9, children: 4, bots: 0 } } as unknown as import('./job').MapResult;
  const L = new compare.Loaded(resDir, m8, result);
  const v = compare.evaluate({ L, others: new Map(), model: null, modelError: null }, m8.checks);
  const get = (id: string) => v.find((x) => x.id === id)!;
  check('compare: water held → water passed', get('water').verdict === 'passed', get('water').detail);
  check('compare: terrain and objects passed', get('terrain').verdict === 'passed' && get('objects').verdict === 'passed', `${get('terrain').detail} | ${get('objects').detail}`);
  check('compare: M8-1a passed on the file itself', get('M8-1a').verdict === 'passed', get('M8-1a').detail);
  // a drained river fails
  const day1 = m8.map.moments.filter((x) => x.snapshot).sort((a, b) => Math.abs(a.day - catalogM.D0 - 1) - Math.abs(b.day - catalogM.D0 - 1))[0];
  const drained = snap(day1.id, day1.day);
  drained.depth = drained.depth.map((d, t) => (t % 3 === 0 ? 0 : d));
  writeFileSync(join(resDir, snaps.find((s) => s.endsWith(`-${day1.id.replace(/[^A-Za-z0-9_-]/g, '_')}.snapshot.json.gz`))!), zlib.gzipSync(JSON.stringify(drained)));
  const L2 = new compare.Loaded(resDir, m8, result);
  const w2 = compare.evaluate({ L: L2, others: new Map(), model: null, modelError: null }, [m8.checks.find((c) => c.id === 'water')!])[0];
  check('compare: a drained map fails the water check', w2.verdict === 'failed', w2.detail);

  // 5a. the hand-kept settings backup: a .reg file of the whole key and the mods' values in text
  execFileSync('reg.exe', ['add', TEST_KEY, '/v', mods.prefsValueName('ModPriority.Local.SomeMod.someone.somemod'), '/t', 'REG_DWORD', '/d', '4294967295', '/f'], { stdio: 'ignore' });
  const b = safety.backupSettings();
  const reg = readFileSync(b.regFile, 'utf16le');
  const listed = readFileSync(b.modsFile, 'utf8');
  check('settings backup: the .reg file holds the key', reg.includes('DGMProbeTest\\Timberborn') && reg.includes('KylerSetting_h7'));
  check('settings backup: mod values in plain text', /ModPriority\.Local\.SomeMod\.someone\.somemod = -1/.test(listed), listed.split('\r\n').slice(3).join(' | '));

  // 5. snapshot and restore: settings, logs, player data, saves
  const small = jobs.makeJob('fake-run', prepared.slice(0, 4), 99);
  const snapInfo = safety.takeSnapshot();
  check('snapshot: refuses a second one before a restore', (() => {
    try {
      safety.takeSnapshot();
      return false;
    } catch {
      return true;
    }
  })());
  const set = mods.probeOnly();
  check('mods: only DGM Probe on for the run', set.on.length === 1 && set.off.some((s) => s.includes('someone.somemod')), `on ${set.on.join(', ')}; off ${set.off.length}`);

  // 6. the watchdog: a crash on map 2, a hang on map 3, and relaunches for the rest
  process.env.FAKE_CRASH = small.maps[1].id;
  process.env.FAKE_HANG = small.maps[2].id;
  const lines: string[] = [];
  const logsRun = await launch.runJob(small, { hangSeconds: 6, startSeconds: 20, mapSeconds: 60, maxLaunches: 5, log: (s) => lines.push(s) });
  const results = launch.mapsWithResults(small);
  check('watchdog: every map has a result', small.maps.every((m) => results.has(m.id)), logsRun.map((l) => `${l.launch} ${l.outcome}`).join(', '));
  check('watchdog: the crash and the hang were caught', logsRun.some((l) => l.outcome === 'crashed' || l.outcome === 'exited') && logsRun.some((l) => l.outcome === 'hung'));
  const failed = small.maps.filter((m) => JSON.parse(readFileSync(join(launch.resultsDir(small.runId), `${m.id}.json`), 'utf8')).status === 'failed').map((m) => m.id);
  check('watchdog: the hung map is recorded as failed', failed.includes(small.maps[2].id), failed.join(', '));
  check('watchdog: the game is gone and the job file removed', !safety.isGameRunning() && !existsSync(paths.probePaths().job));

  writeFileSync(join(docs, 'PlayerData/player.data'), 'changed by the game');
  const r = safety.restore(join(sandbox, 'kept'));
  const values = safety.registryValues();
  check('restore: settings back exactly', r.registryRestored && JSON.stringify(values) === JSON.stringify(snapInfo.registryValues), Object.keys(values).join(', '));
  check('restore: logs back', readFileSync(join(logs, 'Player.log'), 'utf8') === 'kyler log' && readFileSync(join(logs, 'Player-prev.log'), 'utf8') === 'kyler prev log');
  check('restore: player data back', readFileSync(join(docs, 'PlayerData/player.data'), 'utf8') === 'player data');
  check("restore: the probe's saves deleted, Kyler's kept", !existsSync(join(docs, 'Saves/DGMProbe fake')) && existsSync(join(docs, 'Saves/Kyler colony/Day 12.timber')) && existsSync(join(docs, 'Saves/Empty folder')), r.savesDeleted.join(', '));
  check('restore: error reports moved out', !existsSync(join(docs, 'Error reports')) || require('node:fs').readdirSync(join(docs, 'Error reports')).length === 0, r.docsMoved.join(', '));
  check('restore: the marker is gone', !safety.hasPendingRestore());

  // 7. the exact comparison with a settings backup, load order and long binary values included
  execFileSync('reg.exe', ['add', TEST_KEY, '/v', 'LongBinary_h9', '/t', 'REG_BINARY', '/d', '41'.repeat(120), '/f'], { stdio: 'ignore' });
  const ref = safety.backupSettings().regFile;
  const same = safety.compareWithBackup(ref);
  check('settings check: equal right after the backup', same.equal, JSON.stringify(same));
  const prio = mods.prefsValueName('ModPriority.Local.SomeMod.someone.somemod');
  execFileSync('reg.exe', ['add', TEST_KEY, '/v', prio, '/t', 'REG_DWORD', '/d', '0', '/f'], { stdio: 'ignore' });
  execFileSync('reg.exe', ['add', TEST_KEY, '/v', 'Added_h1', '/t', 'REG_DWORD', '/d', '1', '/f'], { stdio: 'ignore' });
  const diff = safety.compareWithBackup(ref);
  check('settings check: a changed load order and an added value are caught', !diff.equal && diff.changed.includes(prio) && diff.extra.includes('Added_h1'), JSON.stringify(diff));
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(() => {
    try {
      execFileSync('reg.exe', ['delete', 'HKCU\\Software\\DGMProbeTest', '/f'], { stdio: 'ignore' });
    } catch {
      // not there
    }
    for (const pid of safety.gameProcessIds()) execFileSync('taskkill.exe', ['/PID', String(pid), '/F'], { stdio: 'ignore' });
    try {
      rmSync(sandbox, { recursive: true, force: true });
    } catch {
      // a file still held
    }
    console.log(failures ? `${failures} FAILED` : 'all passed');
    process.exitCode = failures ? 1 : 0;
  });
void mapfile;
