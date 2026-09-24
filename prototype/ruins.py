"""Ruin fields: a few large fields of touching columns, short columns common, tall columns toward
the middle, total scrap scaled to map area. All targets come from calibration (see
investigation/REPORT.md, "Ruin fields")."""
from __future__ import annotations

import math

import numpy as np

from analysis import N4, N8
from tbmap import ORIENTATIONS, RUIN_VARIANTS, ruin


def sample_heights(rng, n, shares):
    """n column heights (1..8) drawn from the calibrated height shares."""
    p = np.array([shares[f"H{k}"] for k in range(1, 9)], float)
    return list(rng.choice(np.arange(1, 9), size=n, p=p / p.sum()))


def grow_blob(rng, allowed: np.ndarray, seed_yx, n, compactness=2.0):
    """Grow a connected blob of n tiles from seed_yx over allowed tiles. Frontier tiles with more
    blob neighbours are preferred, which keeps fields solid with ragged edges (like the official
    fields) instead of snakes. Returns a list of (y, x); may be shorter than n if space runs out."""
    Y, X = allowed.shape
    blob = {seed_yx}
    frontier = {}

    def push(y, x):
        for dy, dx in N8:
            yy, xx = y + dy, x + dx
            if 0 <= yy < Y and 0 <= xx < X and allowed[yy, xx] and (yy, xx) not in blob:
                frontier[(yy, xx)] = frontier.get((yy, xx), 0) + 1

    push(*seed_yx)
    while len(blob) < n and frontier:
        cells = list(frontier.keys())
        w = np.array([frontier[c] for c in cells], float) ** compactness
        pick = cells[rng.choice(len(cells), p=w / w.sum())]
        del frontier[pick]
        blob.add(pick)
        push(*pick)
    return sorted(blob)


def punch_holes(rng, cells, share):
    """Remove about share*len(cells) interior tiles (3+ of 4 neighbours in the field), the gaps
    official fields have between broken columns. The field stays one touching group."""
    s = set(cells)
    interior = [c for c in cells if sum((c[0] + dy, c[1] + dx) in s for dy, dx in N4) >= 3]
    k = int(round(share * len(cells)))
    for i in rng.permutation(len(interior))[:k]:
        s.discard(interior[i])
    return sorted(s)


def assign_heights(rng, cells, heights, center_bias, clump=2.5):
    """Give the sampled heights to the cells. Official fields show clumps of similar height
    (a block of 8s, a run of 5s: the remains of one building) and a mild lean of tall columns
    toward the middle. The key is smooth noise with a feature size of `clump` tiles plus
    center_bias * (1 - normalised radius); the tallest heights go to the highest keys.
    center_bias is calibrated so the height-vs-radius Spearman correlation matches."""
    ys = np.array([c[0] for c in cells], float)
    xs = np.array([c[1] for c in cells], float)
    cy, cx = ys.mean(), xs.mean()
    r = np.hypot(ys - cy, xs - cx)
    r = r / (r.max() or 1.0)
    # smooth noise: random lattice at spacing `clump`, bilinear between lattice points
    y0, x0 = ys.min(), xs.min()
    gy, gx = int((ys.max() - y0) / clump) + 2, int((xs.max() - x0) / clump) + 2
    lat = rng.random((gy, gx))
    fy, fx = (ys - y0) / clump, (xs - x0) / clump
    iy, ix = fy.astype(int), fx.astype(int)
    ty, tx = fy - iy, fx - ix
    noise = (lat[iy, ix] * (1 - tx) + lat[iy, ix + 1] * tx) * (1 - ty) \
        + (lat[iy + 1, ix] * (1 - tx) + lat[iy + 1, ix + 1] * tx) * ty
    key = noise + center_bias * (1 - r) + 0.15 * rng.random(len(cells))
    order = np.argsort(-key)
    hs = sorted(heights, reverse=True)
    out = [0] * len(cells)
    for rank, idx in enumerate(order):
        out[idx] = hs[rank]
    return out


def place_fields(rng, surface, allowed, start_dist, cal, area_scale=1.0):
    """Place ruin fields. `allowed` marks dry, flat-enough tiles free of other entities;
    `start_dist` is the tile distance from the start. `cal` keys:
      scrap_per_1k_tiles, field_columns (list of target sizes to draw from),
      height_shares {H1..H8}, center_bias, min_start_dist, min_field_spacing, singles_share.
    Returns (entities, fields) where fields lists (cells, heights) for reporting."""
    Y, X = surface.shape
    target_scrap = cal["scrap_per_1k_tiles"] * (X * Y) / 1000.0 * area_scale
    mean_h = sum(k * cal["height_shares"][f"H{k}"] for k in range(1, 9))
    target_columns = int(round(target_scrap / (15 * mean_h)))
    in_fields = int(round(target_columns * (1 - cal["singles_share"])))

    free = allowed & (start_dist >= cal["min_start_dist"])
    entities, fields, centres = [], [], []
    placed = 0
    attempts = 0
    while placed < in_fields and attempts < 200:
        attempts += 1
        size = int(min(rng.choice(cal["field_columns"]), in_fields - placed))
        if size < 12:
            break
        ys, xs = np.nonzero(free)
        if not len(ys):
            break
        i = rng.integers(len(ys))
        y, x = int(ys[i]), int(xs[i])
        if any(math.hypot(y - cy, x - cx) < cal["min_field_spacing"] for cy, cx in centres):
            continue
        # a field sits on one terrace level so every column stands on flat ground
        level = surface[y, x]
        cells = grow_blob(rng, free & (surface == level), (y, x),
                          int(size / (1 - cal["hole_share"])), cal["compactness"])
        if len(cells) < max(12, size // 2):             # fields have 10+ columns (official 97% of columns)
            continue
        cells = punch_holes(rng, cells, cal["hole_share"])
        hs = assign_heights(rng, cells, sample_heights(rng, len(cells), cal["height_shares"]), cal["center_bias"])
        for (cy, cx), hgt in zip(cells, hs):
            entities.append(ruin(int(hgt), cx, cy, int(surface[cy, cx]), variant=str(rng.choice(RUIN_VARIANTS)),
                                 orientation=str(rng.choice(ORIENTATIONS)), rng=rng))
            free[cy, cx] = False
        # keep a one-tile moat so separate fields never touch
        for cy, cx in cells:
            for dy, dx in N8:
                if 0 <= cy + dy < Y and 0 <= cx + dx < X:
                    free[cy + dy, cx + dx] = False
        centres.append((sum(c[0] for c in cells) / len(cells), sum(c[1] for c in cells) / len(cells)))
        fields.append((cells, hs))
        placed += len(cells)

    # a few lone columns (official maps keep ~3% of columns outside fields). If fields ran out
    # of room, the map simply gets less scrap rather than a scatter of singles.
    singles = min(max(0, target_columns - placed), int(round(target_columns * cal["singles_share"])))
    ys, xs = np.nonzero(free)
    for i in rng.permutation(len(ys))[:singles]:
        y, x = int(ys[i]), int(xs[i])
        hgt = int(sample_heights(rng, 1, cal["height_shares"])[0])
        entities.append(ruin(min(hgt, 3), x, y, int(surface[y, x]), variant=str(rng.choice(RUIN_VARIANTS)),
                             orientation=str(rng.choice(ORIENTATIONS)), rng=rng))
    return entities, fields
