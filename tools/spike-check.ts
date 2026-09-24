// The delivery spike's local checks (roadmap M3, docs/spike-m3.md). Runs in a real browser:
//
// 1. The built spike page (tools/build-spike.ts) under an emulation of the artifact's content
//    security policy, served from an https origin with the policy as a response header: the blob
//    worker, the generator in it, a .timber opened through the file input (generated, official and
//    pre-1.0 maps), and whether the page can reach the Messages API.
// 2. The same page with a stand-in for the Claude runtime that follows the published `downloads`
//    and `sample` contracts: the .zip it offers holds the generated .timber byte for byte, a bare
//    .timber is refused, and the page functions answer Claude's tool calls correctly. (What the
//    real viewer does — consent, the save dialog, latency — needs Kyler's account.)
// 3. The Messages API CORS page (spike/cors): a real request from a browser origin to
//    api.anthropic.com with an obviously fake key, with and without the direct-browser-access
//    header, and the preflight as the network saw it.
//
//   npx tsx tools/build-spike.ts && npx tsx tools/spike-check.ts   → out/spike/checks.json

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { generate } from "../src/core/gen/generate";
import { makeSpec } from "../src/core/spec/mapspec";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** The artifact page contract as a policy: scripts from the four CDNs and inline, styles and fonts
 *  from Google Fonts, fetch only to the page's own origin, workers from blob: URLs. */
const ARTIFACT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net/npm/ https://cdn.tailwindcss.com https://code.jquery.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src data: blob:",
  "connect-src 'self'",
  "worker-src blob:",
].join("; ");
const SPIKE_ORIGIN = "https://spike.dam-good-maps.test";

/** A stand-in for the viewer's Claude runtime, following the published contracts: `downloads.save`
 *  refuses names outside its allowlist (downloads.d.ts), and `sample` is a scripted model that calls
 *  the page's three tools as Claude would and answers from their results. */
const STAND_IN = `(() => {
  const ALLOWED = /\.(gif|png|jpg|jpeg|webp|mp4|webm|txt|json|md|docx|pptx|epub|csv|ttf|html|svg|pdf|xlsx|zip)$/i;
  window.__saved = [];
  const downloads = Object.freeze({
    async save(req) {
      if (!ALLOWED.test(req.filename)) throw { code: "rejected_extension", message: req.filename + ": extension not on the downloads allowlist" };
      const blob = req.data instanceof Blob ? req.data : new Blob([req.data]);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      window.__saved.push({ filename: req.filename, base64: btoa(bin) });
      return { status: "saved" };
    },
  });
  const sample = Object.assign(async (prompt, opts) => {
    const byName = new Map((opts.tools || []).map((t) => [t.name, t]));
    const ctx = { signal: new AbortController().signal };
    const facts = await byName.get("map_facts").execute({}, ctx);
    const start = await byName.get("find_start").execute({}, ctx);
    const h = await byName.get("height_at").execute({ x: start.x, y: start.y }, ctx);
    const text = JSON.stringify({ size: facts.width + "x" + facts.height, startHeight: h.height, pines: facts.pineTrees });
    if (opts.onText) opts.onText({ text, delta: text });
    return { text, truncated: false, modelTierApplied: opts.modelTier || "default" };
  }, { limits: async () => ({ maxPromptBytes: 65536, tools: { maxCount: 16 } }) });
  window.claude = Object.freeze({ use: async (name) => (name === "downloads" ? downloads : name === "sample" ? sample : null) });
})();`;
const CORS_ORIGIN = "http://cors.dam-good-maps.test";

const channel = process.env.PW_CHANNEL ?? (process.env.CI ? undefined : "chrome");
mkdirSync(".scratch/spike", { recursive: true });
mkdirSync("out/spike", { recursive: true });

// the map the page's worker generates (River Valley, 96², seed 4242), made here in Node too
const node = generate(makeSpec({ seed: 4242, size: { x: 96, y: 96 } }));
const generatedPath = ".scratch/spike/River Valley (4242).timber";
writeFileSync(generatedPath, node.bytes);

const html = readFileSync("dist-spike/local.html", "utf8");
const out: Record<string, unknown> = { ranAt: new Date().toISOString(), csp: ARTIFACT_CSP, nodeSha256: sha(node.bytes) };

async function openSpike(page: Page): Promise<string[]> {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) violations.push(m.text().slice(0, 300));
  });
  await page.route(`${SPIKE_ORIGIN}/**`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", headers: { "content-security-policy": ARTIFACT_CSP }, body: html }),
  );
  await page.goto(`${SPIKE_ORIGIN}/`);
  await page.waitForSelector('[data-chip="worker"][data-state="pass"], [data-chip="worker"][data-state="fail"]', { timeout: 120_000 });
  await page.waitForFunction(() => /"environment"/.test(document.getElementById("results-json")?.textContent ?? ""), null, { timeout: 60_000 });
  return violations;
}

const results = async (page: Page) => JSON.parse((await page.textContent("#results-json")) ?? "{}");

async function openTimber(page: Page, path: string): Promise<unknown> {
  await page.setInputFiles("#timber-file", path);
  await page.waitForFunction(
    (name) => {
      const r = JSON.parse(document.getElementById("results-json")?.textContent ?? "{}");
      return r.open && (r.open.name === name || r.open.ok === false);
    },
    path.split(/[\\/]/).pop(),
    { timeout: 60_000 },
  );
  return (await results(page)).open;
}

const browser = await chromium.launch({ channel });
try {
  // ------------------------------------------------------------------ 1. the page, no runtime
  {
    const page = await browser.newPage();
    const violations = await openSpike(page);
    const r = await results(page);
    const opened: Record<string, unknown> = {};
    opened.generated = await openTimber(page, generatedPath);
    for (const [key, path] of [
      ["official", "investigation/raw/builtin/Diorama.timber"],
      ["pre1_0", "investigation/raw/workshop/Cozy Secret Valley.timber"],
      ["heightmap0_6", "investigation/raw/workshop/Meander Multiplayer (1-3 players).timber"],
    ] as const) {
      if (existsSync(path)) opened[key] = await openTimber(page, path);
    }
    await page.click("#use-generated");
    await page.waitForFunction(() => JSON.parse(document.getElementById("results-json")!.textContent!).open?.via === "generated map", null, { timeout: 60_000 });
    opened.viaButton = (await results(page)).open;
    out.page = {
      worker: r.worker,
      environment: r.environment,
      capabilities: r.capabilities,
      opened,
      cspViolations: violations,
      chips: await page.$$eval("[data-chip]", (els) => els.map((e) => `${(e as HTMLElement).dataset.chip}: ${(e as HTMLElement).dataset.state}`)),
    };
    await page.screenshot({ path: ".scratch/spike/page.png", fullPage: true });
    await page.close();
  }

  // ------------------------------------------- 2. the page with a stand-in for the Claude runtime
  {
    const page = await browser.newPage();
    // (a string, not a function: tsx would add helpers the page does not have)
    await page.addInitScript(STAND_IN);
    await openSpike(page);
    await page.waitForSelector('[data-chip="zip"][data-state="you"]', { timeout: 60_000 });
    await page.click("#save-zip");
    await page.waitForSelector('[data-chip="zip"][data-state="pass"]', { timeout: 60_000 });
    await page.click("#save-bare");
    await page.waitForFunction(() => /bareTimber/.test(document.getElementById("results-json")!.textContent!), null, { timeout: 30_000 });
    for (const tier of ["quick", "default"]) {
      await page.click(`[data-ask="${tier}"]`);
      await page.waitForSelector(`[data-chip="${tier}"][data-state="pass"], [data-chip="${tier}"][data-state="fail"]`, { timeout: 60_000 });
    }
    const r = await results(page);
    const saved = (await page.evaluate(() => (window as unknown as { __saved: { filename: string; base64: string }[] }).__saved))[0];
    const zip = unzipSync(new Uint8Array(Buffer.from(saved.base64, "base64")));
    const inside = Object.keys(zip);
    out.withRuntimeStandIn = {
      zip: r.zip,
      zipEntries: inside,
      timberInZipEqualsNodeBytes: inside.length === 1 && sha(zip[inside[0]]) === sha(node.bytes),
      browserGeneratedEqualsNode: r.worker.generate.sha256 === sha(node.bytes),
      bareTimber: r.bareTimber,
      sample_quick: r.sample_quick,
      sample_default: r.sample_default,
    };
    await page.close();
  }

  // ------------------------------------------------------------------------ 3. CORS from a page
  {
    const page = await browser.newPage();
    const network: unknown[] = [];
    page.on("request", (req) => {
      if (req.url().startsWith("https://api.anthropic.com/")) network.push({ event: "request", method: req.method(), headers: Object.keys(req.headers()).sort() });
    });
    page.on("response", async (res) => {
      if (!res.url().startsWith("https://api.anthropic.com/")) return;
      const h = await res.allHeaders();
      network.push({
        event: "response",
        method: res.request().method(),
        status: res.status(),
        headers: Object.fromEntries(Object.entries(h).filter(([k]) => k.startsWith("access-control"))),
      });
    });
    page.on("requestfailed", (req) => {
      if (req.url().startsWith("https://api.anthropic.com/")) network.push({ event: "failed", method: req.method(), error: req.failure()?.errorText });
    });
    // the browser's own view of the traffic, preflights included (Playwright's events skip them)
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    const byId = new Map<string, { method: string; type?: string }>();
    cdp.on("Network.requestWillBeSent", (e: { requestId: string; type?: string; request: { url: string; method: string } }) => {
      if (e.request.url.startsWith("https://api.anthropic.com/")) byId.set(e.requestId, { method: e.request.method, type: e.type });
    });
    cdp.on("Network.responseReceived", (e: { requestId: string; type?: string; response: { url: string; status: number; headers: Record<string, string> } }) => {
      if (!e.response.url.startsWith("https://api.anthropic.com/")) return;
      const h = Object.fromEntries(Object.entries(e.response.headers).map(([k, v]) => [k.toLowerCase(), v]).filter(([k]) => k.startsWith("access-control")));
      network.push({ event: "browser response", type: e.type, method: byId.get(e.requestId)?.method, status: e.response.status, headers: h });
    });
    cdp.on("Network.loadingFailed", (e: { requestId: string; type?: string; errorText: string; corsErrorStatus?: { corsError: string } }) => {
      if (byId.has(e.requestId)) network.push({ event: "browser failure", type: e.type, method: byId.get(e.requestId)?.method, error: e.errorText, cors: e.corsErrorStatus?.corsError });
    });
    const cors = readFileSync("spike/cors/index.html", "utf8");
    await page.route(`${CORS_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: cors }));
    await page.goto(`${CORS_ORIGIN}/`);
    await page.click("#run");
    await page.waitForFunction(() => !!(window as unknown as { __cors?: unknown }).__cors, null, { timeout: 60_000 });
    out.cors = { page: await page.evaluate(() => (window as unknown as { __cors: unknown }).__cors), network };
    await page.close();
  }
} finally {
  await browser.close();
}

writeFileSync("out/spike/checks.json", JSON.stringify(out, null, 2) + "\n");
const p = out.page as { worker: { ok: boolean }; cspViolations: string[]; environment: Record<string, unknown> };
const s = out.withRuntimeStandIn as Record<string, unknown>;
const c = out.cors as { page: { withHeader: { readable: boolean; status?: number }; withoutHeader: { readable: boolean; error?: string } } };
console.log(`worker: ${p.worker.ok}; CSP violations: ${p.cspViolations.length}; Messages API from the page: ${String(p.environment.messagesApi)}`);
console.log(`zip holds the Node bytes: ${String(s.timberInZipEqualsNodeBytes)}; browser generator equals Node: ${String(s.browserGeneratedEqualsNode)}`);
console.log(`CORS with header: readable ${c.page.withHeader.readable}, HTTP ${c.page.withHeader.status}; without: ${c.page.withoutHeader.readable ? "readable" : c.page.withoutHeader.error}`);
console.log("wrote out/spike/checks.json");
