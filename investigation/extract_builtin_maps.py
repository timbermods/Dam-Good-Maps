"""Carve built-in .timber maps (zip archives stored as BinaryData assets) out of resources.assets.

Read-only on the game install: reads resources.assets, writes zips to investigation/raw/builtin/.
Each BinaryData asset is serialized as: m_Name (int32 len + utf8, 4-byte aligned) ... then an int32
byte count followed by the zip bytes. We find zip local-file headers, walk to the end-of-central-
directory record, and name each zip from the nearest preceding length-prefixed string.
"""
import mmap, os, re, struct, sys, zipfile, io

SRC = r"C:\Program Files (x86)\Steam\steamapps\common\Timberborn\Timberborn_Data\resources.assets"
OUT = os.path.join(os.path.dirname(__file__), "raw", "builtin")
os.makedirs(OUT, exist_ok=True)

with open(SRC, "rb") as f:
    mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    pos = 0
    found = 0
    while True:
        i = mm.find(b"PK\x03\x04", pos)
        if i < 0:
            break
        # the byte-array length prefix sits right before the zip
        (n,) = struct.unpack_from("<i", mm, i - 4)
        if not (100 < n < 200_000_000) or i + n > len(mm):
            pos = i + 4
            continue
        blob = mm[i:i + n]
        if blob[-22:-18] != b"PK\x05\x06" and b"PK\x05\x06" not in blob[-65557:]:
            pos = i + 4
            continue
        try:
            z = zipfile.ZipFile(io.BytesIO(blob))
            names = z.namelist()
        except Exception:
            pos = i + 4
            continue
        if not any(nm.endswith("world.json") for nm in names):
            pos = i + n
            continue
        # asset name: search backwards for a length-prefixed printable string
        name = None
        window = mm[max(0, i - 4096):i - 4]
        for m in re.finditer(rb"[\x01-\x7f]\x00\x00\x00", window):
            L = window[m.start()]
            s = window[m.end():m.end() + L]
            if len(s) == L and re.fullmatch(rb"[A-Za-z0-9 _\-.()']+", s or b"-"):
                name = s.decode()
        name = f"builtin_{found:02d}"
        path = os.path.join(OUT, name + ".timber")
        with open(path, "wb") as o:
            o.write(blob)
        print(f"{name}: {n} bytes at {i}, entries={names}")
        found += 1
        pos = i + n
    print("found", found)
