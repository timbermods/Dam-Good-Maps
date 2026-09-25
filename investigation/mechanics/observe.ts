import { generate as coreGenerate } from '../../src/core/gen/generate';
import { measureOpening } from './measure';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function generate(...args: Parameters<typeof coreGenerate>) {
  const r = coreGenerate(...args);
  const root = fileURLToPath(new URL('.', import.meta.url));
  const folder = resolve(root, process.env.MECHANICS_ROWS ?? 'results/rows');
  if (!folder.startsWith(root)) throw new Error('Results must stay under investigation/mechanics');
  const path = resolve(folder, `${r.spec.theme}-${String(r.spec.seed).padStart(2, '0')}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({
    theme: r.spec.theme, seed: r.spec.seed, size: r.spec.size, difficulty: r.spec.designedFor,
    generatorVersion: r.spec.generatorVersion, attempts: r.attempts, failures: r.failures,
    passed: r.report.passed, sha256: createHash('sha256').update(r.bytes).digest('hex'),
    spec: r.spec, checks: r.report.checks.map(({ where, fix, ...c }) => c),
    metrics: measureOpening(r)
  }, (_key, value) => typeof value === 'number' && !Number.isFinite(value) ? null : value, 2) + '\n');
  return r;
}
