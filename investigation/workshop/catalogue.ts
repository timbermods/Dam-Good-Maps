// The catalogue of ideas: the creative patterns workshop creators build, each with an abstract
// description, how many maps use it (from the catalogue tags, C:\dgm-workshop\tags.json, made by
// looking at every map), two credited examples (the most subscribed), what the engine can build of
// it today, its playability risks, and whether it reads as whimsical or surprising.
//
//   npx tsx investigation/workshop/catalogue.ts     → C:\dgm-workshop\catalogue-aggregate.json
//
// The descriptions are abstract: a pattern, never a map's layout.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTable } from "./lib/table";
import { ROOT } from "./lib/paths";

export interface Pattern {
  id: string;
  name: string;
  group: "shape" | "layout" | "landmark" | "water" | "play";
  description: string;
  /** What the engine's existing operations and builders can make of it, or what it needs. */
  build: string;
  /** "yes" (operations as they are), "laborious" (possible, better as a builder), "needs" (a new
   *  builder or premise), "later" (outside today's scope: caves, overhangs, water under roofs). */
  buildable: "yes" | "laborious" | "needs" | "later";
  recipe?: string;
  risks: string;
  whimsical: boolean;
}

export const PATTERNS: Pattern[] = [
  { id: "ring-moat", name: "Island in a moat", group: "shape", description: "A central island or plateau ringed by water: a moat, a round lake with an island, or a river that loops round the middle.", build: "A lake with an island (lake `islands`): the moat-island recipe. A flowing ring river needs a loop the river tool refuses.", buildable: "yes", recipe: "moat-island", risks: "The island is its own level region: it needs slopes or player stairs; a ring that cuts the start off from its water.", whimsical: true },
  { id: "spiral", name: "Spiral mountain or quarry", group: "shape", description: "A ramp that winds up a central peak, or down into a pit, one level per step; sometimes a channel spirals with it.", build: "Stacked landforms along a spiral with a pinned slope at every step: the spiral-mountain recipe. Better as a builder (spiral: centre, radius, turns, levels, up or down).", buildable: "laborious", recipe: "spiral-mountain", risks: "Every step needs its slope, or the ramp strands the colony; a peak above 16 levels is out of reach.", whimsical: true },
  { id: "concentric-rings", name: "Concentric rings", group: "shape", description: "Nested rings of terraces or water round a centre, like a target or the Eye of the Sahara.", build: "Nested landforms with terraced edges, or rings of lakes with islands.", buildable: "yes", risks: "Rings of cliffs cut the land into strips no building fits on; each ring needs a way through.", whimsical: true },
  { id: "crater-lake", name: "Crater or caldera lake", group: "shape", description: "A round basin with a raised rim holding a lake, often with an island in the middle and a notch where it spills out.", build: "A ring of landforms and a lake inside it, with an island; the lake tool routes its outlet through the wall: the crater-lake recipe.", buildable: "yes", recipe: "crater-lake", risks: "A rim with no outlet overflows at its lowest point; a crater start floods when its lake rises.", whimsical: true },
  { id: "volcano", name: "Volcano", group: "landmark", description: "A cone rising above the land with a crater at the top, often spilling badwater down its flank.", build: "Cone landforms with a badwater basin at the summit, whose outlet runs down the flank: the volcano recipe. Better with a `cone` landform (radial profile).", buildable: "laborious", recipe: "volcano", risks: "Badwater down the flank must reach the river below the start; a tall cone shades nothing but blocks routes.", whimsical: true },
  { id: "shape-silhouette", name: "Shaped lake or island", group: "shape", description: "A lake, island or range drawn as a recognisable shape: a heart, a star, a spiral, a symbol.", build: "Any outline: lakes and landforms take polygons: the heart-lake recipe.", buildable: "yes", recipe: "heart-lake", risks: "Thin points and narrow necks of a shape become one-tile channels or unreachable tips.", whimsical: true },
  { id: "real-geography", name: "Real geography", group: "layout", description: "A real place in miniature: a continent, a lake district, a mountain range.", build: "Heightmap import (M11) scaled to 0–16, then water and resources placed on it.", buildable: "needs", risks: "Real coastlines leave little flat land; the sea at the map edge drains unless sealed.", whimsical: true },
  { id: "archipelago", name: "Archipelago", group: "layout", description: "Many islands in a sea or lake, crossed by shallow water or bridges.", build: "The Islands theme; a lake's `islands`.", buildable: "yes", risks: "Small islands without trees or water; a sea above the 0.55 water cap.", whimsical: false },
  { id: "lone-island", name: "Lone island", group: "layout", description: "One island in a sea that fills the map to its edges: survival on a single landmass.", build: "An Islands variant with one island; a sea to the edge needs its edge sealed (sources along it) or it drains.", buildable: "needs", risks: "Water share far above today's caps; little land to grow.", whimsical: false },
  { id: "mesa-field", name: "Mesa field", group: "landmark", description: "Many flat-topped columns of different heights standing out of lower ground, some crowned with ruins.", build: "Cliff-edged landforms, ruin fields on the tops: the mesa-field recipe.", buildable: "yes", recipe: "mesa-field", risks: "Mesa tops need stairs: the payoff must be optional, never the start's needs.", whimsical: false },
  { id: "sky-tower", name: "Tower or sky island", group: "landmark", description: "Very tall, narrow landforms or islands raised high above the floor, sometimes with water on top falling off the edge.", build: "A tall mesa with a lake on top whose outlet cascades down: the hanging-lake recipe. True floating islands need overhangs (Later).", buildable: "yes", recipe: "hanging-lake", risks: "The top is out of reach without stairs; water on top needs a spring and an outlet.", whimsical: true },
  { id: "basin-cluster", name: "Cluster of basins", group: "layout", description: "Many round bowls, some wet and some dry, joined by channels or saddles.", build: "Lakes and bowl landforms; the Lake Basin theme's planned Crater lakes premise.", buildable: "yes", risks: "Dry bowls fill in a flood; each bowl needs an outlet or it holds badwater.", whimsical: false },
  { id: "ribbon", name: "Ribbon map", group: "layout", description: "A long thin strip, 3–20 times longer than wide, travelled end to end.", build: "Non-square sizes (48–256 a side); beyond 256 needs a map-resizer mod.", buildable: "yes", risks: "Rivers along a ribbon run along an edge (edges drain); little room for set pieces.", whimsical: true },
  { id: "great-scarp", name: "Great scarp or wall", group: "landmark", description: "One long cliff or wall splitting the map into an upper and a lower world, crossed by a fall or a breach.", build: "A cliff-edged landform across the map and an on-river fall where the river crosses it.", buildable: "yes", risks: "The upper world needs its own slopes or stairs; the river's step must be a planned fall.", whimsical: false },
  { id: "parallel-ridges", name: "Parallel ridges", group: "layout", description: "Ridges and valleys running side by side across the map.", build: "Ridge landforms; the Highlands planner.", buildable: "yes", risks: "Each valley is a corridor: reach from the start is short without slopes over the ridges.", whimsical: false },
  { id: "contour-terraces", name: "Contour terraces", group: "layout", description: "Hillsides stepped like rice terraces, following the contours, with water running down between them.", build: "Terraced edges (bands 6–12 deep); the generator's terraces.", buildable: "yes", risks: "Very narrow terraces hold no buildings.", whimsical: false },
  { id: "meander-loop", name: "Big meanders and oxbows", group: "water", description: "A river that loops back on itself, leaving oxbow lakes and near-islands.", build: "Oxbow lakes beside a river: the oxbow-lake recipe. Loops that nearly close need looser river rules.", buildable: "laborious", recipe: "oxbow-lake", risks: "A near-closed loop floods its neck; a start inside a loop is cut off by water (water never blocks walking, but it slows).", whimsical: false },
  { id: "hairpin", name: "Hairpin canyon", group: "water", description: "A river that doubles back in tight switchbacks inside a canyon.", build: "Needs a switchback river: the river tool refuses hairpin turns.", buildable: "needs", risks: "Adjacent reaches at different levels leak into each other unless the wall between them is thick enough.", whimsical: false },
  { id: "split-island", name: "River that splits round an island", group: "water", description: "A river that divides into two arms round a big island (an eye) or fans out into a delta.", build: "Braided channels in the Delta planner; a single big split needs a fork builder (a river that divides and rejoins).", buildable: "needs", risks: "Unequal arms: one arm dries or takes all the water.", whimsical: false },
  { id: "hub-spokes", name: "Hub and spokes", group: "water", description: "Channels radiating from a central pool or island like a compass rose, often symmetric.", build: "Rivers into a central lake (Lake Basin's inflows); spokes flowing out need a lake with several outlets.", buildable: "needs", risks: "Outflowing spokes split the flow thin; the hub floods the centre.", whimsical: true },
  { id: "dendritic", name: "Branching network", group: "water", description: "A tree of rivers or dry rifts branching across the map, meeting at a trunk.", build: "Tributaries (up to 3 today); more branches and dry rifts need a network planner.", buildable: "laborious", risks: "Many thin streams: each too shallow to pump.", whimsical: false },
  { id: "perched-channel", name: "Perched channel or aqueduct", group: "landmark", description: "Straight water channels raised above the ground on embankments, crossing or bridging, like ruined aqueducts or a highway interchange.", build: "A causeway landform with a drawn river on top; untested.", buildable: "laborious", risks: "An embankment one tile thick leaks through its sides unless its banks are raised; the river's bed never rises downstream.", whimsical: true },
  { id: "landmark-falls", name: "Landmark falls", group: "landmark", description: "Wide or twin waterfalls meant to be seen, often horseshoe-shaped.", build: "Standalone waterfalls: the twin-falls recipe.", buildable: "yes", recipe: "twin-falls", risks: "A wide lip needs flow (about 0.4 per tile for an official look); the plunge pool must drain.", whimsical: false },
  { id: "lake-chain", name: "Chain of lakes", group: "water", description: "Lakes strung together by short channels and falls, each at its own level.", build: "Lakes whose outlets run to other lakes (the lake tool).", buildable: "yes", risks: "A lake without inflow slowly dries; a chain that settles slowly.", whimsical: false },
  { id: "flood-challenge", name: "Flood challenge", group: "play", description: "The map starts flooded (or in a badwater sea) and the colony must drain or tame it.", build: "Needs a challenge validation profile: today start.dry and water.no_flood forbid it.", buildable: "needs", risks: "Unwinnable starts; the canonical settle is not what the player sees on day one.", whimsical: true },
  { id: "buried-water", name: "Buried water", group: "play", description: "Old canals and rivers blocked with rubble, or water hidden underground, for the player to open.", build: "Plugged spillways and Blockage lines (M7); water under roofs is Later.", buildable: "laborious", risks: "A plug that releases a flood onto the start; hidden water the player never finds.", whimsical: true },
  { id: "human-landmark", name: "Human-made landmark", group: "landmark", description: "Ruins of a megadam, a fortress wall, a stepped pyramid, a highway or a temple, built from terrain and ruin columns.", build: "Landforms for walls and stepped pyramids, ruin fields shaped as buildings; best as stamps (M11).", buildable: "laborious", risks: "Walls that cut the map; ruins inside the start's clear zone.", whimsical: true },
  { id: "choose-your-side", name: "Choose your side", group: "play", description: "Two or more distinct regions to expand into, each with its own trade-off.", build: "The second district site (M7) and premises with two expansion zones.", buildable: "yes", risks: "One side is always better: the choice is fake.", whimsical: false },
  { id: "carpet-forest", name: "Carpet forest", group: "play", description: "The whole map under dense forest the colony clears as it grows.", build: "Forest density above today's 200% cap.", buildable: "yes", risks: "Trees on every buildable tile slow the first days; a dead carpet on dry soil.", whimsical: false },
  { id: "cave-living", name: "Caves and tunnels", group: "play", description: "Overhangs, tunnels and caverns: a start under a cliff, water running through the mountain.", build: "Outside today's scope: voxel terrain and water under roofs (Later).", buildable: "later", risks: "Unsupported terrain collapses; water under roofs is not simulated by our model.", whimsical: true },
  { id: "hazard-play", name: "Hazard play", group: "play", description: "Unstable cores, badtide drains and timed sources that reshape the map as cycles pass.", build: "Unstable cores (advanced), badwater settings; timed sources are an Advanced placement.", buildable: "yes", risks: "Cores near dams or the start; timed water the checks cannot see.", whimsical: true },
  { id: "symmetric", name: "Symmetric layout", group: "layout", description: "Mirror or rotational symmetry: a map that looks designed.", build: "The symmetry tool (M10).", buildable: "needs", risks: "One start: symmetry must not duplicate it.", whimsical: true },
  { id: "diorama", name: "Diorama", group: "layout", description: "A tiny map (64² or smaller) packed with vertical detail.", build: "Sizes from 48²; smaller needs the game's 4–47 range.", buildable: "yes", risks: "Density rules for 96²+ misfire on tiny maps.", whimsical: true },
];

const rows = readTable();
const workshop = rows.filter((r) => r.source === "workshop");
const official = rows.filter((r) => r.source === "official");
const subs = (r: (typeof rows)[number]) => (r.meta as { lifetime_subscribers?: number } | null)?.lifetime_subscribers ?? 0;
const out = PATTERNS.map((p) => {
  const w = workshop.filter((r) => r.tags.includes(p.id)).sort((a, b) => subs(b) - subs(a));
  const o = official.filter((r) => r.tags.includes(p.id));
  return {
    ...p,
    workshopMaps: w.length,
    officialMaps: o.length,
    examples: w.slice(0, 2).map((r) => ({ title: r.title, author: r.author, url: r.url })),
    officialExamples: o.map((r) => r.title),
  };
});
writeFileSync(join(ROOT, "catalogue-aggregate.json"), JSON.stringify(out, null, 1));
for (const p of out) console.log(`${p.name.padEnd(34)} ws ${String(p.workshopMaps).padStart(3)} off ${String(p.officialMaps).padStart(2)}  ${p.buildable.padEnd(9)} ${p.examples.map((e) => `${e.title} (${e.author ?? "?"})`).join("; ")}`);
