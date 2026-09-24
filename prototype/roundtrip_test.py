"""Round trip every voxel-format map: read -> write -> read, and check that

1. world.json re-serializes byte for byte (read + to_world_json reproduces the original text),
2. a written .timber reads back with identical terrain, entities, singletons and metadata,
3. terrain edits survive (a column raised by one voxel reads back raised).

Maps come from investigation/raw (official, workshop, user maps and saves copied from the game;
see investigation/REPORT.md) and ./out. Pre-0.7 heightmap maps are reported as skipped.

    python prototype/roundtrip_test.py [extra .timber files...]
"""
import glob
import json
import os
import sys
import tempfile
import zipfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tbmap import FormatError, TimberMap  # noqa: E402

ROOT = os.path.dirname(HERE)
DEFAULT_GLOBS = ["investigation/raw/builtin/*.timber", "investigation/raw/workshop/*.timber",
                 "investigation/raw/user/*.timber", "investigation/raw/saves/*.timber", "out/*.timber"]


def check(path: str) -> str:
    original = zipfile.ZipFile(path).read("world.json").decode("utf-8-sig")
    try:
        m = TimberMap.read(path)
    except FormatError as e:
        return f"SKIP  {e}"
    if m.to_world_json() != original:
        a, b = original, m.to_world_json()
        i = next((k for k in range(min(len(a), len(b))) if a[k] != b[k]), min(len(a), len(b)))
        return f"FAIL  world.json differs at {i}: {a[i-40:i+40]!r} vs {b[i-40:i+40]!r}"

    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "rt.timber")
        m.write(out)
        m2 = TimberMap.read(out)
        if not np.array_equal(m.voxels, m2.voxels):
            return "FAIL  terrain changed after write"
        if json.dumps(m.entities) != json.dumps(m2.entities):
            return "FAIL  entities changed after write"
        if json.dumps(m.world()["Singletons"]) != json.dumps(m2.world()["Singletons"]):
            return "FAIL  singletons changed after write"
        if m.metadata != m2.metadata or m.thumbnail != m2.thumbnail:
            return "FAIL  metadata or thumbnail changed after write"

        # edit: raise the tallest simple column's neighbour by one voxel, if there is room
        top = m2.surface()
        ys, xs = np.nonzero(top < m2.layers)
        if len(xs):
            x, y = xs[len(xs) // 2], ys[len(ys) // 2]
            m2.voxels[top[y, x], y, x] = 1
            m2._raw_voxels = None
            m2.write(out)
            m3 = TimberMap.read(out)
            if m3.surface()[y, x] != top[y, x] + 1:
                return "FAIL  terrain edit did not survive"
    return f"OK    {m.size_x}x{m.size_y}x{m.layers}, {len(m.entities)} entities, {m.game_version}"


def main():
    paths = sys.argv[1:] or sorted(p for g in DEFAULT_GLOBS for p in glob.glob(os.path.join(ROOT, g)))
    failures = 0
    for p in paths:
        result = check(p)
        failures += result.startswith("FAIL")
        print(f"{result[:6]}{os.path.relpath(p, ROOT)}: {result[6:]}")
    print(f"\n{len(paths)} maps, {failures} failures")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
