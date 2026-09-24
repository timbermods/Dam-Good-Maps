"""Top-down previews of a TimberMap: elevation shading, water, entities. Used for the map
thumbnail inside the .timber file and for PNG previews next to generated maps."""
from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageDraw

from tbmap import TimberMap, placement

GROUND_LOW = np.array([122, 150, 84], float)     # grass at the valley floor
GROUND_HIGH = np.array([196, 178, 140], float)   # dry rock on the heights
WATER = np.array([64, 128, 200], float)
BADWATER = np.array([150, 90, 40], float)

MARKERS = {
    "Pine": (28, 84, 40), "Birch": (120, 170, 70), "Oak": (60, 110, 30), "Succulent": (150, 170, 90),
    "BlueberryBush": (110, 60, 160), "StartingLocation": (255, 255, 255), "Slope": (230, 210, 120),
    "WaterSource": (20, 60, 255), "BadwaterSource": (200, 60, 0),
}


def shaded(m: TimberMap, water: np.ndarray | None = None, badwater: np.ndarray | None = None) -> np.ndarray:
    h = m.surface().astype(float)
    lo, hi = h.min(), max(h.max(), h.min() + 1)
    t = ((h - lo) / (hi - lo))[..., None]
    rgb = GROUND_LOW * (1 - t) + GROUND_HIGH * t
    # hillshade from the north-west so terraces read as steps
    gy, gx = np.gradient(h)
    light = np.clip(1.0 - 0.18 * (gx + gy), 0.55, 1.25)[..., None]
    rgb = rgb * light
    if water is not None:
        depth = np.clip(water, 0, 3)[..., None] / 3.0
        rgb = np.where(water[..., None] > 0.05, rgb * (1 - 0.35 - 0.4 * depth) + WATER * (0.35 + 0.4 * depth), rgb)
    if badwater is not None:
        rgb = np.where(badwater[..., None] > 0.05, rgb * 0.4 + BADWATER * 0.6, rgb)
    return np.clip(rgb, 0, 255).astype(np.uint8)


def render(m: TimberMap, scale: int = 4, water=None, badwater=None, entities=True) -> Image.Image:
    rgb = shaded(m, water, badwater)[::-1]           # y grows north in the game; images grow down
    img = Image.fromarray(rgb, "RGB").resize((m.size_x * scale, m.size_y * scale), Image.NEAREST)
    if entities:
        d = ImageDraw.Draw(img)
        H = m.size_y
        for e in m.entities:
            p = placement(e)
            color = MARKERS.get(p.template)
            if p.template.startswith("RuinColumnH"):
                n = int(p.template[11:])
                color = (90 + 18 * n, 90, 90 + 10 * n)
            if color is None:
                continue
            x0, y0 = p.x * scale, (H - 1 - p.y) * scale
            if p.template == "StartingLocation":
                d.rectangle([x0 - scale, y0 - scale, x0 + 2 * scale, y0 + 2 * scale], outline=(255, 255, 255), width=2)
            elif p.template in ("WaterSource", "BadwaterSource"):
                d.ellipse([x0 - scale, y0 - scale, x0 + 2 * scale, y0 + 2 * scale], fill=color)
            else:
                pad = max(1, scale // 4)
                d.rectangle([x0 + pad, y0 + pad, x0 + scale - pad, y0 + scale - pad], fill=color)
    return img


THUMB_W, THUMB_H = 960, 540                      # every official and workshop thumbnail


def render_thumbnail(m: TimberMap, water=None) -> bytes:
    img = render(m, scale=max(1, THUMB_H // max(m.size_x, m.size_y)), water=water, entities=False)
    fit = min(THUMB_W / img.width, THUMB_H / img.height)
    img = img.resize((max(1, int(img.width * fit)), max(1, int(img.height * fit))), Image.BILINEAR)
    canvas = Image.new("RGB", (THUMB_W, THUMB_H), (38, 44, 36))
    canvas.paste(img, ((THUMB_W - img.width) // 2, (THUMB_H - img.height) // 2))
    buf = io.BytesIO()
    canvas.save(buf, "JPEG", quality=88)
    return buf.getvalue()
