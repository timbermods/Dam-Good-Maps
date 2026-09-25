import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
const here = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('../../', import.meta.url));
const themes = ['riverValley', 'canyon', 'highlands', 'lakeBasin', 'delta', 'islands'];
const seeds = process.argv[2] ?? '1-30';
const selected = process.argv[3] ? [process.argv[3]] : themes;
mkdirSync(new URL('results/logs/', import.meta.url), { recursive: true });
let failed = 0;
for (const theme of selected) {
  if (!themes.includes(theme)) throw new Error('Unknown theme');
  const args = ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', `${here}runtime.mjs`, `${repo}tools/gen.ts`,
    '--seeds', seeds, '--sizes', '128', '--difficulty', 'normal', '--out', `${here}results/maps/${theme}`];
  console.log(`Generating ${theme} seeds ${seeds} via tools/gen.ts`);
  const r = spawnSync(process.execPath, args, {
    cwd: repo, env: { ...process.env, MECHANICS_THEME: theme },
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true
  });
  writeFileSync(new URL(`results/logs/${theme}.txt`, import.meta.url), `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? r.error.message : ''}`);
  console.log(r.stdout?.trim().split('\n').at(-1) ?? r.error?.message ?? 'No output');
  if (r.status !== 0) { failed++; console.error(r.stderr); }
}
process.exitCode = failed ? 1 : 0;
