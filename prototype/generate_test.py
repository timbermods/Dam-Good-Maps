"""Generate a test map, validate it (retrying with derived seeds), and write it with a preview
and a validation report.

    python prototype/generate_test.py --seed 4242 [--size 96] [--difficulty normal] [--out out]

Writes <out>/<name>.timber (settled water and moisture pre-filled, like official maps),
<out>/<name> (empty water).timber (the same map with empty simulation arrays, for an in-game
A/B check), <out>/<name>.png and <out>/<name>.validation.txt.
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from generate import generate  # noqa: E402
from preview import render  # noqa: E402
from tbmap import TimberMap  # noqa: E402
from validate import validate  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=4242)
    ap.add_argument("--size", type=int, default=96)
    ap.add_argument("--difficulty", default="normal", choices=["easy", "normal", "hard"])
    ap.add_argument("--out", default=os.path.join(os.path.dirname(HERE), "out"))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    name = f"Dam Good Maps - River Valley {a.seed}"
    path = os.path.join(a.out, name + ".timber")
    m, info, rep, _ = generate(a.seed, a.size, a.size, a.difficulty, out_path=path)
    print(f"{'PASS' if rep.passed else 'FAIL'}  {path}")
    print("info:", info)

    # the same map with empty simulation arrays (what the old prototype wrote)
    plain = TimberMap.read(path)
    plain.reset_simulation_state()
    plain_path = os.path.join(a.out, name + " (empty water).timber")
    plain.write(plain_path, thumbnail=m.thumbnail)

    water = {}
    rep = validate(path, a.difficulty, water)
    img = render(m, scale=6, water=water["D"] * (water["C"] < 0.5), badwater=water["D"] * (water["C"] >= 0.5))
    img.save(os.path.join(a.out, name + ".png"))
    with open(os.path.join(a.out, name + ".validation.txt"), "w", encoding="utf-8") as f:
        f.write(f"{'PASS' if rep.passed else 'FAIL'}  {os.path.basename(path)}  (difficulty {a.difficulty})\n")
        for c in rep.checks:
            f.write(f"   {'ok ' if c.ok else 'BAD'} {c.id:22s} {c.detail}\n")
        f.write(f"\ngenerator: {info}\n")
    sys.exit(0 if rep.passed else 1)


if __name__ == "__main__":
    main()
