# Sources and evidence limits

Consulted 2026-09-25. Only public explanations were used for other games and tools. No external source code, map files, presets, textures or meshes were downloaded into this work. All prototype geometry and renders are generated here. M9 reuse is this repository's own code, pinned separately below.

The playbook's DGM algorithms, trait names, thresholds and costs are our proposals. A game's documented feature is evidence for an idea, not proof that our implementation matches its hidden generator. Costs are algorithmic estimates unless REPORT labels them measured.

| Source | Evidence used | Limits |
|---|---|---|
| [Henrik Kniberg, Minecraft terrain generation in a nutshell](https://www.youtube.com/watch?v=CSa5O6knuwI); [Jfokus 2022 session](https://www.jfokus.se/jfokus22/talks/913) | Developer explanation associated with climate-space terrain controls | Public video/session identity checked; browser text did not expose a full transcript or slides. No claim to have audited Minecraft's curves or implementation |
| [Mojang, Caves & Cliffs Part II features](https://www.minecraft.net/en-us/article/caves---cliffs-part-ii-the-features) | Terrain shape decoupled from biome; new terrain and caves | Public feature explanation, not technical source code |
| [Mojang developer Q&A](https://www.minecraft.net/en-us/article/caves---cliffs-update--part-ii-dev-q-a) | Explicit discussion of multinoise, density, carvers, noise caves, aquifers and diagnostic overlays | Supports separating and inspecting stages; does not specify Timberborn support |
| [Microsoft, World Generation Overview](https://learn.microsoft.com/en-us/minecraft/creator/documents/world-generation?view=minecraft-bedrock-stable) | Height, temperature, humidity, erosion and variation in generation | Bedrock documentation; not a Java 1.18 implementation specification |
| [Official Terraria Wiki, Layers](https://terraria.wiki.gg/wiki/Terraria_Layers); [Cavern](https://terraria.wiki.gg/wiki/Cavern) | Named depth regions; Cavern below Underground and above Underworld | Official community documentation of observed gameplay, not a developer algorithm. Search-index text accessible; direct page retrieval returned 403. No specific cave-generation algorithm inferred |
| [Iron Gate, Valheim FAQ](https://www.valheimgame.com/faq/) | Procedural world with different biomes | No claim about hidden noise fields, biome-distance cutoffs or a reused world heightmap. The route graph is our adaptation |
| [Bay 12, 2007 developer log](https://www.bay12games.com/dwarves/dev_2007.html), May 14 | Erosion changes river elevations; swamp placement follows revised elevations | Historical developer account; not a current DF algorithm specification |
| [Bay 12, 2008 developer log](https://bay12games.com/dwarves/dev_2008.html) | Mountain-side movement and changing levels; path/river crossings | Historical design discussion. DGM's shelf graph is a proposal |
| [Factorio FFF 282](https://www.factorio.com/blog/post/fff-282) | Starting plateau and lake to supply usable land and water | DGM borrows the guarantee, not the stamped starting terrain |
| [Factorio FFF 390](https://www.factorio.com/blog/post/fff-390) | Composable noise expressions and spatial transformations for starting areas | Useful process architecture; no expression or code copied |
| [Bob Thomas/Sirian, Civilization IV Map Scripts Guide](https://civfanatics.com/civ4/map-scripts-guide/) | Author's own descriptions of Balanced resources, equivalent islands, Mirror/Hub/Ring and start positioning | Primary developer-authored guide hosted by CivFanatics, dated October 6, 2005. Not evidence about Civ VI/VII's private start algorithms |
| [Klei, Launch Upgrade testing announcement](https://forums.kleientertainment.com/forums/topic/108000-launch-upgrade-now-open-for-testing-346893/) | World traits, biome assortments, changes to early/midgame strategies | Developer post, June 27, 2019. We do not import ONI trait names, probabilities or data |
| [Tynan Sylvester, RimWorld GDC 2017](https://www.gdcvault.com/play/1024232/-RimWorld) | Story-generator framing in the published talk abstract | Session abstract read; no claims about internal RimWorld map algorithms |
| [Ludeon, Alpha 16 Wanderlust](https://ludeon.com/blog/2016/12/rimworld-alpha-16-wanderlust-released/) | World-scale context for local play | Historical developer release description, supplementary to the design framing |
| [Hello Games, Worlds Part I](https://www.nomanssky.com/worlds-part-I-update/) | Terrain/world variety and unusual formations | Visible feature goals, not a density-function recipe or a gravity model to adopt |
| [Sean Murray, Building Worlds Using Math(s), GDC 2017](https://www.gdcvault.com/play/1024514/Building-Worlds-Using) | Published abstract: realistic/alien terrain and small-team generation/testing | Abstract only; no assertion that we watched the talk or reproduced its algorithms |
| [Gaea Erosion](https://docs.gaea.app/reference/nodes/simulate/erosion), [Terraces](https://docs.gaea.app/reference/nodes/surface/terraces), [FractalTerraces](https://docs.gaea.app/reference/nodes/surface/fractalterraces) | Feature scale, hydraulic erosion, terrace spacing/uniformity and determinism caveat | Product documentation; not source code. No node preset or graph copied |
| [World Machine Erosion](https://help.world-machine.com/topic/device-erosion/), [Strata](https://help.world-machine.com/topic/device-strata/) | Hardness and flow/wear/deposition masks; strata controls and erosion cost | Device documentation; no macros or example worlds used |
| [Barnes, Lehman & Mulla, Priority-Flood](https://arxiv.org/abs/1511.04463) | Depression filling and watershed labeling | Establishes geomorphic routing, not Timberborn's water solver |
| [Peytavie et al., Procedural Riverscapes](https://www.cs.purdue.edu/cgvlab/www/resources/papers/Peytavie-Computer_Graphics_Forum-2019-Procedural_Riverscapes.pdf) | Slope, drainage area and stream-power analysis for river geometry | Research method, not a portable solution to discrete game hydraulics |
| [The Right Variety: Improving Expressive Range Analysis with Metric Selection Methods](https://arxiv.org/abs/2304.02366) | Metric choice can change what diversity analysis reveals | Motivates measuring useful play axes rather than trusting picture variety |
| [Level Generation with Constrained Expressive Range](https://www.pcgworkshop.com/archive/bazzaz2025constrained.pdf) | Constrained generation and analyzing output distributions | Supports a future search/coverage approach; no solver imported |

## Repository inputs

- Base: `dev` at `948f395137a6725d4b726864a47e6966d7f2f09a`.
- Read `CLAUDE.md`, `PLAN.md` Product principles/D108–D112 and start rules, `FORMAT.md`, and `investigation/notes/blocks_and_placement.md`.
- Read [M9 design](https://github.com/timbermods/dam-good-maps/blob/a5f189d3e96affec533415090bdb8f09d606c8fd/docs/m9-design.md) from the repository's `investigation/generative` branch, at `a5f189d3e96affec533415090bdb8f09d606c8fd`. No merge or PR review occurred.
- Prototype imports the pinned repository modules `genome.ts`, `field.ts`, `erode.ts`, `levels.ts` and their numerical dependencies through a local, ignored extraction. The imported incision method is already M9's implementation; this study does not claim to invent it.
- No workshop or official Timberborn map data was used as a template, calibration input or comparison input in these experiments.
