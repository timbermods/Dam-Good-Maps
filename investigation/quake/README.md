# Quake

From the repository root:

```sh
npm --prefix investigation/quake run demo
```

The launcher installs its own dependencies if needed and prints a free local port.

Drag a fault, then click the side to move. Click then Shift-click makes a straight fault.
Choose Lift or Slide, Power, and Sheer or Stepped. Try another keeps the same stroke and changes its personality.

Esc or Undo reverts the whole event, including water. Right-drag orbits, middle-drag pans, scroll zooms, and WASD moves the camera.
Saved quakes replay their exact results. **View & saved quakes → Capture view** saves a local JPEG and browser timing measurements in the gitignored `local/` folder.

See [REPORT.md](REPORT.md) for captures and checks, and [INTEGRATION.md](INTEGRATION.md) for the proposed shared forces core.
