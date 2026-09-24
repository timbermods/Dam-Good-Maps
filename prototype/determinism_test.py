"""Same seed and settings -> byte-identical .timber file (world.json, thumbnail and zip).

    python prototype/determinism_test.py [seed ...]
"""
import hashlib
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from generate import build  # noqa: E402


def digest(seed, size=64):
    m, info, _ = build(seed, size, size)
    m.timestamp = "2026-09-24 00:00:00"
    path = os.path.join(tempfile.gettempdir(), f"dgm_det_{seed}_{os.getpid()}.timber")
    m.write(path)
    with open(path, "rb") as f:
        data = f.read()
    os.remove(path)
    return hashlib.sha256(m.to_world_json().encode()).hexdigest(), hashlib.sha256(data).hexdigest()


def main():
    seeds = [int(a) for a in sys.argv[1:]] or [1, 2, 3]
    ok = True
    for s in seeds:
        a, b = digest(s), digest(s)
        same = a == b
        ok &= same
        print(f"{'OK  ' if same else 'FAIL'} seed {s}: world.json {a[0][:12]} file {a[1][:12]}"
              + ("" if same else f" vs {b[0][:12]} {b[1][:12]}"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
