// Resolve read-only core imports through this survey's private dependencies.
import { registerHooks, createRequire, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'fflate') return {url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true};
  if (specifier.startsWith('.') && context.parentURL) {
    const u = new URL(specifier, context.parentURL);
    if (!/\.[a-z]+$/i.test(u.pathname) && existsSync(new URL(u.href + '.ts'))) return {url:u.href+'.ts', shortCircuit:true};
    if (existsSync(new URL(u.href + '/index.ts'))) return {url:u.href+'/index.ts', shortCircuit:true};
  }
  return nextResolve(specifier, context);
}, load(url, context, nextLoad) {
  if (url.endsWith('.ts')) return {format:'module', source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'), {mode:'transform',sourceUrl:url}), shortCircuit:true};
  return nextLoad(url,context);
}});
