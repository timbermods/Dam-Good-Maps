// A no-subprocess fallback for hosts that block tsx's esbuild service.
// Ordinary hosts can run the same entry points with npx tsx.
const path = require('node:path');
const fs = require('node:fs');
process.env.NODE_PATH = [path.join(__dirname, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
require('node:module').Module._initPaths();
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => {
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, resolveJsonModule: true },
    fileName: file,
  });
  mod._compile(out.outputText, file);
};
const entry = path.resolve(process.cwd(), process.argv[2]);
process.argv.splice(1, 1);
require(entry);
