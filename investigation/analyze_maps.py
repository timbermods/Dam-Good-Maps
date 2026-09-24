"""Measure every official and workshop map and write calibration.json (per-map numbers plus
aggregates by map source and size class). REPORT.md is written from these numbers.

    python investigation/analyze_maps.py            # all maps
    python investigation/analyze_maps.py Diorama    # maps whose file name contains "Diorama"

Maps are read from investigation/raw (copied from the game install and Steam workshop folder;
see REPORT.md). Official = the 19 maps shipped with the game (dev maps starting with "_" are
skipped). Everything is measured on the top terrain surface; caves are counted separately.
"""
import glob
import json
import math
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "prototype"))
from analysis import (BAD_EMITTERS, BUSHES, N4, TREES, by_template, components, dam_sites,  # noqa: E402
                      distance_from, flat_mask, is_dead, level_regions, plateaus, point_clusters,
                      points, priority_flood, saved_moisture, saved_water, step_histogram,
                      strength, summary, walk_regions)
from tbmap import TimberMap, placement  # noqa: E402

WET = 0.1            # a tile holds water when saved depth >= this
BAD = 0.3            # ... and it is badwater when its contamination share is >= this
RINGS = (16, 32, 64, 128, 10_000)


def size_class(area):
    if area <= 12_000:
        return "small"        # up to ~100x100
    if area <= 20_000:
        return "medium"       # 128x128
    if area <= 45_000:
        return "large"        # 192x192, 151x251
    return "max"              # 256x150 .. 256x256


def start_center(e):
    """Centre tile of the 3x3 StartingLocation (the footprint is 3x3 whatever the rotation)."""
    p = placement(e)
    # Coordinates are the min corner for Cw0; other orientations rotate about it. The footprint
    # agent's findings refine this; within +-1 tile it does not change distance statistics.
    off = {"Cw0": (1, 1), "Cw90": (1, -1), "Cw180": (-1, -1), "Cw270": (-1, 1)}[p.orientation]
    return p.x + off[0], p.y + off[1], p.z


def ring_shares(dist_map, pts, weights=None):
    if not pts:
        return None
    w = weights or [1.0] * len(pts)
    tot = sum(w)
    out = {}
    lo = 0
    for r in RINGS:
        s = sum(wi for (x, y), wi in zip(pts, w) if lo <= dist_map[y, x] < r)
        out[f"{lo}-{r if r < 10_000 else 'edge'}"] = round(s / tot, 3)
        lo = r
    return out


def analyze(path, source):
    t0 = time.time()
    m = TimberMap.read(path, allow_legacy=True)
    X, Y = m.size_x, m.size_y
    area = X * Y
    h = m.surface()
    ents = by_template(m)
    res = {"name": os.path.basename(path)[:-7], "source": source, "size": [X, Y], "area": area,
           "size_class": size_class(area), "layers": m.layers, "game_version": m.game_version,
           "legacy_heightmap": m.legacy}
    if m.metadata:
        res["recommended"] = m.metadata.get("IsRecommended")
        res["unconventional"] = m.metadata.get("IsUnconventional")
    res["template_counts"] = {k: len(v) for k, v in sorted(ents.items(), key=lambda kv: -len(kv[1]))}

    # ---------------- terrain ----------------
    floors = m.floors()
    labels, info = level_regions(h)
    flat = flat_mask(h)
    hs = h.ravel()
    res["terrain"] = {
        "height": {"min": int(hs.min()), "p5": int(np.percentile(hs, 5)), "median": int(np.median(hs)),
                   "p95": int(np.percentile(hs, 95)), "max": int(hs.max()),
                   "range_p5_p95": int(np.percentile(hs, 95) - np.percentile(hs, 5))},
        "distinct_levels": int(len(np.unique(hs))),
        "levels_with_1pct_area": int((np.bincount(hs) >= 0.01 * area).sum()),
        "step_histogram": step_histogram(h),
        "flat_share": round(float(flat.mean()), 3),
        "cliff_tile_share": round(float(_cliff_tiles(h, 2).mean()), 3),
        "overhang_column_share": round(float((floors >= 2).mean()), 4),
        "overhang_columns": int((floors >= 2).sum()),
        "largest_level_region_share": round(max(n for _, n in info) / area, 3),
        "level_regions_over_400": sum(1 for _, n in info if n >= 400),
        "plateaus": plateaus(h, labels, info, min_area=max(40, area // 1000)),
    }
    res["terrain"]["plateau_count"] = len(res["terrain"]["plateaus"])
    res["terrain"]["plateaus"] = sorted(res["terrain"]["plateaus"], key=lambda p: -p["area"])[:8]
    step_tot = sum(res["terrain"]["step_histogram"].values()) or 1
    res["terrain"]["step_share"] = {k: round(v / step_tot, 3) for k, v in sorted(res["terrain"]["step_histogram"].items())}

    slopes = ents.get("Slope", [])
    res["terrain"]["slopes"] = {"count": len(slopes), "per_10k_tiles": round(len(slopes) / area * 1e4, 2)}

    # ---------------- water ----------------
    depth, contam, wfloor = saved_water(m)
    wet = depth >= WET
    bad = wet & (contam >= BAD)
    clean = wet & ~bad
    res["saved_water"] = {"has_state": bool(wet.any()),
                          "water_share": round(float(wet.mean()), 4),
                          "badwater_share": round(float(bad.mean()), 4),
                          "mean_depth": round(float(depth[wet].mean()), 2) if wet.any() else 0,
                          "deep_share_ge1": round(float((depth >= 1).mean()), 4),
                          "floor_matches_surface": round(float((wfloor[wet] == h[wet]).mean()), 3) if wet.any() else None}
    if wet.any():
        _, sizes = components(wet, N4)
        res["saved_water"]["bodies"] = len([s for s in sizes if s >= 10])
        res["saved_water"]["largest_body_share"] = round(max(sizes) / area, 4)
        surf = np.where(wet, wfloor + depth, np.nan)
        res["saved_water"]["waterfall_tiles"] = int(_waterfall_tiles(surf, 1.5).sum())
        _, fall_sizes = components(_waterfall_tiles(surf, 1.5), ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)))
        res["saved_water"]["waterfalls"] = len(fall_sizes)
        drops = [0.0]
        for dy, dx in N4:
            a = surf[max(0, -dy):Y - max(0, dy), max(0, -dx):X - max(0, dx)]
            b = surf[max(0, dy):Y - max(0, -dy), max(0, dx):X - max(0, -dx)]
            with np.errstate(invalid="ignore"):
                d_ = np.nan_to_num(a - b, nan=0)
            drops.append(float(d_.max()))
        res["saved_water"]["max_waterfall_drop"] = round(max(drops), 1)
        land = ~wet
        lab, lsz = components(land, N4)
        edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
        res["saved_water"]["islands_ge_100"] = sum(1 for i, s in enumerate(lsz) if s >= 100 and i not in edge_labels)

    sources = {}
    for kind in ("WaterSource", "BadwaterSource", "WaterSeep", "BadwaterSeep", "Aquifer", "BadtideDrain"):
        es = ents.get(kind, [])
        if not es:
            continue
        st = [strength(e) for e in es]
        edge = [min(placement(e).x, placement(e).y, X - 1 - placement(e).x, Y - 1 - placement(e).y) <= 3 for e in es]
        elev = [float((h < placement(e).z).mean()) for e in es]      # share of map lower than the source
        sources[kind] = {"count": len(es), "strengths": sorted(st), "total_strength": round(sum(st), 2),
                         "strength_per_10k_tiles": round(sum(st) / area * 1e4, 3),
                         "per_10k_tiles": round(len(es) / area * 1e4, 3),
                         "edge_share": round(sum(edge) / len(es), 2),
                         "elevation_rank": summary(elev)}
    res["sources"] = sources

    # natural basins (would hold water with no dam) from a depression fill with the edge as outlet
    filled = priority_flood(h)
    basin = filled - h
    bl, bsz = components(basin > 0, N4)
    vols = [0.0] * len(bsz)
    for (y, x) in zip(*np.nonzero(basin > 0)):
        vols[bl[y, x]] += basin[y, x]
    big = sorted([(v, s) for v, s in zip(vols, bsz) if s >= 20], reverse=True)
    res["basins"] = {"count_ge20": len(big), "largest": [{"volume": round(v), "area": s} for v, s in big[:5]],
                     "total_volume_per_10k_tiles": round(sum(v for v, _ in big) / area * 1e4)}

    # dam sites along saved watercourses (or valley floors if a map has no saved water)
    channel = wet.copy() if wet.any() else (basin > 0)
    wsurf = np.where(wet, wfloor + depth, h.astype(float))
    sites = dam_sites(h, channel, wsurf, stride=4 if area > 30000 else 3)
    res["dam_sites"] = {"count": len(sites), "per_10k_tiles": round(len(sites) / area * 1e4, 2),
                        "top": sites[:6],
                        "ratio": summary([s["ratio"] for s in sites]),
                        "length": summary([s["length"] for s in sites])}

    # ---------------- start ----------------
    starts = ents.get("StartingLocation", [])
    res["starts"] = len(starts)
    moist = saved_moisture(m)
    trees = [e for t in TREES for e in ents.get(t, [])]
    living = [e for e in trees if not is_dead(e)]
    bushes = [e for t in BUSHES for e in ents.get(t, [])]
    ruins = [e for e in m.entities if e["Template"].startswith("RuinColumnH")]
    water_d = distance_from(clean) if clean.any() else np.full((Y, X), np.inf)
    moist_d = distance_from(moist > 0) if (moist > 0).any() else np.full((Y, X), np.inf)
    bad_mask = bad.copy()
    for kind in BAD_EMITTERS:
        for e in ents.get(kind, []):
            p = placement(e)
            bad_mask[min(p.y, Y - 1), min(p.x, X - 1)] = True
    bad_d = distance_from(bad_mask) if bad_mask.any() else np.full((Y, X), np.inf)

    if starts:
        sx, sy, sz = start_center(starts[0])
        sx, sy = min(max(sx, 0), X - 1), min(max(sy, 0), Y - 1)
        start_mask = np.zeros((Y, X), bool)
        start_mask[sy, sx] = True
        sd = distance_from(start_mask)

        def nearest(pts):
            return round(min((sd[y, x] for x, y in pts), default=float("inf")), 1)
        src_pts = points(ents.get("WaterSource", []))
        ruin_pts = points(ruins)
        fields = [f for f in point_clusters(ruin_pts, 1) if len(f) >= 20]
        big_field_pts = [ruin_pts[i] for f in fields for i in f]
        walk0, wsz0 = walk_regions(h, 0)
        walk1, wsz1 = walk_regions(h, 1)
        # beavers cannot climb a 1-voxel step; map Slopes bridge one level (notes/navigation...)
        links = []
        for e in ents.get("Slope", []):
            p = placement(e)
            dx, dy = {"Cw0": (0, -1), "Cw90": (-1, 0), "Cw180": (0, 1), "Cw270": (1, 0)}[p.orientation]
            if 0 <= p.x + dx < X and 0 <= p.y + dy < Y and 0 <= p.x < X and 0 <= p.y < Y:
                links.append(((p.y, p.x), (p.y + dy, p.x + dx)))
        walkS, wszS = walk_regions(h, 0, None, links)
        # clean water a Folktails pump at the start level can reach (surface 0..2 below the start)
        surf = np.where(wet, wfloor + depth, -99)
        pump = clean & (depth >= 0.3) & (surf >= h[sy, sx] - 2) & (surf <= h[sy, sx] + 0.01)
        pump_d = distance_from(pump) if pump.any() else np.full((Y, X), np.inf)
        res["start"] = {
            "center": [sx, sy, int(sz)], "orientation": placement(starts[0]).orientation,
            "surface_at_start": int(h[sy, sx]),
            "dist_clean_water": round(float(water_d[sy, sx]), 1),
            "dist_water_source": nearest(src_pts),
            "dist_badwater": round(float(bad_d[sy, sx]), 1),
            "dist_tree": nearest(points(trees)),
            "dist_living_tree": nearest(points(living)),
            "dist_bush": nearest(points(bushes)),
            "dist_ruin": nearest(ruin_pts),
            "dist_ruin_field_ge20": nearest(big_field_pts),
            "living_trees_r20": sum(1 for x, y in points(living) if sd[y, x] <= 20),
            "trees_r20": sum(1 for x, y in points(trees) if sd[y, x] <= 20),
            "bushes_r20": sum(1 for x, y in points(bushes) if sd[y, x] <= 20),
            "scrap_r40": sum(15 * int(e["Template"][11:]) for e in ruins if sd[placement(e).y, placement(e).x] <= 40),
            "dist_pumpable_clean_water": round(float(pump_d[sy, sx]), 1),
            "flat_region_at_start": int(wsz0[walk0[sy, sx]]),
            "reach_with_slopes": int(wszS[walkS[sy, sx]]),
            "reach_with_slopes_share": round(wszS[walkS[sy, sx]] / area, 3),
            "slopes_within_25": sum(1 for e in ents.get("Slope", []) if sd[placement(e).y, placement(e).x] <= 25),
            "step1_region_at_start_share": round(wsz1[walk1[sy, sx]] / area, 3),
            "same_height_r12": int(((sd <= 12) & (h == h[sy, sx])).sum()),
            "dry_land_r12_share": round(float(((sd <= 12) & ~wet).sum() / max(1, (sd <= 12).sum())), 3),
        }
        # resources by distance from the start
        res["distance_profile"] = {
            "living_trees": ring_shares(sd, points(living)),
            "all_trees": ring_shares(sd, points(trees)),
            "bushes": ring_shares(sd, points(bushes)),
            "scrap": ring_shares(sd, ruin_pts, [15 * int(e["Template"][11:]) for e in ruins]),
            "water_sources": ring_shares(sd, src_pts, [strength(e) for e in ents.get("WaterSource", [])]),
            "badwater": ring_shares(sd, points([e for k in BAD_EMITTERS for e in ents.get(k, [])])),
            "flat_land": ring_shares(sd, [(x, y) for y, x in zip(*np.nonzero(flat & ~wet))]),
        }

    # ---------------- forests and bushes ----------------
    species = {}
    for t in TREES:
        es = ents.get(t, [])
        if es:
            species[t] = {"count": len(es), "dead_share": round(sum(map(is_dead, es)) / len(es), 3)}
    tree_pts = points(trees)
    clusters = point_clusters(tree_pts, 1) if tree_pts else []
    csizes = [len(c) for c in clusters]
    mixes = []
    for c in clusters:
        if len(c) >= 20:
            cnt = {}
            for i in c:
                cnt[trees[i]["Template"]] = cnt.get(trees[i]["Template"], 0) + 1
            mixes.append(max(cnt.values()) / len(c))

    def dist_stats(es, dmap):
        return summary([dmap[placement(e).y, placement(e).x] for e in es])
    res["forest"] = {
        "trees": len(trees), "trees_per_10k_tiles": round(len(trees) / area * 1e4, 1),
        "living_share": round(len(living) / len(trees), 3) if trees else None,
        "species": species,
        "clusters_ge5": sum(1 for s in csizes if s >= 5),
        "cluster_size": summary([s for s in csizes if s >= 5]),
        "largest_cluster": max(csizes) if csizes else 0,
        "dominant_species_share_in_clusters_ge20": summary(mixes),
        "living_dist_to_water": dist_stats(living, water_d),
        "dead_dist_to_water": dist_stats([e for e in trees if is_dead(e)], water_d),
        "living_moisture": summary([moist[placement(e).y, placement(e).x] for e in living]),
        "living_on_moist_share": round(sum(1 for e in living if moist[placement(e).y, placement(e).x] > 0) / len(living), 3) if living else None,
        "dead_on_moist_share": round(sum(1 for e in trees if is_dead(e) and moist[placement(e).y, placement(e).x] > 0) / max(1, len(trees) - len(living)), 3),
        "living_dist_to_moist": dist_stats(living, moist_d),
    }
    bpts = points(bushes)
    bcl = point_clusters(bpts, 1) if bpts else []
    res["bushes"] = {"count": len(bushes), "per_10k_tiles": round(len(bushes) / area * 1e4, 1),
                     "clusters_ge3": sum(1 for c in bcl if len(c) >= 3),
                     "cluster_size": summary([len(c) for c in bcl if len(c) >= 3]),
                     "dist_to_water": dist_stats(bushes, water_d),
                     "on_moist_share": round(sum(1 for e in bushes if moist[placement(e).y, placement(e).x] > 0) / len(bushes), 3) if bushes else None,
                     "dead_share": round(sum(map(is_dead, bushes)) / len(bushes), 3) if bushes else None}
    if moist.any() and wet.any():
        res["moisture_reach"] = _moisture_reach(moist, wet, depth)

    # ---------------- ruins ----------------
    res["ruins"] = _ruin_stats(ruins, h, wet, water_d, area, sd if starts else None)
    res["seconds"] = round(time.time() - t0, 1)
    return res


def _cliff_tiles(h, step):
    Y, X = h.shape
    p = np.pad(h, 1, mode="edge")
    out = np.zeros((Y, X), bool)
    for dy, dx in N4:
        out |= np.abs(p[1 + dy:1 + dy + Y, 1 + dx:1 + dx + X] - h) >= step
    return out


def _waterfall_tiles(surf, drop):
    Y, X = surf.shape
    out = np.zeros((Y, X), bool)
    for dy, dx in N4:
        a = surf[max(0, -dy):Y - max(0, dy), max(0, -dx):X - max(0, dx)]
        b = surf[max(0, dy):Y - max(0, -dy), max(0, dx):X - max(0, -dx)]
        with np.errstate(invalid="ignore"):
            f = (a - b) >= drop
        out[max(0, -dy):Y - max(0, dy), max(0, -dx):X - max(0, dx)] |= np.nan_to_num(f, nan=0).astype(bool)
    return out


def _moisture_reach(moist, wet, depth):
    """How far moisture extends from saved water: moisture by Chebyshev distance to a wet tile."""
    d = distance_from(wet)
    out = {}
    for r in range(1, 21):
        ring = (d > r - 0.5) & (d <= r + 0.5) & ~wet
        if ring.sum() < 20:
            continue
        out[str(r)] = {"moist_share": round(float((moist[ring] > 0).mean()), 3),
                       "mean": round(float(moist[ring].mean()), 2)}
    moist_dry = (moist > 0) & ~wet
    out["max_dist_of_moist_tile_p99"] = round(float(np.percentile(d[moist_dry], 99)), 1) if moist_dry.any() else None
    return out


def _ruin_stats(ruins, h, wet, water_d, area, sd):
    if not ruins:
        return {"columns": 0}
    pts = points(ruins)
    heights = [int(e["Template"][11:]) for e in ruins]
    scrap = 15 * sum(heights)
    hist = {f"H{k}": heights.count(k) for k in range(1, 9)}
    touching = point_clusters(pts, 1)
    loose = point_clusters(pts, 3)
    fields = [f for f in touching if len(f) >= 10]
    # spacing: nearest centroid distance between fields
    cents = [(np.mean([pts[i][0] for i in f]), np.mean([pts[i][1] for i in f])) for f in fields]
    spacing = []
    for i, (cx, cy) in enumerate(cents):
        ds = [math.hypot(cx - ox, cy - oy) for j, (ox, oy) in enumerate(cents) if j != i]
        if ds:
            spacing.append(min(ds))
    # tall toward the middle: mean height by normalised distance from the field centroid
    inner, middle, outer, corr = [], [], [], []
    on_ground = 0
    plateau_offsets, height_spread, field_water = [], [], []
    Y, X = h.shape
    for f, (cx, cy) in zip(fields, cents):
        r = [math.hypot(pts[i][0] - cx, pts[i][1] - cy) for i in f]
        rmax = max(r) or 1
        for i, ri in zip(f, r):
            t = ri / rmax
            (inner if t < 1 / 3 else middle if t < 2 / 3 else outer).append(heights[i])
        if len(f) >= 8:
            corr.append(_spearman([heights[i] for i in f], r))
        ground = [h[pts[i][1], pts[i][0]] for i in f]
        height_spread.append(max(ground) - min(ground))
        # is the field raised above its surroundings? mean ground minus ring 3-8 tiles out
        x0, x1 = max(0, int(min(pts[i][0] for i in f)) - 8), min(X, int(max(pts[i][0] for i in f)) + 9)
        y0, y1 = max(0, int(min(pts[i][1] for i in f)) - 8), min(Y, int(max(pts[i][1] for i in f)) + 9)
        box = h[y0:y1, x0:x1]
        plateau_offsets.append(float(np.mean(ground) - np.median(box)))
        field_water.append(float(min(water_d[pts[i][1], pts[i][0]] for i in f)))
    fills, aspects, holes = [], [], []
    for f in fields:
        fx, fy = [pts[i][0] for i in f], [pts[i][1] for i in f]
        w, hh = max(fx) - min(fx) + 1, max(fy) - min(fy) + 1
        fills.append(len(f) / (w * hh))
        aspects.append(max(w, hh) / min(w, hh))
        s = {pts[i] for i in f}
        holes.append(sum(1 for x in range(min(fx), max(fx) + 1) for y in range(min(fy), max(fy) + 1)
                         if (x, y) not in s and sum((x + dx, y + dy) in s for dx, dy in N4) >= 3) / len(f))
    for e, (x, y) in zip(ruins, pts):
        on_ground += placement(e).z == h[y, x]
    out = {
        "columns": len(ruins), "scrap": scrap, "scrap_per_1k_tiles": round(scrap / area * 1e3, 1),
        "height_hist": hist, "mean_height": round(float(np.mean(heights)), 2),
        "fields_touching_ge10": len(fields),
        "field_columns": summary([len(f) for f in fields]),
        "columns_in_fields_share": round(sum(len(f) for f in fields) / len(ruins), 3),
        "touching_groups_all": summary([len(c) for c in touching]),
        "loose_fields_gap3_ge10": sum(1 for c in loose if len(c) >= 10),
        "field_spacing": summary(spacing),
        "field_fill_of_bbox": summary(fills),
        "field_aspect": summary(aspects),
        "field_interior_holes_per_column": summary(holes),
        "mean_height_inner_mid_outer": [round(float(np.mean(v)), 2) if v else None for v in (inner, middle, outer)],
        "height_vs_radius_spearman": summary(corr),
        "ground_spread_in_field": summary(height_spread),
        "field_raised_above_surroundings": summary(plateau_offsets),
        "field_dist_to_water": summary(field_water),
        "on_top_surface_share": round(on_ground / len(ruins), 3),
        "variants": {},
    }
    for e in ruins:
        v = e["Components"].get("RuinModels", {}).get("VariantId", "?")
        out["variants"][v] = out["variants"].get(v, 0) + 1
    if sd is not None:
        out["field_dist_from_start"] = summary([min(sd[pts[i][1], pts[i][0]] for i in f) for f in fields])
    return out


def _spearman(a, b):
    ra, rb = _rank(a), _rank(b)
    if np.std(ra) == 0 or np.std(rb) == 0:
        return 0.0
    return float(np.corrcoef(ra, rb)[0, 1])


def _rank(v):
    order = np.argsort(v, kind="stable")
    r = np.empty(len(v))
    r[order] = np.arange(len(v))
    return r


# ---------------------------------------------------------------------------------------------

def aggregate(maps):
    """Distribution of the key numbers over groups of maps."""
    def collect(key_fn):
        vals = []
        for r in maps:
            try:
                v = key_fn(r)
            except (KeyError, TypeError, ZeroDivisionError):
                continue
            if v is not None and (not isinstance(v, float) or np.isfinite(v)):
                vals.append(v)
        return summary(vals)
    return {
        "maps": [r["name"] for r in maps],
        "height_range_p5_p95": collect(lambda r: r["terrain"]["height"]["range_p5_p95"]),
        "height_max": collect(lambda r: r["terrain"]["height"]["max"]),
        "levels_with_1pct_area": collect(lambda r: r["terrain"]["levels_with_1pct_area"]),
        "flat_share": collect(lambda r: r["terrain"]["flat_share"]),
        "cliff_tile_share": collect(lambda r: r["terrain"]["cliff_tile_share"]),
        "step1_share_of_steps": collect(lambda r: r["terrain"]["step_share"].get("1", 0)),
        "overhang_column_share": collect(lambda r: r["terrain"]["overhang_column_share"]),
        "plateau_count": collect(lambda r: r["terrain"]["plateau_count"]),
        "slopes_per_10k": collect(lambda r: r["terrain"]["slopes"]["per_10k_tiles"]),
        "water_share": collect(lambda r: r["saved_water"]["water_share"] if r["saved_water"]["has_state"] else None),
        "badwater_share": collect(lambda r: r["saved_water"]["badwater_share"] if r["saved_water"]["has_state"] else None),
        "waterfalls": collect(lambda r: r["saved_water"].get("waterfalls")),
        "water_sources": collect(lambda r: r["sources"]["WaterSource"]["count"]),
        "water_strength_total": collect(lambda r: r["sources"]["WaterSource"]["total_strength"]),
        "water_strength_per_10k": collect(lambda r: r["sources"]["WaterSource"]["strength_per_10k_tiles"]),
        "water_source_strength_each": summary([s for r in maps for s in r["sources"].get("WaterSource", {}).get("strengths", [])]),
        "water_source_edge_share": collect(lambda r: r["sources"]["WaterSource"]["edge_share"]),
        "badwater_sources": collect(lambda r: r["sources"].get("BadwaterSource", {}).get("count", 0)),
        "badwater_strength_per_10k": collect(lambda r: r["sources"].get("BadwaterSource", {}).get("strength_per_10k_tiles", 0)),
        "badwater_to_water_strength": collect(lambda r: r["sources"].get("BadwaterSource", {}).get("total_strength", 0) / r["sources"]["WaterSource"]["total_strength"]),
        "basins_ge20": collect(lambda r: r["basins"]["count_ge20"]),
        "dam_sites_per_10k": collect(lambda r: r["dam_sites"]["per_10k_tiles"]),
        "best_dam_ratio": collect(lambda r: r["dam_sites"]["top"][0]["ratio"] if r["dam_sites"]["top"] else 0),
        "start_dist_clean_water": collect(lambda r: r["start"]["dist_clean_water"]),
        "start_dist_water_source": collect(lambda r: r["start"]["dist_water_source"]),
        "start_dist_badwater": collect(lambda r: r["start"]["dist_badwater"]),
        "start_dist_living_tree": collect(lambda r: r["start"]["dist_living_tree"]),
        "start_dist_tree": collect(lambda r: r["start"]["dist_tree"]),
        "start_dist_bush": collect(lambda r: r["start"]["dist_bush"]),
        "start_dist_ruin": collect(lambda r: r["start"]["dist_ruin"]),
        "start_dist_ruin_field_ge20": collect(lambda r: r["start"]["dist_ruin_field_ge20"]),
        "start_living_trees_r20": collect(lambda r: r["start"]["living_trees_r20"]),
        "start_trees_r20": collect(lambda r: r["start"]["trees_r20"]),
        "start_bushes_r20": collect(lambda r: r["start"]["bushes_r20"]),
        "start_scrap_r40": collect(lambda r: r["start"]["scrap_r40"]),
        "start_flat_region": collect(lambda r: r["start"]["flat_region_at_start"]),
        "start_reach_with_slopes": collect(lambda r: r["start"]["reach_with_slopes"]),
        "start_reach_with_slopes_share": collect(lambda r: r["start"]["reach_with_slopes_share"]),
        "start_slopes_within_25": collect(lambda r: r["start"]["slopes_within_25"]),
        "start_dist_pumpable_clean_water": collect(lambda r: r["start"]["dist_pumpable_clean_water"]),
        "max_waterfall_drop": collect(lambda r: r["saved_water"].get("max_waterfall_drop")),
        "start_same_height_r12": collect(lambda r: r["start"]["same_height_r12"]),
        "trees_per_10k": collect(lambda r: r["forest"]["trees_per_10k_tiles"]),
        "living_tree_share": collect(lambda r: r["forest"]["living_share"]),
        "forest_clusters_ge5": collect(lambda r: r["forest"]["clusters_ge5"]),
        "forest_cluster_median": collect(lambda r: r["forest"]["cluster_size"]["median"]),
        "forest_largest_cluster": collect(lambda r: r["forest"]["largest_cluster"]),
        "forest_dominant_species_share": collect(lambda r: r["forest"]["dominant_species_share_in_clusters_ge20"]["median"]),
        "living_tree_dist_water_median": collect(lambda r: r["forest"]["living_dist_to_water"]["median"]),
        "living_tree_dist_water_p90": collect(lambda r: r["forest"]["living_dist_to_water"]["p90"]),
        "living_on_moist_share": collect(lambda r: r["forest"]["living_on_moist_share"]),
        "bushes_per_10k": collect(lambda r: r["bushes"]["per_10k_tiles"]),
        "bush_dist_water_median": collect(lambda r: r["bushes"]["dist_to_water"]["median"]),
        "bush_cluster_median": collect(lambda r: r["bushes"]["cluster_size"]["median"]),
        "ruin_columns": collect(lambda r: r["ruins"]["columns"]),
        "scrap_per_1k_tiles": collect(lambda r: r["ruins"]["scrap_per_1k_tiles"]),
        "ruin_fields_ge10": collect(lambda r: r["ruins"]["fields_touching_ge10"]),
        "ruin_field_columns_median": collect(lambda r: r["ruins"]["field_columns"]["median"]),
        "ruin_field_columns_max": collect(lambda r: r["ruins"]["field_columns"]["max"]),
        "ruin_columns_in_fields_share": collect(lambda r: r["ruins"]["columns_in_fields_share"]),
        "ruin_field_spacing_median": collect(lambda r: r["ruins"]["field_spacing"]["median"]),
        "ruin_field_fill_median": collect(lambda r: r["ruins"]["field_fill_of_bbox"]["median"]),
        "ruin_field_holes_median": collect(lambda r: r["ruins"]["field_interior_holes_per_column"]["median"]),
        "ruin_mean_height": collect(lambda r: r["ruins"]["mean_height"]),
        "ruin_height_vs_radius_spearman": collect(lambda r: r["ruins"]["height_vs_radius_spearman"]["median"]),
        "ruin_field_raised": collect(lambda r: r["ruins"]["field_raised_above_surroundings"]["median"]),
        "ruin_field_dist_from_start_min": collect(lambda r: r["ruins"]["field_dist_from_start"]["min"]),
        "ruin_field_dist_from_start_median": collect(lambda r: r["ruins"]["field_dist_from_start"]["median"]),
    }


def ruin_height_shares(maps):
    tot = {f"H{k}": 0 for k in range(1, 9)}
    for r in maps:
        for k, v in r["ruins"].get("height_hist", {}).items():
            tot[k] += v
    n = sum(tot.values()) or 1
    return {k: round(v / n, 3) for k, v in tot.items()}


def main():
    flt = sys.argv[1] if len(sys.argv) > 1 else ""
    official = [p for p in sorted(glob.glob(os.path.join(HERE, "raw", "builtin", "*.timber")))
                if not os.path.basename(p).startswith("_")]
    workshop = sorted(glob.glob(os.path.join(HERE, "raw", "workshop", "*.timber")))
    results = []
    for src, paths in (("official", official), ("workshop", workshop)):
        for p in paths:
            if flt and flt not in p:
                continue
            r = analyze(p, src)
            print(f"{r['name'][:32]:32s} {r['size_class']:6s} {r['seconds']:5.1f}s  fields={r['ruins'].get('fields_touching_ge10')} "
                  f"dams={r['dam_sites']['count']} start_water={r.get('start', {}).get('dist_clean_water')}", flush=True)
            results.append(r)
    if flt:
        print(json.dumps(results, indent=1)[:6000])
        return
    groups = {"official": [r for r in results if r["source"] == "official"],
              "workshop": [r for r in results if r["source"] == "workshop"],
              "all": results}
    for sc in ("small", "medium", "large", "max"):
        groups[f"official_{sc}"] = [r for r in results if r["source"] == "official" and r["size_class"] == sc]
        groups[f"all_{sc}"] = [r for r in results if r["size_class"] == sc]
    out = {"generated": time.strftime("%Y-%m-%d"), "game_version": "1.1.2.4",
           "method": {"wet_depth": WET, "badwater_contamination": BAD, "rings": RINGS,
                      "size_classes": "small<=12k tiles, medium<=20k, large<=45k, max>45k",
                      "notes": "distances in tiles (chamfer); 'touching' = Chebyshev distance 1"},
           "aggregates": {k: aggregate(v) for k, v in groups.items() if v},
           "ruin_height_shares": {k: ruin_height_shares(v) for k, v in groups.items() if v},
           "maps": results}
    with open(os.path.join(HERE, "calibration.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o))
    print("wrote calibration.json")


if __name__ == "__main__":
    main()
