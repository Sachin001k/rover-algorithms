# Robot Vacuum Visualizer

Browser-based trajectory playback and metrics dashboard for the robot vacuum simulator.

## Usage

Open `index.html` directly in a web browser (no server required):

```bash
open index.html    # macOS
# or on Linux/Windows: double-click the file or right-click → Open With Browser
```

The visualizer runs entirely in your browser with no external dependencies, using the `file://` protocol.

## Playback Tab

Load a trajectory JSON file (output from `robot_vacuum_interactive --single-algorithm`):

- **Play/Pause/Stop** — Control animation
- **Step Forward/Backward** — Frame-by-frame navigation
- **Scrubber** — Seek to any step
- **Speed Control** — 1–200 steps per second
- **Live Metrics** — Steps, coverage %, overlap ratio, time

The visualizer renders two canvas layers:
1. **Static** — Room obstacles (drawn once at load)
2. **Dynamic** — Cleaned cells and rover position (updated each frame)

## Dashboard Tab

Load a CSV metrics file (from `robot_vacuum_interactive --compare-all` or batch `results.csv`):

Displays bar charts comparing algorithms:
- **Coverage %** — Average coverage reached
- **Total Steps** — Mean steps to completion
- **Overlap Ratio** — Average revisits per step
- **Cleaning Time** — Mean seconds spent cleaning
- **Turns** — Average number of direction changes

The dashboard automatically aggregates data by algorithm (computing means across trials).

## JSON Schema

A trajectory JSON file contains:

```json
{
  "schemaVersion": 1,
  "algorithm": "ZigZag",
  "room": {
    "width": 20,
    "height": 20,
    "complexityLevel": "simple",
    "roomSeed": 42,
    "startX": 0,
    "startY": 0,
    "obstacles": ["00000000...", "00000000...", "..."]
  },
  "config": {
    "cellSizeCm": 20.0,
    "roverSpeedCmPerSec": 30.0,
    "targetCoveragePercent": 90.0,
    "maxSteps": 200000,
    "algorithmSeed": 42000
  },
  "trajectoryFormat": ["x", "y", "dirCode", "revisit"],
  "dirCodes": ["NONE", "UP", "DOWN", "LEFT", "RIGHT"],
  "trajectory": [
    [1, 0, 4, 0],
    [2, 0, 4, 0],
    [3, 0, 4, 0]
  ],
  "summary": {
    "steps": 358,
    "revisits": 20,
    "turns": 42,
    "coveragePercent": 90.2,
    "overlapRatio": 0.0559,
    "travelDistanceCm": 7160.0,
    "cleaningTimeSec": 238.7,
    "reachedTarget": true
  }
}
```

### Obstacle Bitmap

The `obstacles` array stores one binary string per row. Each character is '0' (floor) or '1' (obstacle).

### Trajectory Array

Each trajectory entry is `[x, y, dirCode, revisitFlag]`:
- `x, y` — Rover position after the move
- `dirCode` — Direction of the move (0=NONE, 1=UP, 2=DOWN, 3=LEFT, 4=RIGHT)
- `revisitFlag` — 1 if this cell was already cleaned, 0 if fresh

## Architecture

- **grid-renderer.js** — Canvas rendering for obstacles, cleaned cells, and rover
- **playback.js** — Playback state machine (play/pause/seek/speed)
- **dashboard.js** — CSV parsing and bar chart generation
- **app.js** — Main bootstrapper and event wiring
- **style.css** — Styling (no external dependencies)

All files use classic `<script>` tags (no ES6 modules) to work under `file://` protocol.

## Constraints

- **No external CDN** — All CSS and JS are inline or local (file:// sandbox blocks fetch)
- **No server** — Opens directly in browser from disk
- **Classic scripts only** — ES6 modules blocked under file:// in all browsers
- **No localStorage beyond debugging** — State lives only in the page session

## Performance

- Batched step rendering (multiple steps per frame) keeps playback smooth even on large trajectories (200k+ steps)
- Static canvas layer is drawn once at load; dynamic layer updates only changed cells
- Bar charts use DOM+CSS, not canvas, for better text rendering and browser compatibility
