# DGM Probe: report

*Draft: finished after the first batch.*

## Decisions

Each open choice, what was chosen, and why.

1. **No Harmony.** The mod uses only the game's own services, injected through its dependency
   container, and reads two private fields (the panel stack's list, the camera's zoom constants). It
   needs no other mod, so it can run with every other mod switched off.
2. **Weather through the game's own weather services.** The first cycle comes from the new game's
   settings: a copy of the difficulty's `GameModeSpec` whose ranges have equal ends and whose badtide
   chance is 0 or 1. Each later cycle is set in a `CycleEndedEvent` handler, which the game calls before
   it draws the next cycle (`TemperateWeatherDurationService.Initialize`, `DroughtWeather.Initialize`,
   `BadtideWeather.Initialize`). The game then runs all its own rules, the drought's early source ramp
   included. Changing durations mid-cycle by reflection was rejected: the hazard start event fires on one
   exact day and would be skipped.
3. **Speed 99.** It is the developers' own fastest speed (`SpeedControlPanel`, x99), set through
   `SpeedManager.ChangeSpeed`. A tick is the same at any speed, so the records do not depend on it. The
   mod slows to 7 shortly before a screenshot, so the pause lands within a few ticks of its moment, and
   steps down if frames take over 2.5 s.
4. **Records inside the game's tick.** A tickable singleton samples tiles, takes whole-map snapshots and
   polls plant deaths (every 8 ticks), so a moment is caught at its first tick whatever the speed.
5. **Graphics down in memory only.** Render scale 0.5, no vertical sync and 30 frames a second while time
   runs; put back for screenshots and at the end of each map. The game's graphics settings live in the
   registry and are never written.
6. **Screenshots without the interface.** The game's camera is moved to each pose through
   `CameraService`, then a second camera made from the game's camera prefab (as the save thumbnails are)
   copies it and renders into an image of the pose's size, with the UI layer left out. Our 3D view's
   poses are reproduced exactly: the same target, direction and 40° vertical field of view.
7. **Two keys to start.** The mod acts only when the game is launched with `-dgmprobe` and a job file
   exists. A job file left behind can never take over a normal launch.
8. **Only DGM Probe on during a run.** Kyler's other mods would change the tick (BeaverBuddies), add
   panels, or write their own files. The runner switches them off in the game's settings for the run and
   puts the whole settings key back exactly afterwards (checked value by value). This touches the settings
   only for the length of a run, and leaves them as they were.
9. **No saves.** `Autosaver.Suspend()` blocks the periodic and the exit saves, and the probe returns to the
   menu with `OpenMainMenu` (no exit save). The runner still records every save file before a launch and
   deletes any new one afterwards, in case a crash writes one.
10. **Maps played from the probe's own folder** (`MapFileReference.FromDisk`), never from the player's
    Maps folder.
11. **A normal colony start.** Each map starts with the difficulty's own beavers, so the start check sees
    what a player sees. If they die and the game-over box appears, the probe closes it like any panel that
    pauses the game, and records it.
12. **Consent for every launch** (Kyler, 2026-09-25). A run without a code prints the plan and a one-time
    code tied to that plan; the launch needs it back.
13. **The cycle model from its branch.** `model.ts`, `weather.ts`, `game-water.ts` and `game-soil.ts` are
    taken from `investigation/cycles-exact` at `a9cdb86` into the ignored `.cache/`, their `src/` imports
    pointed at this checkout. The model starts from the file's stored water and soil, as the game does,
    and runs the same forced weather.
14. **D5's plug removed by the probe.** Beavers are not directed, so the probe deletes the three Blockage
    tiles itself (`EntityService.Delete`), as a finished demolition would, and watches the lake.
15. **High terrain maps made from our own maps** (Kyler, 2026-09-25): River Valley 96² and Canyon 128²
    raised 5 levels (terrain up to 21), and a Highlands map with a stepped mesa to level 21 carrying a
    spring, trees and a bush. Their water is re-settled with the project's own export.
16. **Only pending checks.** The batch reads `docs/ingame-log.md` and leaves out checks already played.
