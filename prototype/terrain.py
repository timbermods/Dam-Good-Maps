"""River-valley terrain for the prototype generator: a layout first (river path, valley width,
gorge, basin, start bench), then heights shaped around it, with noise only wiggling edges.

All arrays are [y, x]. Heights are the surface layer (first free voxel), 1..22.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


def value_noise(rng, shape, cell, octaves=3):
    """Smooth fBm value noise in [-1, 1] from integer lattices (no trig, reproducible)."""
    Y, X = shape
    out = np.zeros(shape)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        c = max(2, cell // (2 ** o))
        gy, gx = Y // c + 2, X // c + 2
        lattice = rng.random((gy, gx)) * 2 - 1
        yy, xx = np.mgrid[0:Y, 0:X]
        fy, fx = yy / c, xx / c
        iy, ix = fy.astype(int), fx.astype(int)
        ty, tx = fy - iy, fx - ix
        ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
        a = lattice[iy, ix] * (1 - tx) + lattice[iy, ix + 1] * tx
        b = lattice[iy + 1, ix] * (1 - tx) + lattice[iy + 1, ix + 1] * tx
        out += amp * (a * (1 - ty) + b * ty)
        total += amp
        amp *= 0.5
    return out / total


@dataclass
class ValleyLayout:
    width: int
    height: int
    centre: np.ndarray        # river centreline y for each x
    half_width: np.ndarray    # valley floor half-width for each x (narrow at the gorge)
    bed: np.ndarray           # river bed surface for each x (steps down downstream)
    gorge_x: int              # dam site: narrowest point, just downstream of the basin
    basin_x: tuple            # (x0, x1) of the wide basin upstream of the gorge
    falls_x: int              # where the bed drops by 2 (waterfall)
    cascade_x: int = 0        # where the upper reach drops by 2 into the basin


def plan_valley(rng, W, H, bed_top=8, meander=0.16):
    """Macro layout of a west-to-east river valley."""
    xs = np.arange(W)
    ph1, ph2 = rng.random() * 2 * math.pi, rng.random() * 2 * math.pi
    l1, l2 = W * rng.uniform(0.7, 1.1), W * rng.uniform(0.3, 0.45)
    centre = (H / 2 + H * meander * np.sin(2 * math.pi * xs / l1 + ph1)
              + H * meander * 0.35 * np.sin(2 * math.pi * xs / l2 + ph2))

    # the gorge sits in the middle third, the basin just upstream, the falls downstream
    gorge_x = int(W * rng.uniform(0.42, 0.58))
    basin_len = int(W * rng.uniform(0.14, 0.2))
    basin_x = (max(4, gorge_x - basin_len - 2), gorge_x - 3)
    falls_x = int(min(W - 8, gorge_x + W * rng.uniform(0.16, 0.24)))

    base_half = H * 0.2
    half = np.full(W, base_half)
    for x in range(W):
        if basin_x[0] <= x <= basin_x[1]:          # the valley widens into a bowl
            t = (x - basin_x[0]) / max(1, basin_x[1] - basin_x[0])
            half[x] = base_half * (1 + 0.45 * math.sin(math.pi * t))

    # the river steps down along its course: an upper reach, a 2-step cascade into the basin,
    # the basin and gorge, then 2-step falls. The upper reach being higher is what lets a dam at
    # the gorge hold water: otherwise the reservoir backs up to the map edge and drains away.
    bed = np.full(W, bed_top, dtype=int)
    cascade_x = max(3, basin_x[0] - 2)
    bed[:cascade_x] += 2
    bed[falls_x:] -= 2
    return ValleyLayout(W, H, centre, half, bed, gorge_x, basin_x, falls_x, cascade_x)


def shape_terrain(rng, lay: ValleyLayout, terrace_width=(9, 16), cliff_chance=0.18, max_h=18):
    """Heights around the layout. The valley floor is the river's floodplain (bed + 1) and steps
    down with the bed at the falls; the terraces outside it keep absolute levels, rising with
    distance from the valley floor; a rock ridge crosses the valley at the gorge and the river
    cuts one narrow channel through it. Noise only wiggles the terrace edges."""
    W, H = lay.width, lay.height
    yy, xx = np.mgrid[0:H, 0:W]
    wobble = value_noise(rng, (H, W), 24) * 4.0 + value_noise(rng, (H, W), 8) * 1.2
    d = np.abs(yy - lay.centre[xx])
    dn = d + wobble * 0.8                              # noisy distance for terrace edges
    half = lay.half_width[xx]
    bed = lay.bed[xx]
    floor_top = int(lay.bed[lay.gorge_x]) + 1          # basin floodplain level

    river_half = 2.2
    h = np.where(d < river_half, bed, bed + 1).astype(int)          # channel, then floodplain

    # terraces: random widths, mostly 1-voxel steps, some 2-3 voxel cliffs
    out = dn - half
    lift = np.zeros((H, W), dtype=int)
    edge = 0.0
    while edge < H:
        edge += rng.uniform(*terrace_width)
        rise = 1 if rng.random() > cliff_chance else int(rng.choice([2, 3], p=[0.7, 0.3]))
        lift += np.where(out > edge - terrace_width[0], rise, 0)
    h = np.where(out > 0, np.maximum(h, floor_top + lift), h)

    # the gorge: a ridge across the valley, cut by the channel. It runs well past the valley
    # floor into the terraces, so a dam across the gap cannot leak around its ends.
    ridge = (np.abs(xx - lay.gorge_x + wobble * 0.3) <= 2.5) & (d < half + 14) & (d >= river_half + 0.5)
    h = np.where(ridge, np.maximum(h, floor_top + 4), h)
    return np.clip(h, 1, max_h)


def flatten_pad(h, cy, cx, radius, level):
    """Level a round pad (the start bench) so the district center and its first buildings
    stand on one flat height."""
    H, W = h.shape
    yy, xx = np.mgrid[0:H, 0:W]
    pad = (yy - cy) ** 2 + (xx - cx) ** 2 <= radius * radius
    h[pad] = level
    return pad
