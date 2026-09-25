// Keep dependency resolution and the CLI's missing theme option inside this investigation.
import { registerHooks, createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const cli = new URL('../../tools/gen.ts', import.meta.url).href;
const observer = new URL('./observe.ts', import.meta.url).href;
const themes = ['riverValley', 'canyon', 'highlands', 'lakeBasin', 'delta', 'islands'];
const theme = process.env.MECHANICS_THEME;
if (theme && !themes.includes(theme)) throw new Error('Unknown mechanics theme');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'fflate') return { url: pathToFileURL(require.resolve('fflate')).href, shortCircuit: true };
    if (specifier.startsWith('.') && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const suffix of ['.ts', '/index.ts']) {
        const target = new URL(base.href + suffix);
        if (existsSync(target)) return { url: target.href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url !== cli || !theme) return next(url, context);
    const original = readFileSync(fileURLToPath(url), 'utf8');
    const specLine = 'makeSpec({ seed, size: { x: size, y: size }, designedFor: difficulty })';
    const importLine = 'import { generate } from "../src/core/gen/generate";';
    if (original.split(specLine).length !== 2 || original.split(importLine).length !== 2) {
      throw new Error('tools/gen.ts changed; check the adapter before running');
    }
    const source = original
      .replace(specLine, `makeSpec({ seed, size: { x: size, y: size }, designedFor: difficulty, theme: ${JSON.stringify(theme)} })`)
      .replace(importLine, `import { generate } from ${JSON.stringify(observer)};`);
    return { source, format: 'module-typescript', shortCircuit: true };
  }
});
