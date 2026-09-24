"""Forests and berry patches, calibrated on the official maps (investigation/REPORT.md, "Forests
and berries"): single-species groves of ~10 trees with a heavy tail of big woods, about a third
of trees alive, living trees inside moisture reach of water, dead stands on the dry benches,
and large berry patches beside water."""
from __future__ import annotations

import numpy as np

from analysis import N8
from ruins import grow_blob
from tbmap import bush, tree


def poisson_seeds(rng, weight: np.ndarray, count: int, min_gap: float, tries=30):
    """Up to `count` seed tiles, sampled with probability ~ weight, at least min_gap apart."""
    Y, X = weight.shape
    flat = weight.ravel().astype(float)
    if flat.sum() <= 0:
        return []
    p = flat / flat.sum()
    picks = rng.choice(len(flat), size=min(len(flat), count * tries), p=p)
    seeds = []
    for i in picks:
        y, x = divmod(int(i), X)
        if all((y - sy) ** 2 + (x - sx) ** 2 >= min_gap * min_gap for sy, sx in seeds):
            seeds.append((y, x))
            if len(seeds) >= count:
                break
    return seeds


def cluster_sizes(rng, total, median, cap):
    """Log-normal grove sizes with the calibrated median and a heavy tail, summing to ~total."""
    sizes = []
    while sum(sizes) < total:
        s = int(np.clip(rng.lognormal(np.log(median), 0.9), 3, cap))
        sizes.append(min(s, total - sum(sizes)) if total - sum(sizes) >= 3 else 3)
    return sizes


def place_forests(rng, surface, free, moist, cal, start_yx=None):
    """free: tiles where a tree may stand (dry ground, no other entity). moist: tiles within
    moisture reach (trees there live). cal keys: trees_per_10k, living_share, grove_median,
    grove_cap, species {name: share}, young_share, near_start {radius, min_living}."""
    Y, X = surface.shape
    total = int(cal["trees_per_10k"] * X * Y / 1e4)
    living_target = int(total * cal["living_share"])
    ents = []
    names = list(cal["species"])
    shares = np.array([cal["species"][n] for n in names], float)
    shares /= shares.sum()
    occupied = ~free.copy()

    def grow_grove(seed, size, living):
        """One single-species grove (official groves are single-species). Like the map editor,
        trees on moist soil are alive and trees on dry soil are stored dead (they keep their
        logs); succulents are the exception: they live on dry soil and die on moist soil."""
        mask = ~occupied & (moist if living else ~moist)
        if not mask[seed]:
            return 0
        cells = grow_blob(rng, mask, seed, size, compactness=0.8)
        sp = names[rng.choice(len(names), p=shares)]
        if sp == "Succulent" and living:
            sp = "Pine"
        for (y, x) in cells:
            dead = not living and sp != "Succulent"
            young = (not dead) and rng.random() < cal["young_share"]
            ents.append(tree(sp, x, y, int(surface[y, x]), dead=dead,
                             growth=float(rng.uniform(0.2, 0.95)) if young else 1.0, rng=rng))
            occupied[y, x] = True
        return len(cells)

    # woods near the start first, so the first log is always a short walk away
    if start_yx is not None:
        sy, sx = start_yx
        yy, xx = np.mgrid[0:Y, 0:X]
        ring = ((yy - sy) ** 2 + (xx - sx) ** 2 <= cal["near_start"]["radius"] ** 2) & moist & ~occupied
        got = 0
        for seed in poisson_seeds(rng, ring.astype(float), 4, 5):
            got += grow_grove(seed, int(cal["grove_median"] * 1.5), True)
            if got >= cal["near_start"]["min_living"]:
                break

    living_w = (moist & ~occupied).astype(float)
    dry_w = (~moist & ~occupied).astype(float)
    placed_living = sum(1 for e in ents)
    for size in cluster_sizes(rng, max(0, living_target - placed_living), cal["grove_median"], cal["grove_cap"]):
        seeds = poisson_seeds(rng, living_w * ~occupied, 1, 1)
        if not seeds:
            break
        grow_grove(seeds[0], size, True)
    for size in cluster_sizes(rng, max(0, total - len(ents)), cal["grove_median"], cal["grove_cap"]):
        seeds = poisson_seeds(rng, dry_w * ~occupied, 1, 1)
        if not seeds:
            break
        grow_grove(seeds[0], size, False)
    return ents, occupied


def place_bushes(rng, surface, free, moist, near_water, cal, start_yx=None):
    """Berry patches beside water. cal keys: bushes_per_10k, patch_median, near_start
    {radius, min_bushes}."""
    Y, X = surface.shape
    total = int(cal["bushes_per_10k"] * X * Y / 1e4)
    ents = []
    occupied = ~free.copy()

    def patch(seed, size):
        mask = ~occupied & moist
        if not mask[seed]:
            return 0
        cells = grow_blob(rng, mask, seed, size, compactness=1.5)
        for y, x in cells:
            ents.append(bush(x, y, int(surface[y, x]), rng=rng))
            occupied[y, x] = True
        return len(cells)

    if start_yx is not None:
        sy, sx = start_yx
        yy, xx = np.mgrid[0:Y, 0:X]
        ring = ((yy - sy) ** 2 + (xx - sx) ** 2 <= cal["near_start"]["radius"] ** 2) & moist & ~occupied
        seeds = poisson_seeds(rng, ring.astype(float) * (1 + near_water), 2, 6)
        for seed in seeds:
            patch(seed, max(cal["near_start"]["min_bushes"] // max(1, len(seeds)), 4))
    w = (moist & ~occupied).astype(float) * (1 + 3 * near_water)
    while len(ents) < total:
        seeds = poisson_seeds(rng, w * ~occupied, 1, 1)
        if not seeds:
            break
        if patch(seeds[0], int(np.clip(rng.lognormal(np.log(cal["patch_median"]), 0.6), 4, 80))) == 0:
            w[seeds[0]] = 0
    return ents, occupied


def touching(mask, y, x):
    Y, X = mask.shape
    return any(0 <= y + dy < Y and 0 <= x + dx < X and mask[y + dy, x + dx] for dy, dx in N8)
