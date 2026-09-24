"""Playability checks: re-simulate the map's own water with the game's rules and check that a
colony can survive and grow from the start. Thresholds come from calibrated.py (official-map
medians and the survival budget in notes/navigation_ruins_entities.md, section 11)."""
from __future__ import annotations

import numpy as np

import calibrated as cal
from analysis import (N4, dam_sites, distance_from, is_dead, placement, point_clusters,
                      walk_regions)
from watersim import WaterSim, contamination, drought_storage, moisture

TREES = ("Pine", "Birch", "Oak")


def map_sources(m, ents):
    """Water emitters active at the start (delayed sources and badtide drains stay off)."""
    out = []
    for t, cont, n in (("WaterSource", 0.0, 1), ("BadwaterSource", 1.0, 3)):
        for e in ents.get(t, []):
            ta = e["Components"].get("TimeActivatedComponent", {})
            if ta.get("IsEnabled"):
                continue
            p = placement(e)
            tiles = [(p.y + j, p.x + i) for i in range(n) for j in range(n)] if n == 3 else [(p.y, p.x)]
            out.append({"tiles": tiles, "strength": float(e["Components"]["WaterSource"]["SpecifiedStrength"]),
                        "contamination": cont})
    return out


def check_playability(m, rep, ents, start, difficulty, occupied, water=None):
    diff = cal.DIFFICULTY[difficulty]
    h = m.surface()
    X, Y = m.size_x, m.size_y
    if not m.is_simple():
        rep.add("water.model", False, "caves or overhangs: the heightfield water model does not apply")
        return

    # ---- water: settle the map's own sources with the game's rules
    sim = WaterSim(h, map_sources(m, ents))
    settled = sim.settle(max_days=4)
    D, C = sim.D, sim.C
    wet = D > 0.05
    rep.add("water.settles", settled, f"steady after {sim.ticks} ticks ({sim.ticks / 768:.1f} days)")
    share = float(wet.mean())
    rep.add("water.no_flood", share <= cal.WATER["max_water_share"],
            f"{share:.0%} of the map under water (official p90 40%)", round(share, 3), cal.WATER["max_water_share"])
    clean = wet & (C < 0.05)
    rep.add("water.clean_exists", clean.sum() >= 0.02 * X * Y,
            f"{clean.sum()} tiles of clean water", int(clean.sum()), int(0.02 * X * Y))
    M = moisture(h, D, C, sim.sat())
    SC = contamination(h, D, C)
    if start is None:
        return
    sx, sy, sz = start

    # ---- start: dry, near pumpable clean water, clear of badwater
    yy, xx = np.mgrid[0:Y, 0:X]
    cheb = np.maximum(np.abs(yy - sy), np.abs(xx - sx))
    rep.add("start.dry", not wet[cheb <= 2].any(), "district center and its ring stay dry after water settles")
    surface = h + D
    pumpable = clean & (D >= 0.3) & (surface >= sz - cal.PUMP_REACH) & (surface <= sz + 0.01)
    start_mask = cheb <= 1
    sd = distance_from(start_mask)
    dw = float(sd[pumpable].min()) if pumpable.any() else float("inf")
    rep.add("start.water", dw <= diff["water_dist"],
            f"clean water within pump reach (<= {cal.PUMP_REACH} below the start) {dw:.1f} tiles away; "
            f"Normal starts with no water and beavers die from ~day 6", round(dw, 1), diff["water_dist"])
    bad_soil = (SC > 0) | (wet & (C >= 0.05))
    db = float(sd[bad_soil].min()) if bad_soil.any() else float("inf")
    rep.add("start.badwater", db >= diff["badwater_min"], f"nearest badwater or contaminated soil {db:.0f} tiles",
            round(db, 1), diff["badwater_min"])

    # ---- reach: same-level land joined by slopes (beavers cannot climb a 1-voxel step)
    links = []
    for e in ents.get("Slope", []):
        p = placement(e)
        dx, dy = {"Cw0": (0, -1), "Cw90": (-1, 0), "Cw180": (0, 1), "Cw270": (1, 0)}[p.orientation]
        if 0 <= p.x + dx < X and 0 <= p.y + dy < Y:
            links.append(((p.y, p.x), (p.y + dy, p.x + dx)))
    blocked = np.zeros((Y, X), bool)
    for t in ("Thorns", "Blockage", "NaturalDam", "UnstableCore", "GeothermalField", "UndergroundRuins",
              "SmallRelic", "MediumRelic", "LargeRelic"):
        for e in ents.get(t, []):
            p = placement(e)
            blocked[p.y, p.x] = True
    labels, sizes = walk_regions(h, 0, blocked, links)
    reach = labels == labels[sy, sx]
    dry_reach = int((reach & ~wet).sum())
    rep.add("start.reach", dry_reach >= cal.START["reach_min_tiles"],
            f"{dry_reach} dry tiles walkable from the start through slopes (official p10 1007, min 765)",
            dry_reach, cal.START["reach_min_tiles"])
    rep.add("start.reach_water", bool((reach & pumpable).any() or _adjacent(reach, pumpable)),
            "the pumpable water borders land the colony can walk to")

    # ---- food and wood within 20 of the start (walk-reachable ones only)
    def near(templates, pred=lambda e: True, r=20):
        n = 0
        for t in templates:
            for e in ents.get(t, []):
                p = placement(e)
                if pred(e) and sd[p.y, p.x] <= r and (reach[p.y, p.x] or _touches(reach, p.y, p.x)):
                    n += 1
        return n
    bushes = near(("BlueberryBush",), lambda e: not is_dead(e))
    rep.add("start.food", bushes >= diff["bushes_r20"],
            f"{bushes} living berry bushes within 20 tiles (Normal food lasts ~4 days)", bushes, diff["bushes_r20"])
    trees = near(TREES)
    rep.add("start.wood", trees >= diff["trees_r20"], f"{trees} trees within 20 tiles", trees, diff["trees_r20"])
    ruins_near = [e for e in m.entities if e["Template"].startswith("RuinColumnH")
                  and sd[placement(e).y, placement(e).x] < diff["ruin_min"]]
    rep.add("start.ruins_clear", not ruins_near, f"{len(ruins_near)} ruin columns within {diff['ruin_min']} tiles")

    # ---- plants survive: living ones on moist, dry-footed, clean soil; succulents on dry soil
    wrong = []
    for t in TREES + ("BlueberryBush",):
        for e in ents.get(t, []):
            p = placement(e)
            if not is_dead(e) and (M[p.y, p.x] <= 0 or D[p.y, p.x] > 0 or SC[p.y, p.x] > 0):
                wrong.append(t)
    for e in ents.get("Succulent", []):
        p = placement(e)
        if not is_dead(e) and M[p.y, p.x] > 0:
            wrong.append("Succulent")
    rep.add("plants.survive", not wrong, f"{len(wrong)} living plants on soil that kills them" if wrong
            else "every living plant is on soil where it survives")

    # ---- drought: a reservoir site near the start that holds a colony through the worst drought
    need = cal.reservoir_needed(difficulty)
    kept = drought_storage(h, D, diff["drought_days"])
    natural = float(kept[sd <= 40].sum())
    sites = dam_sites(h, wet & (C < 0.05), h + D, stride=2)
    near_sites = [s for s in sites if sd[s["y"], s["x"]] <= 40]
    best = max([s["volume"] for s in near_sites], default=0.0)
    rep.add("water.reservoir", max(natural, best) >= need,
            f"best dam site within 40 tiles holds {best:.0f}, natural pools {natural:.0f}; "
            f"{need:.0f} carries {diff['colony']} beavers through a {diff['drought_days']}-day drought",
            round(max(natural, best)), need)

    # ---- resource totals: at least half the official median for this map size (about the official p10)
    area = X * Y
    ruins = [e for e in m.entities if e["Template"].startswith("RuinColumnH")]
    scrap = sum(15 * int(e["Template"][11:]) for e in ruins)
    for key, have, per in (("scrap", scrap, 1e3), ("trees", sum(len(ents.get(t, [])) for t in TREES + ("Succulent",)), 1e4),
                           ("bushes", len(ents.get("BlueberryBush", [])), 1e4)):
        dkey = {"scrap": "scrap_per_1k_tiles", "trees": "trees_per_10k", "bushes": "bushes_per_10k"}[key]
        need = 0.5 * cal.density(dkey, area) * area / per
        rep.add(f"resources.{key}", have >= need, f"{have} {key} (at least {need:.0f}: half the official median for this size)",
                have, round(need))

    # ---- ruins: fields of touching columns, each scavengeable from its own level
    if ruins:
        pts = [(placement(e).x, placement(e).y) for e in ruins]
        in_fields = sum(len(c) for c in point_clusters(pts, 1) if len(c) >= 10) / len(ruins)
        rep.add("ruins.fields", in_fields >= 0.8, f"{in_fields:.0%} of columns in fields of 10+ (official median 97%)",
                round(in_fields, 2), 0.8)
        # scavengers stand on an 8-neighbour on ground at the ruin's level; ruins and plants do
        # not block the navmesh, so neighbouring columns still count (4,961 of 4,964 official)
        blocked_access = 0
        for e, (x, y) in zip(ruins, pts):
            z = placement(e).z
            if not any(0 <= x + dx < X and 0 <= y + dy < Y and h[y + dy, x + dx] == z and not blocked[y + dy, x + dx]
                       for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy):
                blocked_access += 1
        rep.add("ruins.access", blocked_access == 0, f"{blocked_access} columns with no neighbour at their level")
    if water is not None:
        water.update({"D": D, "C": C, "M": M, "SC": SC, "reach": reach, "sites": sites})


def _adjacent(a, b):
    Y, X = a.shape
    for dy, dx in N4:
        s = np.zeros_like(b)
        s[max(0, dy):Y + min(0, dy), max(0, dx):X + min(0, dx)] = b[max(0, -dy):Y - max(0, dy), max(0, -dx):X - max(0, dx)]
        if (a & s).any():
            return True
    return False


def _touches(mask, y, x):
    Y, X = mask.shape
    return any(0 <= y + dy < Y and 0 <= x + dx < X and mask[y + dy, x + dx] for dy, dx in N4)
