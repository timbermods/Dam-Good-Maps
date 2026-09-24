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


def main():
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
