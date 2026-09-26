// The Real places gallery (ROADMAP "Real places", PLAN §20 D136): maps made from real land, as
// content to play or to refine. Each card shows two pictures of the map, drawn by our 3D view and
// facing the same way: the angled overview, with the map from above as a minimap in its corner
// that fills the picture on hover, focus or a tap (Kyler's choice), each with a north arrow. Then
// the place's title, its landform, size and scale, and how it plays. **Download** is a link to the
// place's .timber, built at deploy time (tools/places-build.ts); **Refine** opens it in the editor
// (the generator page's `#place=` link, which imports it). Nothing here feeds the generator (D108).

import { useEffect, useMemo, useState } from "preact/hooks";
import type { PlaceIndex, PlaceIndexEntry } from "../core/places/place";
import { VIEW_TURNS } from "../core/places/view";
import { InsetPicture } from "../ui/Pictures";
import { Credits } from "./Credits";
import { fetchIndex, placeMap, PLACES_URL } from "./data";

const HOME = import.meta.env.BASE_URL;

/** The filters, kept in the page's query so Back returns to the same list. */
function initialFilters(): { family: string; size: number | null } {
  const q = new URLSearchParams(location.search);
  const size = Number(q.get("size"));
  return { family: q.get("family") ?? "", size: Number.isInteger(size) && size > 0 ? size : null };
}

/** A card's pictures: the overview, with the map from above as its minimap; both face the place's
 *  view, and their north arrows show where north is. */
function Pictures({ p }: { p: PlaceIndexEntry }) {
  return (
    <InsetPicture
      main={{ src: PLACES_URL + p.image, alt: `${p.name} seen at an angle` }}
      inset={{ src: PLACES_URL + p.topImage, alt: `${p.name} from above` }}
      label={`Show ${p.name} from above`}
      north={VIEW_TURNS[p.view]}
    />
  );
}

export function Gallery() {
  const [index, setIndex] = useState<PlaceIndex | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const init = useMemo(initialFilters, []);
  const [family, setFamily] = useState(init.family);
  const [size, setSize] = useState<number | null>(init.size);

  useEffect(() => {
    fetchIndex().then(setIndex, (e) => setLoadError(String(e instanceof Error ? e.message : e)));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    if (family) q.set("family", family);
    if (size) q.set("size", String(size));
    const s = q.toString();
    history.replaceState(null, "", s ? `?${s}` : location.pathname);
  }, [family, size]);

  const shown = useMemo(() => (index ? index.places.filter((p) => (!family || p.family === family) && (!size || p.size === size)) : []), [index, family, size]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of index?.places ?? []) if (!size || p.size === size) m.set(p.family, (m.get(p.family) ?? 0) + 1);
    return m;
  }, [index, size]);

  return (
    <div class="app places">
      <header class="top">
        <div class="top-row">
          <h1>Real places</h1>
          <nav class="top-nav" aria-label="Pages">
            <a href={HOME}>Generator</a>
          </nav>
        </div>
        <p class="tag">
          Timberborn maps made from real land. <strong>Download</strong> one to play, or <strong>Refine</strong> it in the editor.
        </p>
        <p class="lead">
          Each map is inspired by the land near its namesake, at Timberborn's scale. It is not a replica. The heights come
          from public <a href="#credits">elevation data</a>.
        </p>
        <p class="lead">
          To play, move the file to <code>Documents\Timberborn\Maps</code> (on macOS <code>~/Documents/Timberborn/Maps</code>).
          Then start Timberborn → <strong>New game</strong> and pick the map.
        </p>
      </header>

      {loadError ? (
        <p class="error" role="alert">
          The maps did not load: {loadError}. Reload the page to try again.
        </p>
      ) : null}

      {index ? (
        <>
          <div class="filters" role="group" aria-label="Filter the maps">
            <label class="filter">
              Landform
              <select value={family} onChange={(e) => setFamily((e.target as HTMLSelectElement).value)}>
                <option value="">All landforms</option>
                {index.families.map((f) => (
                  <option key={f.id} value={f.id} disabled={!counts.get(f.id)}>
                    {f.name} ({counts.get(f.id) ?? 0})
                  </option>
                ))}
              </select>
            </label>
            <div class="segmented" role="group" aria-label="Size">
              <button type="button" aria-pressed={size === null} onClick={() => setSize(null)}>
                All sizes
              </button>
              {index.sizes.map((s) => (
                <button type="button" key={s} aria-pressed={size === s} onClick={() => setSize(s)}>
                  {s}×{s}
                </button>
              ))}
            </div>
            <p class="muted count" role="status">
              {shown.length === index.count ? `${index.count} maps` : `${shown.length} of ${index.count} maps`}
            </p>
          </div>

          {shown.length ? (
            <ul class="gallery" aria-label="Maps">
              {shown.map((p) => {
                const map = placeMap(p);
                return (
                  <li class="place" key={p.id}>
                    <Pictures p={p} />
                    <div class="place-body">
                      <h2>{p.name}</h2>
                      <p class="place-meta">
                        {p.familyName} · {p.size}×{p.size} · {p.metres} m per tile
                      </p>
                      <p class="place-plays">{p.plays}</p>
                      <div class="place-actions">
                        <a class="button primary" href={map.url} download={map.fileName} aria-label={`Download ${p.name}`}>
                          Download
                        </a>
                        <a class="button ghost" href={`${HOME}#place=${p.id}`} aria-label={`Refine ${p.name} in the editor`}>
                          Refine
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p class="empty">
              No map matches.{" "}
              <button
                type="button"
                class="linkish"
                onClick={() => {
                  setFamily("");
                  setSize(null);
                }}
              >
                Show all maps
              </button>
            </p>
          )}
        </>
      ) : loadError ? null : (
        <p class="placeholder">Loading the maps…</p>
      )}

      <Credits />

      <footer class="foot">
        Dam Good Maps. Not affiliated with Mechanistry. <a href="https://github.com/timbermods/dam-good-maps">Source</a>
      </footer>
    </div>
  );
}
