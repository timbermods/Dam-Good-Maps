"""tbmap: read and write Timberborn .timber map files in the native 1.1 format.

A .timber file is a zip holding world.json, map_metadata.json, version.txt and map_thumbnail.jpg.
world.json is compact JSON: {GameVersion, Timestamp, Singletons, Entities}. Terrain is a voxel
grid stored as "0"/"1" tokens with index z*X*Y + y*X + x (1 = solid). FORMAT.md documents every
field; the notes in investigation/notes/ hold the evidence.

Round trip guarantee: for every voxel-format map, read() then to_world_json() reproduces the
original world.json byte for byte (floats are written the way C# writes them, e.g. 6.8E-05).
"""
from __future__ import annotations

import datetime
import io
import json
import uuid
import zipfile
from dataclasses import dataclass

import numpy as np

# Version the game itself writes today; native 1.1 maps carry it in GameVersion and version.txt.
GAME_VERSION = "1.1.2.4-52e959e-sw"
# Every official 1.1 map has 23 voxel layers; MapSize no longer stores a height in 1.1.
DEFAULT_LAYERS = 23
ORIENTATIONS = ("Cw0", "Cw90", "Cw180", "Cw270")

# Singletons of a new map, in the order official 1.1 maps store them. MapThumbnailCameraMover
# (the editor's thumbnail camera) is optional and left out; the editor then uses its default.
MAP_SINGLETONS = (
    "MapSize", "TerrainMap", "HazardousWeatherHistory", "WaterEvaporationMap",
    "WaterSimulationMigrator", "WaterMapNew", "SoilMoistureSimulator",
    "SoilContaminationSimulator", "NumberedEntityNamerService", "WindService",
)


class FormatError(Exception):
    pass


# --------------------------------------------------------------------------------------------
# JSON in the game's style: compact separators, no BOM, non-ASCII kept, C# float formatting.

def format_float(value: float) -> str:
    text = repr(float(value))
    if "e" in text:  # Python 6.8e-05 -> C# 6.8E-05
        mantissa, exponent = text.split("e")
        sign = "-" if exponent.startswith("-") else "+"
        text = f"{mantissa}E{sign}{exponent.lstrip('+-').zfill(2)}"
    return text


def dumps(obj) -> str:
    parts: list[str] = []
    append = parts.append

    def encode(o):
        if o is None:
            append("null")
        elif o is True:
            append("true")
        elif o is False:
            append("false")
        elif isinstance(o, (int, np.integer)):
            append(str(int(o)))
        elif isinstance(o, (float, np.floating)):
            append(format_float(o))
        elif isinstance(o, str):
            append(json.dumps(o, ensure_ascii=False))
        elif isinstance(o, dict):
            append("{")
            for i, (k, v) in enumerate(o.items()):
                if i:
                    append(",")
                append(json.dumps(k, ensure_ascii=False))
                append(":")
                encode(v)
            append("}")
        elif isinstance(o, (list, tuple)):
            append("[")
            for i, v in enumerate(o):
                if i:
                    append(",")
                encode(v)
            append("]")
        else:
            raise TypeError(f"cannot serialize {type(o).__name__}")

    encode(obj)
    return "".join(parts)


def _num(v: float) -> str:
    """Packed-array number the way the game writes it: whole values as bare integers, other
    values with about 7 significant digits."""
    v = float(v)
    if v == int(v) and 0 <= v <= 16:
        return str(int(v))
    return format_float(float(f"{v:.7g}"))


# --------------------------------------------------------------------------------------------
# Entities

@dataclass
class Placement:
    template: str
    x: int
    y: int
    z: int
    orientation: str = "Cw0"
    flipped: bool = False


def placement(entity: dict) -> Placement:
    bo = entity["Components"].get("BlockObject", {})
    c = bo.get("Coordinates", {"X": 0, "Y": 0, "Z": 0})
    orientation = bo.get("Orientation", "Cw0")
    if isinstance(orientation, dict):          # 0.6 maps: {"Value": "Cw90"}
        orientation = orientation.get("Value", "Cw0")
    flipped = bo.get("Flipped", False)
    if isinstance(flipped, dict):
        flipped = flipped.get("Value", False)
    return Placement(entity["Template"], c["X"], c["Y"], c["Z"], orientation, bool(flipped))


def new_id(rng=None) -> str:
    """A GUID string. With an rng (numpy Generator) the ids are reproducible for a seed."""
    if rng is None:
        return str(uuid.uuid4())
    return str(uuid.UUID(bytes=bytes(rng.integers(0, 256, 16, dtype=np.uint8)), version=4))


def block_object(x, y, z, orientation="Cw0", flipped=False) -> dict:
    bo = {"Coordinates": {"X": int(x), "Y": int(y), "Z": int(z)}}
    if orientation != "Cw0":
        bo["Orientation"] = orientation
    if flipped:
        bo["Flipped"] = True
    return bo


def entity(template, x, y, z, orientation="Cw0", flipped=False, components=None, rng=None) -> dict:
    comps = {"BlockObject": block_object(x, y, z, orientation, flipped)}
    comps.update(components or {})
    return {"Id": new_id(rng), "Template": template, "Components": comps}


def _yield(good, amount):
    return {"Yield": {"Good": good, "Amount": int(amount)}}


# Logs per cut and gatherable goods, from the blueprints (NaturalResources/*).
TREE_LOGS = {"Pine": 2, "Birch": 1, "Oak": 8}
MAP_TREES = ("Pine", "Birch", "Oak")      # the only trees official maps place (plus Succulent)


def tree(species, x, y, z, dead=False, growth=1.0, rng=None) -> dict:
    """A wild tree the way official 1.1 maps store it (component order included)."""
    comps = {"CoordinatesOffsetter": {"Random": True}}
    if dead:
        comps["LivingNaturalResource"] = {"IsDead": True}
    if growth < 1.0:
        comps["Growable"] = {"GrowthProgress": float(growth)}
    if species == "Succulent":
        comps["Yielder:Cuttable"] = _yield("Water", 2)
        comps["DeadCuttableYieldRemover"] = {"IsBlocked": False}
    else:
        comps["Yielder:Cuttable"] = _yield("Log", TREE_LOGS[species])
        if species == "Pine":
            comps["Yielder:Gatherable"] = _yield("PineResin", 0)
    return entity(species, x, y, z, components=comps, rng=rng)


def bush(x, y, z, berries=3, growth=1.0, rng=None) -> dict:
    comps = {"CoordinatesOffsetter": {"Random": True}}
    if growth < 1.0:
        comps["Growable"] = {"GrowthProgress": float(growth)}
    comps["Yielder:Gatherable"] = _yield("Berries", berries if growth >= 1.0 else 0)
    if growth >= 1.0:
        comps["GatherableYieldGrower"] = {"GrowthProgress": 1.0}
    return entity("BlueberryBush", x, y, z, components=comps, rng=rng)


RUIN_SCRAP_PER_LEVEL = 15          # RuinColumnH{n} yields 15*n ScrapMetal
RUIN_VARIANTS = ("A", "B", "C", "D", "E")


def ruin(height, x, y, z, variant="A", orientation="Cw0", rng=None) -> dict:
    comps = {"Yielder:Ruin": _yield("ScrapMetal", RUIN_SCRAP_PER_LEVEL * height),
             "RuinModels": {"VariantId": variant}}
    return entity(f"RuinColumnH{height}", x, y, z, orientation, components=comps, rng=rng)


def time_activated(enabled=False, cycles=5, days=10.0) -> dict:
    return {"IsEnabled": enabled, "CyclesUntilCountdownActivation": int(cycles),
            "DaysUntilActivation": float(days), "DaysPassed": 0.0}


def water_source(x, y, z, strength, bad=False, rng=None) -> dict:
    """WaterSource (1x1) or BadwaterSource (3x3). The field order matches official maps."""
    comps = {"WaterSource": {"SpecifiedStrength": float(strength), "CurrentStrength": float(strength)}}
    ent = entity("BadwaterSource" if bad else "WaterSource", x, y, z, rng=rng)
    ent["Components"] = {**comps, **ent["Components"], "TimeActivatedComponent": time_activated()}
    return ent


def slope(x, y, z, orientation, rng=None) -> dict:
    return entity("Slope", x, y, z, orientation, rng=rng)


def starting_location(x, y, z, orientation="Cw0", rng=None) -> dict:
    return entity("StartingLocation", x, y, z, orientation, rng=rng)


# --------------------------------------------------------------------------------------------
# The map

class TimberMap:
    """A map in memory. `voxels` is a uint8 array [z, y, x] (1 = solid). `entities` are the raw
    entity dicts (unknown templates and components pass through untouched). `singletons` holds
    everything from world.json except the terrain voxels, which are rebuilt from `voxels`."""

    def __init__(self, size_x: int, size_y: int, layers: int = DEFAULT_LAYERS):
        self.size_x, self.size_y, self.layers = size_x, size_y, layers
        self.voxels = np.zeros((layers, size_y, size_x), dtype=np.uint8)
        self.entities: list[dict] = []
        self.singletons: dict = {}
        self.metadata: dict = {
            "Width": size_x, "Height": size_y, "MapNameLocKey": "", "MapDescriptionLocKey": "",
            "MapDescription": "", "IsRecommended": False, "IsUnconventional": False, "IsDev": False,
        }
        self.thumbnail: bytes | None = None
        self.game_version = GAME_VERSION
        self.timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.version_txt = GAME_VERSION + "\r\n"
        self.extra_files: dict[str, bytes] = {}
        self._raw_voxels: str | None = None     # original text, kept only while voxels are unchanged
        self.legacy = False                      # read from a pre-0.7 heightmap map

    # ---- reading ----
    @classmethod
    def read(cls, path, allow_legacy: bool = False) -> "TimberMap":
        """Read a .timber map or save. allow_legacy also reads pre-0.7 heightmap maps (terrain
        converted to voxels) for analysis; those cannot be written back."""
        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            world = json.loads(z.read("world.json").decode("utf-8-sig"))
            m = cls.from_world(world, allow_legacy)
            # saves carry save_metadata.json instead; they keep it as an extra file
            m.metadata = (json.loads(z.read("map_metadata.json").decode("utf-8-sig"))
                          if "map_metadata.json" in names else None)
            if "map_thumbnail.jpg" in names:
                m.thumbnail = z.read("map_thumbnail.jpg")
            if "version.txt" in names:
                m.version_txt = z.read("version.txt").decode("utf-8-sig")
            for n in names:
                if n not in ("world.json", "map_metadata.json", "map_thumbnail.jpg", "version.txt"):
                    m.extra_files[n] = z.read(n)
        return m

    @classmethod
    def from_world(cls, world: dict, allow_legacy: bool = False) -> "TimberMap":
        s = world["Singletons"]
        size = s["MapSize"]["Size"]
        x, y = size["X"], size["Y"]
        terrain = s.get("TerrainMap", {})
        if "Voxels" not in terrain:
            if not (allow_legacy and "Heights" in terrain):
                raise FormatError("not a voxel-format map (pre-0.7 heightmap terrain)")
            # 0.6 maps: Heights[y*X + x] is the surface layer (entity Z on top of the column)
            m = cls(x, y, DEFAULT_LAYERS)
            m.set_heightmap(np.array(terrain["Heights"]["Array"].split(), dtype=np.int32).reshape(y, x))
            m.singletons, m.entities = s, world["Entities"]
            m.game_version, m.timestamp = world.get("GameVersion", ""), world.get("Timestamp", "")
            m.legacy = True
            return m
        raw = terrain["Voxels"]["Array"]
        flat = np.frombuffer(raw.replace(" ", "").encode("ascii"), dtype=np.uint8) - 48
        if len(flat) % (x * y):
            raise FormatError(f"voxel count {len(flat)} is not a multiple of {x}x{y}")
        layers = len(flat) // (x * y)
        m = cls(x, y, layers)
        m.voxels = flat.reshape(layers, y, x).copy()
        m._raw_voxels = raw
        m.singletons = s
        m.entities = world["Entities"]
        m.game_version = world.get("GameVersion", "")
        m.timestamp = world.get("Timestamp", "")
        return m

    # ---- terrain helpers ----
    def set_heightmap(self, heights: np.ndarray):
        """Solid from z=0 up to heights[y, x]-1; heights are the first free layer (entity Z)."""
        h = np.clip(np.asarray(heights, dtype=np.int32), 1, self.layers)
        z = np.arange(self.layers)[:, None, None]
        self.voxels = (z < h[None, :, :]).astype(np.uint8)
        self._raw_voxels = None

    def surface(self) -> np.ndarray:
        """First free layer above the topmost solid voxel of each column (entity Z on top)."""
        solid = self.voxels.astype(bool)
        top = self.layers - np.argmax(solid[::-1], axis=0)
        top[~solid.any(axis=0)] = 0
        return top

    def floors(self) -> np.ndarray:
        """Number of solid-to-air transitions per column; a column solid to the top counts one."""
        a = self.voxels.astype(bool)
        return (a[:-1] & ~a[1:]).sum(axis=0) + a[-1]

    def water_levels(self) -> int:
        return max(1, int(self.floors().max()))

    def is_simple(self) -> bool:
        """True when no column has overhangs or caves (one floor everywhere)."""
        return bool((self.floors() <= 1).all())

    # ---- writing ----
    def _voxel_text(self) -> str:
        if self._raw_voxels is not None:
            return self._raw_voxels
        return " ".join((self.voxels.reshape(-1) + 48).tobytes().decode("ascii"))

    def reset_simulation_state(self):
        """Replace every per-column simulation array with a fresh, empty state sized to the
        terrain: no water, no moisture, no contamination, neutral evaporation. This is what the
        editor writes for a new map; the game fills rivers from the sources after load."""
        levels = self.water_levels()
        n = levels * self.size_x * self.size_y
        zeros = " ".join(["0"] * n)
        self.singletons = {
            "MapSize": {"Size": {"X": self.size_x, "Y": self.size_y}},
            "TerrainMap": {"Voxels": {"Array": None}},
            "HazardousWeatherHistory": {"HistoryData": []},
            "WaterEvaporationMap": {"Levels": levels, "EvaporationModifiers": {"Array": " ".join(["1"] * n)}},
            # without IsMigrated the game halves every water source's strength on load
            "WaterSimulationMigrator": {"IsMigrated": True},
            "WaterMapNew": {"Levels": levels, "WaterColumns": {"Array": zeros},
                            "ColumnOutflows": {"Array": zeros}},
            "SoilMoistureSimulator": {"Size": levels, "MoistureLevels": {"Array": zeros}},
            "SoilContaminationSimulator": {"Size": levels, "ContaminationCandidates": {"Array": zeros},
                                           "ContaminationLevels": {"Array": zeros}},
            "NumberedEntityNamerService": {"NextNumbers": []},
            "WindService": {"WindStrength": 0.0, "WindDirection": {"X": 0.0, "Y": 0.0},
                            "NextWindChangeTime": 0.0},
        }

    def set_simulation_state(self, depth, contamination, moisture=None, soil_contamination=None):
        """Store settled water (and optionally soil moisture/contamination) the way official
        maps ship, so rivers run and trees stand on moist soil from the first tick. Heightfield
        maps only: one water column per tile (slot 0), floor = terrain surface."""
        if not self.is_simple():
            raise FormatError("pre-filled water is only written for maps without caves or overhangs")
        if not self.singletons:
            self.reset_simulation_state()
        floor = self.surface().ravel()
        toks = []
        for d, c, f in zip(np.asarray(depth).ravel(), np.asarray(contamination).ravel(), floor):
            if d <= 1e-6:
                toks.append("0")
            else:
                ds, cs = _num(d), _num(c if c > 1e-6 else 0.0)
                toks.append(f"{ds}:{cs}:0:{int(f)}:{ds}")
        self.singletons["WaterMapNew"]["WaterColumns"] = {"Array": " ".join(toks)}
        if moisture is not None:
            self.singletons["SoilMoistureSimulator"]["MoistureLevels"] = {
                "Array": " ".join(_num(v) for v in np.asarray(moisture).ravel())}
        if soil_contamination is not None:
            arr = " ".join(_num(v) for v in np.asarray(soil_contamination).ravel())
            self.singletons["SoilContaminationSimulator"]["ContaminationCandidates"] = {"Array": arr}
            self.singletons["SoilContaminationSimulator"]["ContaminationLevels"] = {"Array": arr}

    def world(self) -> dict:
        if self.legacy:
            raise FormatError("pre-0.7 heightmap maps are read-only")
        s = dict(self.singletons)
        if not s:
            self.reset_simulation_state()
            s = dict(self.singletons)
        s["MapSize"] = {**s.get("MapSize", {}), "Size": {"X": self.size_x, "Y": self.size_y}}
        s["TerrainMap"] = {**s.get("TerrainMap", {}), "Voxels": {"Array": self._voxel_text()}}
        return {"GameVersion": self.game_version, "Timestamp": self.timestamp,
                "Singletons": s, "Entities": self.entities}

    def to_world_json(self) -> str:
        return dumps(self.world())

    def write(self, path, thumbnail: bytes | None = None):
        """Write a .timber zip in the game's file order. A map gets map_metadata.json and a
        960x540 map_thumbnail.jpg (rendered top-down if none is given); a save read from disk
        keeps its own save_* files."""
        buf = io.BytesIO()
        # entry dates come from the world Timestamp, so the same map always gives the same bytes
        try:
            stamp = datetime.datetime.strptime(self.timestamp, "%Y-%m-%d %H:%M:%S").timetuple()[:6]
        except ValueError:
            stamp = (2026, 1, 1, 0, 0, 0)

        def put(z, name, data):
            info = zipfile.ZipInfo(name, date_time=stamp)
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)

        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            if self.metadata is not None:
                meta = dict(self.metadata)
                meta["Width"], meta["Height"] = self.size_x, self.size_y
                thumb = thumbnail if thumbnail is not None else self.thumbnail
                if thumb is None:
                    from preview import render_thumbnail   # keeps tbmap free of Pillow
                    thumb = render_thumbnail(self)
                put(z, "map_metadata.json", dumps(meta))
                put(z, "map_thumbnail.jpg", thumb)
            for n, data in self.extra_files.items():
                put(z, n, data)
            put(z, "version.txt", self.version_txt)
            put(z, "world.json", self.to_world_json())
        with open(path, "wb") as f:
            f.write(buf.getvalue())


def new_map(size_x: int, size_y: int, layers: int = DEFAULT_LAYERS) -> TimberMap:
    m = TimberMap(size_x, size_y, layers)
    m.version_txt = GAME_VERSION + "\r\n"
    return m
