"""Run the first investigation's analyze_maps.py on every workshop and official map, with its water
replaced by our canonical settle (measure.ts stores it in C:\\dgm-workshop\\settled), so older
files' stored water never counts. Per-map results stay local in C:\\dgm-workshop\\analyze_py.

    python investigation/workshop/analyze_py.py            # every measured map not done yet
    python investigation/workshop/analyze_py.py --force
"""
import ctypes
import json
import os
import sys
import time
import traceback

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
INV = os.path.dirname(HERE)
sys.path.insert(0, INV)
import analyze_maps as am  # noqa: E402

ROOT = os.environ.get("DGM_WORKSHOP", r"C:\dgm-workshop")
OUT = os.path.join(ROOT, "analyze_py")
_current = {}


def _settled(m):
    """(depth, contamination, moisture) of the current map from measure.ts's canonical settle."""
    X, Y = m.size_x, m.size_y
    key = _current["key"]
    raw = np.fromfile(os.path.join(ROOT, "settled", f"{key}.f32"), dtype="<f4")
    n = X * Y
    if raw.size != 3 * n:
        raise ValueError(f"settled arrays of {key} have {raw.size} values, expected {3 * n}")
    return raw[:n].reshape(Y, X).astype(float), raw[n:2 * n].reshape(Y, X).astype(float), raw[2 * n:].reshape(Y, X).astype(float)


def canonical_water(m):
    depth, contam, _ = _settled(m)
    return depth, contam, m.surface().astype(int)   # the settle runs on the top surface


def canonical_moisture(m):
    return _settled(m)[2]


am.saved_water = canonical_water
am.saved_moisture = canonical_moisture


def low_priority():
    try:
        BELOW_NORMAL = 0x4000
        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), BELOW_NORMAL)
    except Exception:
        pass


def main():
    low_priority()
    force = "--force" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    measured = os.path.join(ROOT, "measured")
    done = 0
    for name in sorted(os.listdir(measured)):
        key = name[:-5]
        out = os.path.join(OUT, f"{key}.json")
        if not force and os.path.exists(out):
            continue
        with open(os.path.join(measured, name), encoding="utf-8") as f:
            rec = json.load(f)
        path = os.path.join(ROOT, "items", rec["id"], rec["file"]) if rec["source"] == "workshop" else os.path.join(ROOT, "official", rec["file"])
        if rec["source"] == "workshop" and not os.path.exists(path):
            for dp, _, fs in os.walk(os.path.join(ROOT, "items", rec["id"])):
                for fn in fs:
                    if fn.lower().endswith(".timber"):
                        path = os.path.join(dp, fn)
        _current["key"] = key
        t0 = time.time()
        try:
            r = am.analyze(path, rec["source"])
        except Exception as e:
            r = {"name": key, "error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()[-1500:]}
        r["key"] = key
        with open(out, "w", encoding="utf-8") as f:
            json.dump(r, f, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o))
        done += 1
        print(f"{key:24s} {time.time() - t0:6.1f}s {'ERROR ' + r['error'] if 'error' in r else ''}", flush=True)
    print(f"analyzed {done}")


if __name__ == "__main__":
    main()
