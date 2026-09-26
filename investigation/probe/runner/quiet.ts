// Full batches wait until the machine is quiet: another session builds milestones here and measures speed
// budgets, so its tests, batches, benchmarks and browser runs must not share the machine with a batch.
import { execFileSync } from 'node:child_process';
import { PROBE_DIR } from './paths';

/** Browsers count only when a test drives them (headless, or with a debugging port). */
const BROWSER = /^(chrome|msedge|chromium|headless_shell|chrome-headless-shell|firefox)\.exe$/i;
const DRIVEN = [/--headless/i, /--remote-debugging/i];
const HEAVY = [
  /vitest/i,
  /playwright/i,
  /ms-playwright/i,
  /tools[\\/](batch|bench|bench3d|bench-preview|oracle|gen|capture-look|ingame-files|spike-check)\.ts/i,
  /investigation[\\/]cycles[\\/](run\.cjs|batch|fidelity|journey|calibrate)/i,
  /prototype[\\/].*\.py/i,
  /vite(\.js)? (build|preview)/i,
];

export interface Busy {
  pid: number;
  name: string;
  why: string;
}

/** Processes that look like the other session's heavy work (never this probe's own). */
export function heavyProcesses(): Busy[] {
  let text = '';
  try {
    text = execFileSync('powershell.exe', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | ForEach-Object { \"$($_.ProcessId)`t$($_.Name)`t$($_.CommandLine)\" }"], { encoding: 'utf8', maxBuffer: 64 << 20 });
  } catch {
    return [];
  }
  const own = PROBE_DIR.toLowerCase();
  const out: Busy[] = [];
  for (const line of text.split(/\r?\n/)) {
    const [pid, name, ...rest] = line.split('\t');
    const cmd = rest.join('\t');
    if (!cmd || cmd.toLowerCase().includes(own) || Number(pid) === process.pid) continue;
    const hit = HEAVY.find((re) => re.test(cmd)) ?? (BROWSER.test(name) ? DRIVEN.find((re) => re.test(cmd)) : undefined);
    if (hit) out.push({ pid: Number(pid), name, why: cmd.slice(0, 160) });
  }
  return out;
}

/** The processors' load, in percent (averaged over a few samples). */
export function cpuLoad(): number {
  try {
    const t = execFileSync('powershell.exe', ['-NoProfile', '-Command', '(Get-Counter "\\Processor(_Total)\\% Processor Time" -SampleInterval 2 -MaxSamples 3).CounterSamples | Measure-Object -Property CookedValue -Average | ForEach-Object { $_.Average }'], { encoding: 'utf8' });
    return Number(t.trim()) || 0;
  } catch {
    return 0;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits (retrying every `everyMinutes`) until no heavy process runs and the load is under `maxLoad`. */
export async function waitQuiet(log: (s: string) => void, maxHours = 12, everyMinutes = 5, maxLoad = 35): Promise<boolean> {
  const until = Date.now() + maxHours * 3600e3;
  for (;;) {
    const heavy = heavyProcesses();
    const load = heavy.length ? 100 : cpuLoad();
    if (!heavy.length && load < maxLoad) {
      log(`machine quiet (load ${load.toFixed(0)}%)`);
      return true;
    }
    log(heavy.length ? `waiting: ${heavy.length} heavy processes of the other session (${heavy.slice(0, 3).map((h) => `${h.name} ${h.why}`).join(' | ')})` : `waiting: processor load ${load.toFixed(0)}%`);
    if (Date.now() > until) return false;
    await sleep(everyMinutes * 60e3);
  }
}
