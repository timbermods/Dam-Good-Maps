// A run's summary in Markdown (results/<run>/summary.md, outside the repository): the counts, each
// check's verdict and numbers by group, every error the game logged, and the run itself.
import { writeFileSync } from 'node:fs';
import { type GameVerdicts, Loaded, logProblems } from './compare';
import type { Prepared } from './jobs';

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function counts(verdicts: GameVerdicts[]): Record<string, number> {
  const c: Record<string, number> = { passed: 0, failed: 0, 'not measurable': 0, recorded: 0 };
  for (const g of verdicts) for (const x of g.checks) c[x.verdict] = (c[x.verdict] ?? 0) + 1;
  return c;
}

export function writeSummary(file: string, runId: string, prepared: Prepared[], loaded: Map<string, Loaded>, verdicts: GameVerdicts[]): void {
  const out: string[] = [];
  const c = counts(verdicts);
  out.push(`# DGM Probe run ${runId}`, '');
  out.push(`${verdicts.length} maps. Checks: ${c.passed} passed, ${c.failed} failed, ${c['not measurable']} not measurable, ${c.recorded} recorded.`, '');
  const groups = [...new Set(verdicts.map((v) => v.group))];
  for (const g of groups) {
    out.push(`## ${g}`, '');
    out.push('| Map | Check | Result | Numbers |', '|---|---|---|---|');
    for (const v of verdicts.filter((x) => x.group === g))
      for (const x of v.checks) out.push(`| ${esc(v.title)} | ${x.id} | ${x.verdict} | ${esc(x.detail)} |`);
    out.push('');
  }
  out.push('## Runs', '', '| Map | Status | Ticks | Real s | Speed | Shots | Loading issues | Log errors | Warnings | Notes |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const p of prepared) {
    const r = loaded.get(p.game.id)?.result;
    if (!r) {
      out.push(`| ${esc(p.game.title)} | no result | | | | | | | | |`);
      continue;
    }
    const lp = logProblems(r);
    out.push(`| ${esc(p.game.title)} | ${r.status}${r.failure ? ': ' + esc(r.failure) : ''} | ${r.ticks ?? ''} | ${Math.round(r.realSeconds ?? 0)} | ${(r.meanSpeed ?? 0).toFixed(1)} | ${(r.shots ?? []).length} | ${(r.loadingIssues ?? []).length} | ${lp.errors.length} | ${lp.warnings} | ${esc((r.notes ?? []).join('; '))} |`);
  }
  out.push('', '## Errors and warnings the game logged', '');
  for (const p of prepared) {
    const r = loaded.get(p.game.id)?.result;
    const lines = (r?.log ?? []).filter((l) => l.type !== 'Log');
    if (!lines.length) continue;
    out.push(`### ${p.game.title}`, '');
    const seen = new Map<string, number>();
    for (const l of lines) {
      const k = `${l.type}: ${l.message.split('\n')[0].slice(0, 240)}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    for (const [k, n] of seen) out.push(`- ${esc(k)}${n > 1 ? ` (${n}×)` : ''}`);
    out.push('');
  }
  writeFileSync(file, out.join('\n') + '\n');
}
