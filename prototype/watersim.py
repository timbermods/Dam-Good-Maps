"""Timberborn 1.1 water, moisture and soil contamination for heightfield maps (one water column
per tile). A port of the game's rules (investigation/notes/water_and_soil.md, "Simplified water
simulation spec"): it reproduced the game's own save of a generated map to 0.001 depth after
975 ticks from empty, and matches Diorama and Waterfalls exactly. It does not model water under
roofs (caves, overhangs, tunnels), which the prototype never generates.

Units: depth in blocks, strength S = S blocks of water per second; 1 tick = 0.6 s = 2 substeps;
1 game day = 768 ticks.
"""
from __future__ import annotations

import heapq
import math

import numpy as np

DT = 0.3                  # seconds per substep
K = 2.25 * DT             # flow factor
SPILL = 0.1               # spill threshold onto dry ground of the same floor
KEEP = 0.999              # flow momentum kept per substep
BAL = 0.8                 # outflow balancing against the reverse flow
TICKS_PER_DAY = 768
# direction k: 0 = -y, 1 = -x, 2 = +y, 3 = +x ; OPP[k] is the reverse direction
DIRS = ((-1, 0), (0, -1), (1, 0), (0, 1))
OPP = (2, 3, 0, 1)


def _shift(a, k, fill):
    """Value of the neighbour in direction k for every tile (fill outside the map)."""
    dy, dx = DIRS[k]
    Y, X = a.shape
    p = np.pad(a, 1, constant_values=fill)
    return p[1 + dy:1 + dy + Y, 1 + dx:1 + dx + X]      # out[y, x] = a[y + dy, x + dx]


class WaterSim:
    def __init__(self, floor: np.ndarray, sources=(), edge_walls=None):
        """floor: terrain surface (first free layer) per tile. sources: list of dicts
        {tiles: [(y, x)], strength: S, contamination: 0 or 1}."""
        self.F = floor.astype(float)
        Y, X = floor.shape
        self.D = np.zeros((Y, X))
        self.Dold = np.zeros((Y, X))
        self.C = np.zeros((Y, X))
        self.out = np.zeros((4, Y, X))
        self.sources = list(sources)
        self.inside = [np.ones((Y, X), bool) for _ in range(4)]    # neighbour k inside the map
        self.inside[0][0, :] = False
        self.inside[1][:, 0] = False
        self.inside[2][-1, :] = False
        self.inside[3][:, -1] = False
        # the map edge drains water, except the padding next to a source cell, which is solid
        self.wall = [np.zeros((Y, X), bool) for _ in range(4)]
        for s in self.sources:
            for (y, x) in s["tiles"]:
                for k in range(4):
                    if not self.inside[k][y, x]:
                        self.wall[k][y, x] = True
        self.ticks = 0

    def _evap_mod(self):
        wet = self.D > 0
        wn = np.zeros(self.D.shape)
        p = np.pad(wet, 1)
        Y, X = wet.shape
        cnt = sum(p[1 + dy:1 + dy + Y, 1 + dx:1 + dx + X].astype(int)
                  for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
        wn = np.where(wet, 1 + cnt, 0)
        best = wn.copy()
        for k in range(4):
            best = np.maximum(best, _shift(wn, k, 0) - 1)
        sat = np.where(wet, np.minimum(8, best), 0)
        mod = np.where(sat == 0, 1.0, 0.0595 * (10 - sat) ** 2 + 0.101 * (10 - sat) + 0.72)
        return mod, sat

    def substep(self, evap_mod, strength_scale=1.0):
        F, D, C = self.F, self.D, self.C
        H = F + D
        f = np.zeros((4,) + D.shape)
        for k in range(4):
            Hn = _shift(H, k, 0.0)            # outside the map: floor 0, no water
            Fn = _shift(F, k, 0.0)
            Dn = _shift(D, k, 0.0)
            e = H - Hn
            e = np.where((Dn == 0) & (Fn == F) & self.inside[k], e - SPILL, e)
            fk = KEEP * self.out[k] + K * e
            blocked = self.wall[k] | (Fn >= H) | (D <= 0)
            f[k] = np.where(blocked, 0.0, np.maximum(fk, 0.0))
        s = f.sum(axis=0)
        scale = np.where(s * DT > D, D / np.maximum(s * DT, 1e-12), 1.0)
        f *= scale
        inflow = np.zeros((4,) + D.shape)
        for k in range(4):
            inflow[k] = np.where(self.inside[k], _shift(f[OPP[k]], k, 0.0), 0.0)
        outsum = f.sum(axis=0)
        insum = inflow.sum(axis=0)
        # contamination moves with the flow as a volume-weighted mix
        cin = sum(inflow[k] * _shift(C, k, 0.0) for k in range(4))
        remaining = np.maximum(D - outsum * DT, 0.0)
        for k in range(4):
            self.out[k] = np.maximum(0.0, f[k] - BAL * inflow[k])
        self.Dold = D.copy()
        evap = np.where(D < 0.02, 1e-3, 1e-4) * evap_mod
        newD = np.maximum(0.0, D + (insum - outsum - evap * (D > 0)) * DT)
        mass = C * remaining + cin * DT
        self.C = np.where(newD > 1e-9, np.clip(mass / np.maximum(newD, 1e-9), 0, 1), 0.0)
        self.D = newD
        # sources add dt*S/N to each of their cells
        for src in self.sources:
            add = DT * src["strength"] * strength_scale / len(src["tiles"])
            for (y, x) in src["tiles"]:
                d0 = self.D[y, x]
                self.C[y, x] = (self.C[y, x] * d0 + src.get("contamination", 0.0) * add) / (d0 + add)
                self.D[y, x] = d0 + add

    def run(self, ticks, strength_scale=1.0):
        for _ in range(ticks):
            mod, _ = self._evap_mod()
            self.substep(mod, strength_scale)
            self.substep(mod, strength_scale)
            self.ticks += 1
        return self

    def settle(self, max_days=4.0, tol=0.005, check_every=128):
        """Run with sources on until the water stops changing: total volume within 0.2% and 99.5%
        of tiles within `tol` between checks. (A strict max-change test never passes: thin
        sheets at spill thresholds keep flickering by a few hundredths.)"""
        prev = self.D.copy()
        for _ in range(int(max_days * TICKS_PER_DAY / check_every)):
            self.run(check_every)
            dv = abs(self.D.sum() - prev.sum()) / max(self.D.sum(), 1e-9)
            if dv < 0.002 and np.percentile(np.abs(self.D - prev), 99.5) < tol:
                return True
            prev = self.D.copy()
        return False

    def sat(self):
        return self._evap_mod()[1]


# ---------------------------------------------------------------------------------------------
# Soil moisture and contamination (exact steady state of the game's rules on heightfields)

def moisture(floor: np.ndarray, D: np.ndarray, C: np.ndarray, sat: np.ndarray, barrier=None) -> np.ndarray:
    """Steady-state soil moisture per tile. Tiles with clean water get 2*sat; tiles beside water
    get range - 6 * levels above the ceiled water surface; spreading costs 1 per orthogonal tile,
    1.414 per diagonal, and 6 per level climbed. Badwater (C >= 0.53) gives none."""
    Y, X = floor.shape
    z = floor.astype(int)
    wet = D > 0
    rng = np.where(C >= 0.01, np.floor(2 * sat * np.clip(1 - C / 0.53, 0, 1)), 2 * sat)
    surf_ceil = np.ceil(z + D - 1e-9).astype(int)
    M = np.zeros((Y, X))
    fixed = np.zeros((Y, X), bool)
    clean_wet = wet & (C <= 0.01)
    M[clean_wet] = 2 * sat[clean_wet]
    fixed |= clean_wet
    if barrier is not None:
        M[barrier] = 0
        fixed |= barrier
    heap = []
    for y in range(Y):
        for x in range(X):
            if fixed[y, x]:
                if M[y, x] > 0:
                    heapq.heappush(heap, (-M[y, x], y, x))
                continue
            best = 0.0
            for dy, dx in DIRS:
                yy, xx = y + dy, x + dx
                if 0 <= yy < Y and 0 <= xx < X and wet[yy, xx]:
                    v = rng[yy, xx] - 6 * max(0, z[y, x] - surf_ceil[yy, xx])
                    best = max(best, v)
            if best > 0:
                M[y, x] = best
                heapq.heappush(heap, (-best, y, x))
    r2 = math.sqrt(2)
    while heap:
        negm, y, x = heapq.heappop(heap)
        m = -negm
        if m < M[y, x] - 1e-9:
            continue
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not (dy or dx):
                    continue
                yy, xx = y + dy, x + dx
                if not (0 <= yy < Y and 0 <= xx < X) or fixed[yy, xx]:
                    continue
                cost = r2 if dy and dx else 1.0
                climb = max(0, z[yy, xx] - z[y, x] - int(math.ceil(D[y, x] - 1e-9)))
                v = m - cost - 6 * climb
                if v > M[yy, xx] + 1e-9:
                    M[yy, xx] = v
                    heapq.heappush(heap, (-v, yy, xx))
    M = M * np.where(wet, 1 - C, 1.0)
    M[M < 0.01] = 0
    return M


def contamination(floor: np.ndarray, D: np.ndarray, C: np.ndarray, barrier=None) -> np.ndarray:
    """Steady-state soil contamination candidates: only water with C >= 0.5 contaminates; value
    2*(C-0.5) beside it, -1/7 per tile (sqrt2/7 diagonal), -5/7 per level up. Reach ~7 tiles."""
    Y, X = floor.shape
    z = floor.astype(int)
    bad = (D > 0) & (C >= 0.5)
    surf_ceil = np.ceil(z + D - 1e-9).astype(int)
    V = np.zeros((Y, X))
    heap = []
    for y, x in zip(*np.nonzero(bad)):
        V[y, x] = max(V[y, x], 2 * (C[y, x] - 0.5))
        heapq.heappush(heap, (-V[y, x], y, x))
        for dy, dx in DIRS:
            yy, xx = y + dy, x + dx
            if 0 <= yy < Y and 0 <= xx < X and not bad[yy, xx]:
                v = 2 * (C[y, x] - 0.5) - (5 / 7) * max(0, z[yy, xx] - surf_ceil[y, x])
                if v > V[yy, xx]:
                    V[yy, xx] = v
                    heapq.heappush(heap, (-v, yy, xx))
    r2 = math.sqrt(2)
    while heap:
        negv, y, x = heapq.heappop(heap)
        v0 = -negv
        if v0 < V[y, x] - 1e-9:
            continue
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not (dy or dx):
                    continue
                yy, xx = y + dy, x + dx
                if not (0 <= yy < Y and 0 <= xx < X) or (barrier is not None and barrier[yy, xx]):
                    continue
                v = v0 - (r2 if dy and dx else 1) / 7 - (5 / 7) * max(0, z[yy, xx] - z[y, x])
                if v > V[yy, xx] + 1e-9:
                    V[yy, xx] = v
                    heapq.heappush(heap, (-v, yy, xx))
    V[V < 0.001] = 0
    return V


def drought_storage(floor: np.ndarray, D: np.ndarray, days: float, edge_drains=True):
    """Water left after `days` of drought with every source off: water below each basin's spill
    level stays (surfaces are flat, rivers drain off the edge), minus evaporation of ~0.054 per
    day on wide water (more on narrow channels, ignored here: those drain anyway)."""
    from analysis import priority_flood
    spill = priority_flood(floor.astype(float), edge_drains)
    surface = floor + D
    kept = np.clip(np.minimum(surface, spill) - floor, 0, None)
    return np.clip(kept - 0.0535 * days, 0, None)
