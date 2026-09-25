import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { format } from "prettier";
const root = fileURLToPath(new URL("../", import.meta.url));
export async function fingerprint() {
  const hash = createHash("sha256"),
    rawHash = createHash("sha256"),
    files: string[] = [];
  const scan = (p: string) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const f = join(p, e.name);
      e.isDirectory() ? scan(f) : files.push(f);
    }
  };
  scan(join(root, "../../src/core"));
  scan(join(root, "../workshop/lib"));
  for (const p of ["lib/terrain.ts", "lib/convert.ts", "lib/metrics.ts"])
    files.push(join(root, p));
  files.sort();
  for (const p of files) {
    const name = relative(root, p).replaceAll("\\", "/"),
      raw = readFileSync(p);
    rawHash.update(name).update(raw);
    hash
      .update(name)
      .update(
        name.startsWith("lib/")
          ? await format(raw.toString(), { parser: "typescript" })
          : raw,
      );
  }
  return {
    sha256: hash.digest("hex"),
    rawSha256: rawHash.digest("hex"),
    normalisation: "Prettier 3.6.2 for survey code; core bytes unchanged",
    node: process.version,
    sourceFiles: files.length,
    base: "cfa5990caeaf462de695caf428280da55fc0f7f5",
  };
}
export async function checkCache() {
  const current = await fingerprint(),
    path = join(root, ".work/conversion-provenance.json");
  if (existsSync(path)) {
    const previous = JSON.parse(readFileSync(path, "utf8"));
    const hashMatches = previous.normalisation
      ? previous.sha256 === current.sha256
      : previous.sha256 === current.rawSha256;
    if (!hashMatches || previous.node !== current.node)
      throw Error(
        "Core, conversion code or Node changed. Use a fresh .work cache before resuming.",
      );
  }
  writeFileSync(path, JSON.stringify(current, null, 2));
  return current;
}
