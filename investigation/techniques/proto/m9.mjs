// Read this repository's M9 modules from a pinned commit. No checkout, install or network.
// Only generated JavaScript inside techniques/.cache is written; it is not committed.
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const M9_REV = 'a5f189d3e96affec533415090bdb8f09d606c8fd';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cache = resolve(root, 'investigation/techniques/.cache', M9_REV);
const seen = new Set();
function extract(path) {
  const dest = resolve(cache, path.replace(/\.ts$/, '.mjs'));
  if (seen.has(path)) return dest;
  seen.add(path);
  let source;
  try { source = execFileSync('git', ['show', `${M9_REV}:${path}`], { cwd: root, encoding: 'utf8' }); }
  catch (cause) { throw new Error(`Cannot read pinned M9 input ${path}. Ensure git fetch origin ${M9_REV} succeeded and Git subprocesses are permitted.`, { cause }); }
  let js = stripTypeScriptTypes(source);
  js = js.replace(/from\s+(["'])(\.[^"']+)\1/g, (_, quote, rel) => {
    const dependency = posix.normalize(posix.join(posix.dirname(path), rel)) + '.ts';
    extract(dependency);
    return `from ${quote}${rel}.mjs${quote}`;
  });
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, js);
  return dest;
}
export async function m9(name) {
  return import(pathToFileURL(extract(name)).href);
}
