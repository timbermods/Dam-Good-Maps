// The map card (PLAN §14.3, M1 subset): name, premise, key facts and the validation report.

import type { GenerateResponse } from "../worker/api";

export function MapCard({ result: r }: { result: GenerateResponse }) {
  const count = (pred: (t: string) => boolean) => r.entities.filter((e) => pred(e.template)).length;
  const trees = r.entities.filter((e) => ["Pine", "Birch", "Oak", "Succulent"].includes(e.template));
  const living = trees.filter((e) => !e.dead).length;
  const ruins = r.entities.filter((e) => e.template.startsWith("RuinColumnH"));
  const scrap = ruins.reduce((a, e) => a + 15 * Number(e.template.slice(11)), 0);
  const sources = r.entities.filter((e) => e.template === "WaterSource").length;
  const river = r.features.find((f) => f.kind === "river");
  const flow = river && river.kind === "river" ? river.params.flow : 0;
  const fields = r.features.filter((f) => f.kind === "ruinField").length;
  const failed = r.checks.filter((c) => !c.ok);
  return (
    <article class="card">
      <header>
        <h2>{r.name}</h2>
        <span class="muted">
          {r.W}×{r.H} · seed {r.spec.seed} · designed for {r.spec.designedFor}
        </span>
      </header>
      <p class="premise">{r.premise}</p>
      <dl class="facts">
        <div><dt>River</dt><dd>{sources} sources, {flow} water/s</dd></div>
        <div><dt>Trees</dt><dd>{trees.length} ({living} alive)</dd></div>
        <div><dt>Berry bushes</dt><dd>{count((t) => t === "BlueberryBush")}</dd></div>
        <div><dt>Ruins</dt><dd>{ruins.length} columns in {fields} fields, {scrap.toLocaleString()} scrap</dd></div>
        <div><dt>Slopes</dt><dd>{count((t) => t === "Slope")}</dd></div>
        <div><dt>Features</dt><dd>{r.features.length} editable</dd></div>
      </dl>
      <details class="report" open={failed.length > 0}>
        <summary>
          {failed.length === 0 ? `All ${r.checks.length} checks passed` : `${failed.length} of ${r.checks.length} checks failed`}
          <span class="muted"> · {r.ms} ms{r.attempts > 1 ? `, ${r.attempts} attempts` : ""}</span>
        </summary>
        <ul>
          {r.checks.map((c) => (
            <li key={c.id} class={c.ok ? "ok" : "bad"}>
              <code>{c.id}</code> {c.message}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
