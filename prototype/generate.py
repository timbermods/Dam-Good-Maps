"""River Valley: the prototype's one archetype, built the way PLAN.md describes the website's
pipeline: layout -> terrain around the layout -> start and connections -> water (simulated with
the game's rules) -> vegetation where the water keeps soil moist -> ruin fields -> validation,
retrying with a derived seed until every check passes.

Premise: a river enters from the west edge, winds through a basin that a ridge pinches into a
gorge (the dam site), drops over falls, and leaves at the east edge past a badwater marsh. The
colony starts on a bench above the basin.
"""
from __future__ import annotations

import math

import numpy as np

import calibrated as cal
from analysis import N4, dam_sites, distance_from, level_regions
from ruins import place_fields
from tbmap import new_map, slope, starting_location, water_source
from terrain import flatten_pad, plan_valley, shape_terrain
from vegetation import place_bushes, place_forests
from watersim import WaterSim, contamination, moisture

SLOPE_ORIENTATION = {(0, -1): "Cw0", (-1, 0): "Cw90", (0, 1): "Cw180", (1, 0): "Cw270"}  # high side (dx, dy)


def derive_seed(seed: int, attempt: int) -> int:
    """Retry seeds: deterministic, and attempt 0 is the seed itself."""
    return seed if attempt == 0 else (seed * 1_000_003 + attempt * 7_919) % 2**31


def start_coordinates(min_x, min_y, orientation):
    """Coordinates for a 3x3 footprint whose min corner is (min_x, min_y)
    (notes/blocks_and_placement.md, rotated bounding box table)."""
    return {"Cw0": (min_x, min_y), "Cw90": (min_x, min_y + 2),
            "Cw180": (min_x + 2, min_y + 2), "Cw270": (min_x + 2, min_y)}[orientation]


def build(seed: int, W: int, H: int, difficulty="normal"):
    rng = np.random.default_rng(seed)
    lay = plan_valley(rng, W, H)
    h = shape_terrain(rng, lay, max_h=cal.MAX_TERRAIN_HEIGHT)
    floor_top = int(lay.bed[lay.gorge_x]) + 1        # basin floodplain

    # ---- start bench: first terrace above the basin, 8-12 tiles from the river, door facing it
    sx = int(rng.integers(lay.basin_x[0] + 2, max(lay.basin_x[0] + 3, lay.gorge_x - 6)))
    side = 1 if rng.random() < 0.5 else -1
    dist = int(rng.integers(6, 10))                   # official median: clean water 11-13 tiles away
    sy = int(np.clip(lay.centre[sx] + side * dist, 8, H - 9))
    level = floor_top + 1
    flatten_pad(h, sy, sx, cal.START["pad_radius"], level)
    orientation = "Cw0" if lay.centre[sx] < sy else "Cw180"      # door (-y or +y) faces the river
    cx, cy = start_coordinates(sx - 1, sy - 1, orientation)
    start = starting_location(cx, cy, level, orientation, rng=rng)

    # ---- sources: a row of 0.5s in the channel at the west edge (edge sources do not leak)
    total = cal.density("water_strength_per_10k", W * H) * W * H / 1e4
    n_src = max(2, int(round(total / cal.WATER["source_strength"])))
    ch = [y for y in range(H) if abs(y - lay.centre[0]) < 2.2]
    src_tiles = [(y, 0) for y in ch][:n_src]
    while len(src_tiles) < n_src:                   # widen the row one tile in if needed
        src_tiles.append((ch[len(src_tiles) % len(ch)], 1))
    sources = [{"tiles": [t], "strength": cal.WATER["source_strength"], "contamination": 0.0} for t in src_tiles]

    # ---- badwater marsh: a 3x3 on flat floodplain below the falls, as far from the start as possible
    bad_total = total * cal.WATER["badwater_ratio"]
    bad = None
    best = -1
    for x in range(lay.falls_x + 3, W - 4):
        for sgn in (1, -1):
            y = int(round(lay.centre[x] + sgn * 4))
            if not (1 <= y < H - 3):
                continue
            patch = h[y:y + 3, x:x + 3]
            if patch.shape == (3, 3) and (patch == patch[0, 0]).all() and patch[0, 0] == lay.bed[x] + 1:
                d = math.hypot(x - sx, y - sy)
                if d > best:
                    best, bad = d, (x, y, int(patch[0, 0]))
    if bad is not None:
        bx, by, bz = bad
        sources.append({"tiles": [(by + j, bx + i) for i in range(3) for j in range(3)],
                        "strength": round(bad_total, 2), "contamination": 1.0})

    # ---- water with the game's rules, then moisture and soil contamination
    sim = WaterSim(h, sources)
    settled = sim.settle(max_days=4)
    D, C = sim.D, sim.C
    M = moisture(h, D, C, sim.sat())
    SC = contamination(h, D, C)

    # ---- slopes: connect the start's level to every neighbouring level within reach
    ents = [start]
    occupied = np.zeros((H, W), bool)
    yy, xx = np.mgrid[0:H, 0:W]
    near_start = np.maximum(np.abs(yy - sy), np.abs(xx - sx))
    occupied |= near_start <= cal.START["clear_radius"]
    # keep the entrance approach free (two tiles in front of the door)
    ex, ey = (sx, sy - 2) if orientation == "Cw0" else (sx, sy + 2)
    occupied[max(0, ey - 1):ey + 2, max(0, ex - 1):ex + 2] = True
    for t in src_tiles:
        occupied[t] = True
    if bad is not None:
        occupied[by:by + 3, bx:bx + 3] = True
    slope_ents, slope_links = connect_levels(h, (sy, sx), occupied, rng, radius=int(max(W, H) * 0.6))
    ents += slope_ents
    for e in slope_ents:
        c = e["Components"]["BlockObject"]["Coordinates"]
        occupied[c["Y"], c["X"]] = True

    wet = D > 0.001
    dry_soil = ~wet & (SC == 0)
    moist = (M > 0) & dry_soil

    # ---- ruin fields: flat dry ground away from the start, on a single level each
    start_d = distance_from(near_start == 0)
    allowed = dry_soil & ~occupied & (M == 0)          # keep moist land for forests and farms
    if allowed.sum() < 0.05 * W * H:
        allowed = dry_soil & ~occupied
    ruin_cal = dict(cal.RUINS, scrap_per_1k_tiles=cal.density("scrap_per_1k_tiles", W * H))
    fm = cal.density("ruin_field_columns", W * H)
    ruin_cal["field_columns"] = [int(fm * k) for k in (0.6, 0.8, 1.0, 1.2, 1.5, 1.9)]
    ruin_ents, fields = place_fields(rng, h, allowed, start_d, ruin_cal)
    for e in ruin_ents:
        c = e["Components"]["BlockObject"]["Coordinates"]
        occupied[c["Y"], c["X"]] = True
    ents += ruin_ents

    # ---- berries beside water near the start, then forests (living where soil stays moist)
    near_water = distance_from(wet & (C < 0.05)) <= 5
    bush_cal = dict(cal.BUSHES, bushes_per_10k=cal.density("bushes_per_10k", W * H))
    bush_ents, occ2 = place_bushes(rng, h, ~occupied & dry_soil, moist, near_water, bush_cal, (sy, sx))
    occupied |= occ2
    ents += bush_ents
    forest_cal = dict(cal.FOREST, trees_per_10k=cal.density("trees_per_10k", W * H))
    tree_ents, occ3 = place_forests(rng, h, ~occupied & dry_soil, moist, forest_cal, (sy, sx))
    ents += tree_ents

    # ---- sources as entities
    for (y, x) in src_tiles:
        ents.append(water_source(x, y, int(h[y, x]), cal.WATER["source_strength"], rng=rng))
    if bad is not None:
        ents.append(water_source(bx, by, bz, round(bad_total, 2), bad=True, rng=rng))

    m = new_map(W, H)
    m.set_heightmap(h)
    m.entities = ents
    m.reset_simulation_state()
    m.set_simulation_state(D, C, M, SC)
    info = {"seed": seed, "layout": {"gorge_x": lay.gorge_x, "basin_x": lay.basin_x, "falls_x": lay.falls_x},
            "start": (sx, sy, level), "settled": settled, "sources": len(src_tiles),
            "clean_strength": round(n_src * cal.WATER["source_strength"], 2),
            "scrap": sum(int(e["Template"][11:]) * 15 for e in ruin_ents),
            "trees": len(tree_ents), "bushes": len(bush_ents),
            "badwater": bad, "badwater_strength": round(bad_total, 2) if bad else 0,
            "fields": [len(f[0]) for f in fields], "slopes": len(slope_ents)}
    return m, info, {"D": D, "C": C, "M": M, "SC": SC}


def connect_levels(h, start_yx, occupied, rng, radius=60):
    """Beavers cannot cross even a 1-voxel step (notes/navigation_ruins_entities.md, 1a), and
    player stairs cost 70 science. Grow a tree of level regions from the start's region: for
    every neighbouring region one level up or down within `radius`, place one Slope at the
    boundary point closest to the start (a second one on long boundaries)."""
    H, W = h.shape
    labels, info = level_regions(h)
    sy, sx = start_yx
    root = labels[sy, sx]
    # boundary pairs between regions that differ by exactly one level
    pairs = {}
    for y in range(H):
        for x in range(W):
            for dy, dx in N4:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and h[yy, xx] == h[y, x] + 1:
                    a, b = labels[y, x], labels[yy, xx]      # a low, b high
                    pairs.setdefault((a, b), []).append((y, x, dy, dx))
    adj = {}
    for (a, b), lst in pairs.items():
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)
    seen = {root}
    frontier = [root]
    ents, links = [], []
    while frontier:
        nxt = []
        for r in frontier:
            for n in sorted(adj.get(r, ())):
                if n in seen:
                    continue
                cand = pairs.get((r, n), []) + pairs.get((n, r), [])
                cand = [c for c in cand if max(abs(c[0] - sy), abs(c[1] - sx)) <= radius]
                placed = _place_slopes(h, cand, occupied, start_yx, ents, links, rng, extra=len(cand) > 60)
                if placed:
                    seen.add(n)
                    nxt.append(n)
        frontier = nxt
    return ents, links


def _place_slopes(h, cand, occupied, start_yx, ents, links, rng, extra=False):
    """Place a slope on the low tile of the best boundary pair: low tile free, the tile behind
    the low side (where beavers step on) at the same level and free."""
    H, W = h.shape
    sy, sx = start_yx
    cand = sorted(cand, key=lambda c: (c[0] - sy) ** 2 + (c[1] - sx) ** 2)
    placed = 0
    used = []
    for (y, x, dy, dx) in cand:
        ly, lx = y - dy, x - dx                      # low-side approach tile
        if not (0 <= ly < H and 0 <= lx < W) or occupied[y, x] or occupied[ly, lx] or h[ly, lx] != h[y, x]:
            continue
        if any(abs(y - uy) + abs(x - ux) < 12 for uy, ux in used):
            continue
        ents.append(slope(x, y, int(h[y, x]), SLOPE_ORIENTATION[(dx, dy)], rng=rng))
        occupied[y, x] = True
        links.append(((y, x), (y + dy, x + dx)))
        used.append((y, x))
        placed += 1
        if placed >= (2 if extra else 1):
            break
    return placed


def generate(seed: int, W=96, H=96, difficulty="normal", attempts=12, out_path=None, log=print):
    """Build, validate, and retry with derived seeds until a map passes every check."""
    import os
    import tempfile
    from validate import validate
    last = None
    for attempt in range(attempts):
        s = derive_seed(seed, attempt)
        m, info, state = build(s, W, H, difficulty)
        name = f"Dam Good Maps - River Valley {seed}"
        m.metadata["MapDescription"] = premise(info, W, H)
        path = out_path or os.path.join(tempfile.gettempdir(), f"dgm_{s}.timber")
        m.timestamp = "2026-09-24 00:00:00"          # fixed so the same seed gives the same file
        m.write(path)
        rep = validate(path, difficulty)
        last = (m, info, rep, path)
        log(f"attempt {attempt}: seed {s} -> {'PASS' if rep.passed else 'FAIL'}"
            + ("" if rep.passed else ": " + ", ".join(c.id for c in rep.failures())))
        if rep.passed:
            return last
    return last


def premise(info, W, H):
    return (f"River Valley (seed {info['seed']}, {W}x{H}). A river enters from the west, fills a basin "
            f"that a rock ridge pinches into a gorge (dam it for a reservoir), drops over falls and leaves "
            f"past a badwater marsh. {sum(info['fields'])} ruin columns in {len(info['fields'])} fields. "
            f"Made by Dam Good Maps.")
