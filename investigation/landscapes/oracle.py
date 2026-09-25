"""Check curated files with the unchanged Python validator and compare every verdict."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent.parent / "prototype"))
from validate import validate

parser = argparse.ArgumentParser()
parser.add_argument("--shard", type=int, default=0)
parser.add_argument("--shards", type=int, default=1)
args = parser.parse_args()
items = json.loads((ROOT / "library/index.json").read_text())["items"]
results = []
for number, item in enumerate(items):
    if number % args.shards != args.shard:
        continue
    output = ROOT / ".work/oracle" / (item["id"] + ".python.json")
    fixture_bytes = (ROOT / "library" / item["fixture"]).read_bytes()
    fixture_sha = hashlib.sha256(fixture_bytes).hexdigest()
    if output.exists():
        cached = json.loads(output.read_text())
        if cached.get("fixtureSha256") == fixture_sha:
            results.append(cached)
            continue
    fixture = json.loads(gzip.decompress(fixture_bytes))
    report = validate(str(ROOT / ".work/oracle" / (item["id"] + ".timber")))
    expected = {c["id"]: c for c in fixture["validation"]["checks"]}
    actual = {c.id: c for c in report.checks}
    mismatches = []
    for key in sorted(set(expected) | set(actual)):
        a, b = expected.get(key), actual.get(key)
        if a is None or b is None or (a["ok"], a["applicable"], a["advisory"]) != (bool(b.ok), not bool(b.na), bool(b.advisory)):
            mismatches.append(key)
    row = {"id": item["id"], "fixtureSha256": fixture_sha, "pythonPassed": bool(report.passed), "verdictMismatches": mismatches,
           "checks": [{"id": c.id, "ok": bool(c.ok), "advisory": bool(c.advisory), "applicable": not bool(c.na)} for c in report.checks]}
    output.write_text(json.dumps(row), encoding="utf-8")
    results.append(row)
    print(f"oracle {number + 1}/{len(items)} {item['id']} pass={report.passed} mismatches={mismatches}", flush=True)
bad = [r for r in results if not r["pythonPassed"] or r["verdictMismatches"]]
print(json.dumps({"shard": args.shard, "checked": len(results), "failed": len(bad)}), flush=True)
sys.exit(1 if bad else 0)
