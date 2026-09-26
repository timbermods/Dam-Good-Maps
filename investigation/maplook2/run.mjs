// One command from a fresh checkout. Installs only this investigation's locked dependencies.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
if (!existsSync('node_modules/vite')) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci'], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const { createServer } = await import('vite');
const server = await createServer();
await server.listen();
server.printUrls();
