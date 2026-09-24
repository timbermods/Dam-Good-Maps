"""Summarize the map-relevant blueprints (map editor objects, ruins, water, natural resources,
district centers) into notes/blueprints_summary.json: size, block layers, and the non-block specs.
Blocks are listed z-major then y then x (verified against StartingLocation: first 9 blocks are the
3x3 ground layer)."""
import json, glob, os
BP = os.path.join(os.path.dirname(__file__), "raw", "blueprints")
out = {}
paths = glob.glob(f"{BP}/MapEditor/**/*.blueprint.json", recursive=True) + \
        glob.glob(f"{BP}/NaturalResources/Trees/**/*.blueprint.json", recursive=True) + \
        glob.glob(f"{BP}/NaturalResources/Bushes/**/*.blueprint.json", recursive=True) + \
        glob.glob(f"{BP}/Buildings/DistrictManagement/DistrictCenter/*.blueprint.json")
def abbreviate(b):
    return f'{b.get("MatterBelow","?")}|{b.get("Occupations","?")}|{b.get("Stackable","?")}' + ("|U" if b.get("Underground") else "") + ("|OAB" if b.get("OccupyAllBelow") else "")
for p in sorted(paths):
    d = json.load(open(p, encoding="utf-8-sig"))
    name = d.get("TemplateSpec", {}).get("TemplateName") or os.path.basename(p).split(".blueprint")[0]
    bos = d.get("BlockObjectSpec", {})
    size = bos.get("Size", {})
    blocks = bos.get("Blocks", [])
    X, Y, Z = size.get("X", 1), size.get("Y", 1), size.get("Z", 1)
    layers = []
    for z in range(Z):
        layer = blocks[z*X*Y:(z+1)*X*Y]
        kinds = sorted(set(abbreviate(b) for b in layer))
        layers.append({"z": z, "kinds": kinds})
    specs = {k: v for k, v in d.items() if k not in ("BlockObjectSpec",)}
    other = {k: v for k, v in bos.items() if k not in ("Size", "Blocks")}
    out[name] = {"file": os.path.relpath(p, BP).replace("\\", "/"), "size": [X, Y, Z], "blockObject": other,
                 "layers": layers, "specs": specs}
os.makedirs(os.path.join(os.path.dirname(__file__), "notes"), exist_ok=True)
json.dump(out, open(os.path.join(os.path.dirname(__file__), "notes", "blueprints_summary.json"), "w"), indent=1)
for n, v in out.items():
    print(f'{n:28s} size={v["size"]} specs={list(v["specs"].keys())}')
