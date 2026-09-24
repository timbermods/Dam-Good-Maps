"""Contact sheets of the renders, for looking through the maps quickly while building the catalogue:
C:\\dgm-workshop\\sheets\\top-NN.png (12 top-down views each) and 3d-NN.png (6 isometric views each),
labelled with the map's title, size and version. Local only.

    python investigation/workshop/sheets.py [--generated]
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.environ.get("DGM_WORKSHOP", r"C:\dgm-workshop")


def font(size):
    for name in ("arial.ttf", "segoeui.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def cells(keys, labels, suffix, cols, rows, cw, ch, out_prefix, folder):
    os.makedirs(os.path.join(ROOT, "sheets"), exist_ok=True)
    f = font(15)
    per = cols * rows
    for s in range(0, len(keys), per):
        sheet = Image.new("RGB", (cols * cw, rows * (ch + 22)), (250, 248, 242))
        d = ImageDraw.Draw(sheet)
        for k, key in enumerate(keys[s:s + per]):
            p = os.path.join(folder, f"{key}-{suffix}.png")
            if not os.path.exists(p):
                continue
            im = Image.open(p)
            im.thumbnail((cw - 6, ch - 4))
            x = (k % cols) * cw
            y = (k // cols) * (ch + 22)
            sheet.paste(im, (x + 3, y + 22))
            d.text((x + 4, y + 3), labels[key][:62], fill=(20, 20, 20), font=f)
        sheet.save(os.path.join(ROOT, "sheets", f"{out_prefix}-{s // per + 1:02d}.png"))


def recipes_sheet():
    """One map per recipe (128², the first seed that passed): top-down and 3D side by side. Our own
    generated maps, so the sheet may be shared."""
    folder = os.path.join(ROOT, "recipes", "renders")
    runs = json.load(open(os.path.join(ROOT, "recipes-runs.json"), encoding="utf-8"))
    names = json.load(open(os.path.join(ROOT, "recipes-aggregate.json"), encoding="utf-8"))
    picks = []
    for rid in names:
        ok = [r for r in runs if r["recipe"] == rid and r["size"] == 128 and r["passed"]]
        if ok:
            picks.append((rid, names[rid]["name"], f"{rid}-128-{ok[0]['seed']}"))
    f = font(18)
    cw, ch = 380, 300
    sheet = Image.new("RGB", (2 * cw + 3 * (cw + 140), ((len(picks) + 1) // 2) * (ch + 30)), (250, 248, 242))
    d = ImageDraw.Draw(sheet)
    for k, (rid, name, key) in enumerate(picks):
        x0 = (k % 2) * (cw + (cw + 140) + 20)
        y0 = (k // 2) * (ch + 30)
        d.text((x0 + 6, y0 + 4), f"{name} (seed {key.split('-')[-1]}, 128²)", fill=(20, 20, 20), font=f)
        for j, suffix in enumerate(("top", "3d")):
            p = os.path.join(folder, f"{key}-{suffix}.png")
            if not os.path.exists(p):
                continue
            im = Image.open(p)
            im.thumbnail(((cw if suffix == "top" else cw + 140) - 6, ch - 6))
            sheet.paste(im, (x0 + 3 + j * cw, y0 + 28))
    out = os.path.join(ROOT, "sheets", "recipes.png")
    sheet.save(out)
    print(out)


def main():
    if "--recipes" in sys.argv:
        recipes_sheet()
        return
    gen = "--generated" in sys.argv
    if gen:
        folder = os.path.join(ROOT, "generated", "renders")
        keys = sorted(n[:-8] for n in os.listdir(folder) if n.endswith("-top.png"))
        labels = {k: k for k in keys}
        cells(keys, labels, "top", 6, 5, 250, 250, "gen-top", folder)
        return
    meta = json.load(open(os.path.join(ROOT, "meta.json"), encoding="utf-8"))
    measured = os.path.join(ROOT, "measured")
    keys, labels = [], {}
    for n, name in enumerate(sorted(os.listdir(measured))):
        r = json.load(open(os.path.join(measured, name), encoding="utf-8"))
        key = r["key"]
        title = meta.get(r["id"] or "", {}).get("title") or r["file"][:-7]
        keys.append(key)
        labels[key] = f"{len(keys)}. {title} ({r['W']}x{r['H']}, {r['format']})"
    with open(os.path.join(ROOT, "sheets-index.json"), "w", encoding="utf-8") as fh:
        json.dump(labels, fh, indent=1, ensure_ascii=False)
    folder = os.path.join(ROOT, "renders")
    cells(keys, labels, "top", 4, 3, 400, 400, "top", folder)
    cells(keys, labels, "3d", 3, 2, 560, 330, "3d", folder)


if __name__ == "__main__":
    main()
