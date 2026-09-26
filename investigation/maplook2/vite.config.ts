import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(root, '../..');
const prototypes = resolve(repo, 'investigation/generative/out');
export default defineConfig({
  root, publicDir: false,
  resolve: { alias: {
    three: resolve(root, 'node_modules/three'),
    fflate: resolve(root, 'node_modules/fflate'),
  } },
  server: { host: '127.0.0.1', port: 4197, strictPort: true, fs: { allow: [repo] } },
  plugins: [{
    name: 'maplook2-local-only',
    // Standard must remain the full clean look even in software captures, not Light.
    // Change only this constructor decision in memory; fail loudly if upstream changes.
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/render3d/renderer.ts')) return;
      const needle = 'this.software = softwareRendering();';
      if (!code.includes(needle)) throw new Error('MapRenderer bridge needs updating');
      return code.replace(needle, 'this.software = false;');
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url ?? '').split('?')[0]);
        if (path === '/maps/prototypes') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(existsSync(prototypes) ? readdirSync(prototypes).filter(f => f.endsWith('.timber')) : []));
          return;
        }
        // Strict filename allowlists; no arbitrary filesystem endpoint.
        let file: string | undefined;
        if (/^\/maps\/place\/near-[a-z0-9-]+\.json\.gz$/.test(path)) file = resolve(repo, 'public/real-places/data', path.split('/').at(-1)!);
        if (path.startsWith('/maps/prototype/') && existsSync(prototypes)) {
          const name = path.slice('/maps/prototype/'.length);
          if (readdirSync(prototypes).includes(name) && name.endsWith('.timber')) file = resolve(prototypes, name);
        }
        if (file && existsSync(file)) { res.setHeader('Content-Type', 'application/octet-stream'); res.end(readFileSync(file)); return; }
        next();
      });
    },
  }],
});
