import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', {recursive:true});
for (const name of ['worker','app']) await build({entryPoints:[`${name}.ts`], outfile:`dist/${name}.js`, bundle:true, format:'esm', platform:'browser', nodePaths:['./node_modules'], sourcemap:true});
for (const name of ['index.html','ATTRIBUTION.md']) await copyFile(name, `dist/${name}`);
