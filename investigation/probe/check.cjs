// Typechecks the runner with this folder's TypeScript (no emit).
const path = require('node:path');
const ts = require('typescript');
const configPath = path.join(__dirname, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, __dirname);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = ts.getPreEmitDiagnostics(program);
for (const d of diagnostics) {
  const where = d.file ? `${path.relative(process.cwd(), d.file.fileName)}:${d.file.getLineAndCharacterOfPosition(d.start).line + 1} ` : '';
  console.log(where + ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}
console.log(diagnostics.length ? `${diagnostics.length} problems` : 'typecheck: ok');
process.exit(diagnostics.length ? 1 : 0);
