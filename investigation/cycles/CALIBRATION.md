# Spot checks in game

The model's rules and timings now come from the game's code ([FIDELITY.md](FIDELITY.md)), so these are spot checks, not calibration. Each takes a few minutes. None has been run; no game was launched for this study.

Generate **River Valley, seed 2, 128²** and **Lake Basin, seed 2, 128²** with the two-map command in [README](README.md). Start a Normal game (Hard for check 2), build nothing, and pause for each reading. Coordinates are zero-based (x, y), north up; the viewer's tile readout shows them. The game's weather is random: count days from the start of each hazard, not from the model's calendar.

1. **Source slowdown.** River Valley (90, 50) is 0.46 deep before the first drought and dry by the end of its first day.
2. **Evaporation.** Lake Basin (45, 36) is 3.281 deep before the first Hard drought, 3.206 when it starts and 2.827 on its fourth day.
3. **Badtide front.** River Valley (72, 61) is clean before the first badtide and about 50% contaminated after its first day.
4. **Plant timer.** The BlueberryBush at River Valley (18, 87) is the first original plant to die of dry soil in the later Hard drought (cycle 17), on drought day 8.3. A dry BlueberryBush dies 8.1–9.9 days after its soil dries.

A mismatch in check 1 points at the source ramp, in 2 at evaporation, in 3 at contamination transport, and in 4 at soil drying or the dying timers. The random parts (weather, plant delays) differ by run; the deterministic parts should match within a tick or two.
