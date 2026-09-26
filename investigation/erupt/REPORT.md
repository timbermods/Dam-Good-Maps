# Erupt

Work in progress: a standalone force study, based on dev f770936. Run `npm --prefix investigation/erupt run demo`; it installs its own dependencies on first use and prints a free localhost port.

Step 1: adapted Craterize's sliced plan, exact operation history, clean rendering and demo scaffold. Read Carve's geology and moving-force engine, and Quake's curved-path and object movement policy. Added coherent vent/fissure anatomy, immutable terrain snapshots and local lava strata. No production files change.

Decisions: heights 0–22; no source creation; existing source footprints and the start retain their ground. Objects ride supporting terraces. Auto summit uses power: small peak, medium crater, huge caldera. Rerolls keep the original landscape and advance a recorded seed. Broad shields spread the same force over more land. All documentation and captures stay here, overriding the repository's general instruction to update living docs and docs/sheets.
