// One command runs everything:
//   npm --prefix investigation/probe run batch -- [maps.timber ...] [--smoke] [--only id,id] [--group name]
//       [--confirmed-launch CODE] [--run-id ID] [--speed 99] [--no-wait]
//   npm --prefix investigation/probe run batch -- --compare-only RUN_ID
//   npm --prefix investigation/probe run batch -- --restore-only
// Without --confirmed-launch it only prints the plan (maps, checks, time, and that it launches Timberborn)
// and a one-time code; Kyler's yes is needed for every launch (runner/consent.ts).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildMod } from './build-mod';
import { catalog, type GameDef } from './catalog';
import { evaluate, type GameVerdicts, Loaded } from './compare';
import { askInTerminal, consumeConsent, describe, requestConsent } from './consent';
import type { MapResult } from './job';
import { makeJob, prepare, type Prepared, summary } from './jobs';
import { resultsDir, runJob } from './launch';
import { runModel, type ModelRun } from './model';
import { probeOnly } from './mods';
import { CHECKED_GAME_VERSION, gameVersion, isEntry, probePaths, REPO } from './paths';
import { waitQuiet } from './quiet';
import { hasPendingRestore, isGameRunning, restore, takeSnapshot } from './safety';
import { writeSheet } from './sheet';
import { writeSummary } from './summary';

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const log = (s: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

interface Plan {
  runId: string;
  kind: 'smoke' | 'batch';
  extraMaps: string[];
  gameIds: string[];
  speed: number;
  smokeDays?: number;
}

function selectGames(plan: Plan): GameDef[] {
  const all = catalog(plan.extraMaps);
  let games = plan.gameIds.length ? all.filter((g) => plan.gameIds.includes(g.id)) : all;
  if (plan.smokeDays) games = games.map((g) => ({ ...g, days: Math.min(g.days, plan.smokeDays!) }));
  return games;
}

function newRunId(kind: string): string {
  return `${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})/, '$1-$2')}-${kind}`;
}

function planFromArgs(): Plan {
  const valued = new Set(['--only', '--group', '--confirmed-launch', '--run-id', '--speed', '--compare-only', '--days']);
  // npm --prefix runs the script in investigation/probe; paths are meant from where the command was typed
  const extraMaps = argv.filter((a, i) => a.toLowerCase().endsWith('.timber') && !valued.has(argv[i - 1])).map((a) => resolve(process.env.INIT_CWD ?? process.cwd(), a));
  const smoke = flag('smoke');
  const all = catalog(extraMaps);
  let ids = opt('only')?.split(',') ?? [];
  if (opt('group')) ids = all.filter((g) => g.group === opt('group')).map((g) => g.id);
  if (smoke && !ids.length) ids = ['m8-preview'];
  if (smoke) ids = ids.slice(0, 1);
  const unknown = ids.filter((id) => !all.some((g) => g.id === id));
  if (unknown.length) throw new Error(`unknown games: ${unknown.join(', ')} (known: ${all.map((g) => g.id).join(', ')})`);
  return { runId: opt('run-id') ?? newRunId(smoke ? 'smoke' : 'batch'), kind: smoke ? 'smoke' : 'batch', extraMaps, gameIds: ids, speed: Number(opt('speed') ?? 99), smokeDays: smoke ? Number(opt('days') ?? 1) : undefined };
}

async function launch(plan: Plan, prepared: Prepared[]): Promise<void> {
  const p = probePaths();
  const dir = resultsDir(plan.runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 1));
  log('building and installing DGM Probe');
  buildMod(true);
  const snap = takeSnapshot();
  log(`recorded the game's settings, logs and saves (${Object.keys(snap.saves).length} save files)`);
  let restored = false;
  const doRestore = () => {
    if (restored) return;
    restored = true;
    const r = restore(join(dir, 'game-files'));
    writeFileSync(join(dir, 'restore.json'), JSON.stringify(r, null, 1));
    log(`restored: registry ${r.registryRestored ? `put back (${r.registryChanged.length} values had changed)` : 'unchanged'}; logs ${r.logsRestored.join(', ') || '-'}; player data ${r.playerDataRestored.join(', ') || 'unchanged'}; saves deleted ${r.savesDeleted.length}, saves changed ${r.savesChanged.length}; other new files moved ${r.docsMoved.length}`);
  };
  const onSignal = () => {
    log('interrupted: stopping the game and restoring');
    try {
      if (isGameRunning()) execFileSync('taskkill.exe', ['/IM', 'Timberborn.exe', '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // already gone
    }
    setTimeout(() => {
      doRestore();
      process.exit(130);
    }, 4000);
  };
  process.once('SIGINT', onSignal);
  try {
    const mods = probeOnly();
    log(`mods for the run: on ${mods.on.join(', ')}; off ${mods.off.length}`);
    const job = makeJob(plan.runId, prepared, plan.speed);
    const launches = await runJob(job, { hangSeconds: 240, startSeconds: 300, mapSeconds: Math.max(...job.maps.map((m) => m.timeoutSeconds)) + 300, maxLaunches: Math.max(3, Math.ceil(prepared.length / 3) + 2), log });
    writeFileSync(join(dir, 'launches.json'), JSON.stringify(launches, null, 1));
  } finally {
    process.removeListener('SIGINT', onSignal);
    // the restore waits for the game to be gone
    for (let i = 0; i < 30 && isGameRunning(); i++) await new Promise((r) => setTimeout(r, 1000));
    doRestore();
    if (existsSync(p.job)) rmSync(p.job);
  }
}

export function compareRun(plan: Plan): { verdicts: GameVerdicts[]; sheet: string } {
  const dir = resultsDir(plan.runId);
  const games = selectGames(plan);
  const prepared = prepare(games, plan.runId);
  const loaded = new Map<string, Loaded>();
  for (const p of prepared) {
    const f = join(dir, `${p.game.id}.json`);
    const r = existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as MapResult) : null;
    loaded.set(p.game.id, new Loaded(dir, p, r));
  }
  const verdicts: GameVerdicts[] = [];
  const models: Record<string, { cpuSeconds: number; error?: string }> = {};
  for (const p of prepared) {
    const L = loaded.get(p.game.id)!;
    let model: ModelRun | null = null, modelError: string | null = null;
    if (p.game.model && L.result?.status === 'done') {
      try {
        const sampleDays = L.samples().map((s) => s.day);
        const mapDays = p.map.moments.filter((m) => m.snapshot).map((m) => m.day);
        model = runModel(new Uint8Array(readFileSync(p.map.mapFile)), `${p.game.id}.timber`, p.game.cycles, p.map.endDay, p.map.tiles, sampleDays, mapDays);
        models[p.game.id] = { cpuSeconds: model.cpuSeconds };
      } catch (e) {
        modelError = (e as Error).message;
        models[p.game.id] = { cpuSeconds: 0, error: modelError };
      }
    }
    const checks = evaluate({ L, others: loaded, model, modelError }, p.checks);
    verdicts.push({ game: p.game.id, title: p.game.title, group: p.game.group, status: L.result?.status ?? 'no result', checks });
    log(`${p.game.id}: ${checks.map((c) => `${c.id} ${c.verdict}`).join(', ')}`);
  }
  writeFileSync(join(dir, 'verdicts.json'), JSON.stringify({ runId: plan.runId, models, verdicts }, null, 1));
  writeSummary(join(dir, 'summary.md'), plan.runId, prepared, loaded, verdicts);
  const sheet = writeSheet(probePaths().sheet, plan.runId, probePaths().shots, prepared.filter((p) => loaded.get(p.game.id)?.result).map((p) => ({
    result: loaded.get(p.game.id)!.result!,
    poses: p.map.poses,
    verdicts: verdicts.find((v) => v.game === p.game.id)!.checks.map((c) => ({ id: c.id, verdict: c.verdict, detail: c.detail })),
  })));
  log(`verdicts: ${join(dir, 'verdicts.json')}; summary: ${join(dir, 'summary.md')}; contact sheet: ${sheet}`);
  return { verdicts, sheet };
}

async function main(): Promise<void> {
  if (flag('restore-only')) {
    if (!hasPendingRestore()) return log('nothing to restore');
    const r = restore(join(probePaths().runner, 'restored-' + Date.now()));
    return log(`restored: ${JSON.stringify(r)}`);
  }
  if (hasPendingRestore()) {
    if (isGameRunning()) throw new Error('A probe run was not restored and Timberborn is running: close the game, then run the batch with --restore-only.');
    log('an earlier run was not restored: restoring first');
    restore(join(probePaths().runner, 'restored-' + Date.now()));
  }
  const compareOnly = opt('compare-only');
  if (compareOnly) {
    const plan = JSON.parse(readFileSync(join(resultsDir(compareOnly), 'plan.json'), 'utf8')) as Plan;
    compareRun(plan);
    return;
  }
  const plan = planFromArgs();
  const prepared = prepare(selectGames(plan), plan.runId);
  const s = summary(prepared, plan.kind);
  if (flag('job-only')) {
    writeFileSync(join(REPO, 'investigation', 'probe', '.cache', 'job-preview.json'), JSON.stringify(makeJob(plan.runId, prepared, plan.speed), null, 1));
    console.log(describe(s));
    return;
  }
  const code = opt('confirmed-launch');
  if (!code) {
    if (await askInTerminal(s)) {
      // a yes typed in this terminal is this run's consent
    } else {
      const fresh = requestConsent(s);
      console.log(describe(s));
      console.log(`\nNothing was launched. After Kyler's yes for exactly this run, repeat the command with --confirmed-launch ${fresh}${argv.includes('--run-id') ? '' : ` --run-id ${plan.runId}`}`);
      process.exitCode = 3;
      return;
    }
  } else if (!consumeConsent(s, code)) {
    throw new Error('The confirmation code does not match this plan (or was already used): run without --confirmed-launch to get a new one, and ask again.');
  }
  if (isGameRunning()) throw new Error('Timberborn is already running (Kyler may be playing): nothing was launched.');
  // The mod reads the game's internals as they are in the version it was checked against; after a game
  // update only a smoke run may go first.
  const version = gameVersion();
  if (version !== CHECKED_GAME_VERSION && plan.kind === 'batch' && !flag('allow-new-version'))
    throw new Error(`The game is ${version}, not ${CHECKED_GAME_VERSION}: run a smoke run first, then the batch with --allow-new-version.`);
  if (plan.kind === 'batch' && !flag('no-wait')) {
    const quiet = await waitQuiet(log);
    if (!quiet) throw new Error('The machine did not become quiet in time: nothing was launched.');
  }
  await launch(plan, prepared);
  compareRun(plan);
}

if (isEntry(__filename))
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
