// Builds DGM Probe against the local game install and installs it into Documents\Timberborn\Mods\DGMProbe.
//   npm --prefix investigation/probe run build-mod [-- --no-install]
// The mod is never published; the README says how to remove it.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { GAME_DIR, isEntry, modInstallDir, PROBE_DIR } from './paths';
import { isGameRunning } from './safety';

export function buildMod(install = true): string {
  const project = join(PROBE_DIR, 'mod', 'DGMProbe.csproj');
  execFileSync('dotnet', ['build', project, '-c', 'Release', '--nologo', '-v', 'q', `-p:GameDir=${GAME_DIR}`], { stdio: 'inherit' });
  const dll = join(PROBE_DIR, 'mod', 'bin', 'Release', 'netstandard2.1', 'DGMProbe.dll');
  if (!existsSync(dll)) throw new Error(`The build left no ${dll}`);
  if (!install) return dll;
  if (isGameRunning()) throw new Error('Timberborn is running: the mod is installed only while the game is closed.');
  const target = modInstallDir();
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  mkdirSync(join(target, 'version-1.1', 'Scripts'), { recursive: true });
  copyFileSync(dll, join(target, 'version-1.1', 'Scripts', 'DGMProbe.dll'));
  copyFileSync(join(PROBE_DIR, 'mod', 'manifest.json'), join(target, 'version-1.1', 'manifest.json'));
  return target;
}

if (isEntry(__filename)) {
  const where = buildMod(!process.argv.includes('--no-install'));
  console.log(`DGM Probe: ${where}`);
}
