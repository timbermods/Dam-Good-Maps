// Builds the delivery spike (EDITOR_PLAN §7, roadmap M3) as one self-contained page, the way the
// artifact edition will ship: the worker is bundled on its own and inlined as a string the page
// turns into a blob: URL, the page script is inlined, and nothing is fetched at run time except the
// fonts from Google Fonts (the artifact CSP allows them).
//
//   npx tsx tools/build-spike.ts          → dist-spike/artifact.html (to publish) and
//                                           dist-spike/local.html (the same page in a full document)

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";
import { GENERATOR_VERSION } from "../src/core/spec/mapspec";

const OUT = "dist-spike";
const TMP = join(OUT, "tmp");

async function bundle(entry: string, name: string, define: Record<string, string> = {}): Promise<string> {
  await build({
    configFile: false,
    logLevel: "warn",
    define,
    build: {
      outDir: TMP,
      emptyOutDir: false,
      minify: true,
      target: "es2022",
      lib: { entry, formats: ["iife"], name: name.replace(/\W/g, "_"), fileName: () => `${name}.js` },
    },
  });
  return readFileSync(join(TMP, `${name}.js`), "utf8");
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const worker = await bundle("spike/artifact/spike.worker.ts", "worker");
const main = await bundle("spike/artifact/main.ts", "main", {
  __WORKER_CODE__: JSON.stringify(worker),
  __APP_VERSION__: JSON.stringify(GENERATOR_VERSION),
});
const script = `<script>\n${main.replace(/<\/script/gi, "<\\/script")}\n</script>`;
const page = readFileSync("spike/artifact/page.html", "utf8").replace("<!--SPIKE_SCRIPT-->", () => script);
writeFileSync(join(OUT, "artifact.html"), page);
writeFileSync(
  join(OUT, "local.html"),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${page}\n</body>\n</html>\n`,
);
rmSync(TMP, { recursive: true, force: true });
const kb = (s: string) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`dist-spike/artifact.html: ${kb(page)} KB (worker ${kb(worker)} KB, page script with the worker inside ${kb(main)} KB)`);
