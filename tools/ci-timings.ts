// The timings a CI job recorded (tools/timings.ts), as information: a Markdown table in the job's
// summary, and a warning on the run for each time over its budget. Never fails the job.
//
//   npx tsx tools/ci-timings.ts <timings.jsonl>... [--title "Timings"]
//
// Writes the table to the file GITHUB_STEP_SUMMARY names (GitHub Actions), or prints it.

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { Timing } from "./timings";

const args = process.argv.slice(2);
const t = args.indexOf("--title");
const title = t >= 0 ? args[t + 1] : "Timings";
const files = args.filter((a, k) => !a.startsWith("--") && (t < 0 || k !== t + 1));

const rows: Timing[] = [];
for (const f of files) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) if (line.trim()) rows.push(JSON.parse(line) as Timing);
}

const lines = [`### ${title} (information, not gates)`, ""];
if (!rows.length) lines.push("No timings were recorded.");
else {
  lines.push("| What | Time | Budget | |", "| --- | ---: | ---: | --- |");
  for (const r of rows) lines.push(`| ${r.what} | ${r.ms} ms | ${r.budget} ms | ${r.ms <= r.budget ? "within" : "**over**"} |`);
}
const md = `${lines.join("\n")}\n\n`;
const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) appendFileSync(summary, md);
else process.stdout.write(md);

for (const r of rows) {
  if (r.ms <= r.budget) continue;
  const text = `${r.what}: ${r.ms} ms, over its ${r.budget} ms budget (reported, not a failure)`;
  console.log(process.env.GITHUB_ACTIONS ? `::warning title=Timing over budget::${text}` : `over budget: ${text}`);
}
