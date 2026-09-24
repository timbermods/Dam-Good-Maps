"""Batch run: generate N seeds, report first-attempt and final pass rates and which checks fail.

    python prototype/batch.py --seeds 20 --size 96 [--difficulty normal]
"""
import argparse
import collections
import json
import os
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from generate import generate  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, default=20)
    ap.add_argument("--start", type=int, default=1000)
    ap.add_argument("--size", type=int, default=96)
    ap.add_argument("--difficulty", default="normal")
    a = ap.parse_args()
    first, final, attempts, reasons = 0, 0, [], collections.Counter()
    t0 = time.time()
    for s in range(a.start, a.start + a.seeds):
        log = []
        m, info, rep, path = generate(s, a.size, a.size, a.difficulty, attempts=6,
                                      out_path=os.path.join(tempfile.gettempdir(), f"dgm_batch_{s}.timber"),
                                      log=log.append)
        n = len(log)
        attempts.append(n)
        first += log[0].endswith("PASS")
        final += rep.passed
        for line in log:
            if "FAIL:" in line:
                for c in line.split("FAIL:")[1].split(","):
                    reasons[c.strip()] += 1
        print(f"seed {s}: {'PASS' if rep.passed else 'FAIL'} after {n} attempt(s)", flush=True)
    out = {"size": a.size, "difficulty": a.difficulty, "seeds": a.seeds,
           "first_attempt_pass_rate": round(first / a.seeds, 2), "final_pass_rate": round(final / a.seeds, 2),
           "mean_attempts": round(sum(attempts) / len(attempts), 2), "failing_checks": dict(reasons.most_common()),
           "seconds_per_seed": round((time.time() - t0) / a.seeds, 1)}
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
