# Robot Vacuum Simulator: Interactive + Visual Extension

## Project Vision

Transform the existing headless C++ grid-based coverage-path-planning simulator into an **interactive, visual learning tool** where users can:
1. Generate random rooms with configurable size and obstacle complexity
2. Choose and run a single algorithm, recording a step-by-step trajectory
3. Replay the trajectory in a browser-based animator with play/pause/speed controls
4. Compare all 4 algorithms on the same room via a metrics dashboard
5. Download results as JSON (trajectories) or CSV (metrics) for analysis

**Why:** The simulator already validates 4 algorithms; visualization makes the findings accessible to humans and enables experimentation without rebuilding C++.

---

## Architecture Decision: No ROS

**Decision:** Do NOT use ROS (Robot Operating System).

**Rationale:**
- ROS's core value (standardized pub/sub between robot hardware nodes) is unused here — this is pure 2D grid abstraction benchmarking with no sensor simulation, no SLAM, no hardware.
- Wrapping the existing `Algorithm`/`Grid`/`Simulation` classes as ROS nodes would be pure mechanical overhead with zero functional benefit.
- Visualization via RViz (ROS's standard tool) is heavier than a single HTML file that works by double-clicking `file://` locally.
- ROS is most native on Linux; this environment is macOS, adding friction to the build/dev cycle.
- **When ROS becomes valuable:** if the winning algorithm ever deploys to real hardware or Gazebo with sensor feedback, SLAM, and motor control. Until that pivot, ROS solves problems this project doesn't have.

**Implication:** Stick with portable C++17 + plain HTML5/Canvas/CSS. No system dependencies beyond a C++17 compiler + CMake (which already exist).

---

## UI/UX Decisions (User-Confirmed)

- **Visualization method:** Local HTML/Canvas viewer (no server, opens via `file://`, plays back JSON trajectories)
- **User interaction:** Interactive CLI prompts at startup (not command-line flags)
- **Compare-all mode:** Metrics dashboard showing bar charts (coverage %, steps, overlap ratio, time, turns), NOT a side-by-side animated race
- **Existing batch mode:** Preserved as-is (`src/main.cpp` → `robot_vacuum_sim`); new interactive target is a separate binary

---

## Implementation Plan (Phased Delivery)

### Phase 1: Step-Hook + JSON Export (0.5–1 day)
**Goal:** Capture every step of a simulation run, serialize grid + trajectory to JSON.

#### Changes to C++ simulator:

1. **`include/Simulation.h`** — add callback interface
   ```cpp
   #include <functional>
   #include "Direction.h"
   
   struct StepRecord {
       long stepIndex;         // rover.steps AFTER this move (1-based)
       int x, y;               // new rover position
       Direction direction;    // move just taken (never NONE)
       bool wasAlreadyCleaned; // true => this step was a revisit
   };
   using StepCallback = std::function<void(const StepRecord&)>;
   
   class Simulation {
   public:
       static SimulationResult run(Grid grid, int startX, int startY,
                                    Algorithm& algorithm, const SimulationConfig& config,
                                    const StepCallback& onStep = nullptr);  // ← new param, optional
   };
   ```

2. **`src/Simulation.cpp`** — invoke callback
   - One-line addition immediately after `grid.markCleaned(nx, ny);` in the main loop:
   ```cpp
   if (onStep) {
       onStep(StepRecord{rover.steps, nx, ny, dir, wasAlreadyCleaned});
   }
   ```
   - **Risk:** Minimal. The change is purely additive (default parameter); existing call sites in `main.cpp` don't pass the 6th argument, so behavior is unchanged.
   - **Regression check:** After implementation, run the existing `robot_vacuum_sim` and diff its `results/results.csv` before/after — should be identical byte-for-byte.

3. **`include/JsonWriter.h` + `src/JsonWriter.cpp`** (new) — minimal JSON helpers
   ```cpp
   namespace json {
       // Append s to out as a quoted, escaped JSON string literal
       void writeEscapedString(std::ostream& out, const std::string& s);
       
       // Format a double for JSON (fixed notation, handles edge cases)
       std::string formatNumber(double value);
   }
   ```
   - Rationale: No third-party JSON library is available or needed — the output schema is fixed and known ahead of time; hand-written `operator<<` calls are simpler and smaller than a full builder API.

4. **`include/TrajectoryRecorder.h` + `src/TrajectoryRecorder.cpp`** (new) — capture & serialize runs
   ```cpp
   class TrajectoryRecorder {
   public:
       TrajectoryRecorder(const Grid& pristineRoom, int startX, int startY,
                           std::string algorithmName, std::string complexityLevel,
                           unsigned int roomSeed, unsigned int algorithmSeed,
                           const SimulationConfig& config);
       
       void onStep(const StepRecord& record);
       bool writeToFile(const std::string& path, const SimulationResult& result) const;
   
   private:
       const Grid& room_;  // reference to pristine room (unchanged)
       std::vector<StepRecord> steps_;
       // ... metadata fields
   };
   ```
   - `writeToFile()` walks the pristine grid with `isObstacle(x, y)` to serialize the initial obstacle layout; writes the trajectory array as compact `[x, y, dirCode, revisitFlag]` entries.
   - Stores references to the `pristineRoom` (not a copy), since the caller must ensure it stays untouched during `Simulation::run` — this is already the caller's responsibility (see how `main.cpp`'s demo section reuses `Grid demoGrid = baseGrid;`).

#### Testing (Phase 1):
- Run a tiny 5×5 room through one algorithm, inspect the JSON output with `python -m json.tool` or `node`.
- Verify CSV output from `robot_vacuum_sim` is byte-identical.

---

### Phase 2: Interactive CLI — Single Algorithm Mode (0.5–1 day)
**Goal:** Replace batch-only `src/main.cpp` with a new interactive `src/main_interactive.cpp` (separate CMake target).

#### New file: `src/main_interactive.cpp`
- Interactive prompts:
  1. Room size (Small 20×20 / Medium 40×40 / Large 60×60)
  2. Obstacle complexity (Simple / Moderate / Complex)
  3. Room seed (blank = random)
  4. Display generated room via `Grid::printAscii()`
  5. Mode (Run one algorithm / Compare all)
  6. If single: choose algorithm + optional seed
  7. Run simulation with `TrajectoryRecorder`, print one-line summary, write JSON

- Helper functions (anonymous namespace):
  ```cpp
  int promptChoice(const std::string& title, const std::vector<std::string>& options);
  unsigned int promptSeed(const std::string& label, unsigned int defaultSeed);
  std::pair<int,int> roomSizeFor(int choice);
  ComplexityLevel complexityFor(int choice);
  std::unique_ptr<Algorithm> algorithmFor(int choice, unsigned int seed);
  std::string levelName(ComplexityLevel);
  void runSingleAndVisualize(const Grid&, int, int, ComplexityLevel, unsigned int, int, unsigned int, const SimulationConfig&);
  ```

- **Input validation:** Reprompt on non-numeric/out-of-range; exit(1) on EOF (piped input running dry).
- **ASCII preview:** Reuse existing `Grid::printAscii(startX, startY)` to show the generated room before running.

#### CMakeLists.txt changes (additive):
```cmake
add_executable(robot_vacuum_interactive
    src/Grid.cpp src/RoomGenerator.cpp
    src/ZigZagAlgorithm.cpp src/RandomWalkAlgorithm.cpp
    src/ZigZagWallFollowHybrid.cpp src/ZigZagRandomEscapeHybrid.cpp
    src/Simulation.cpp src/Metrics.cpp
    src/JsonWriter.cpp src/TrajectoryRecorder.cpp
    src/main_interactive.cpp
)
```
- **`robot_vacuum_sim` target:** unchanged, still exists, still builds/runs identically.
- Both binaries coexist in `build/`.

#### Testing (Phase 2):
- Run interactively for all 4 algorithms on a couple of room sizes.
- Confirm `./build/robot_vacuum_sim` still produces byte-identical CSV output.
- Spot-check JSON files for correct obstacle bitmap and trajectory array structure.

---

### Phase 3: Compare-All Interactive Mode (0.5 day)
**Goal:** Add a "Compare All" menu option that runs all 4 algorithms on a single room and shows a metrics summary.

#### Changes to `src/main_interactive.cpp`:
- After room + complexity selection, add Mode choice (Run one / Compare all).
- `runCompareAll()` function:
  - Runs `ZigZagAlgorithm` and `ZigZagWallFollowHybrid` once each (deterministic).
  - Runs `RandomWalkAlgorithm` and `ZigZagRandomEscapeHybrid` 3 times each with different seeds (reduced from batch's 5 for interactive speed).
  - Writes results to `results/interactive_compare.csv` using existing `SimulationResult::toCSVRow()`.
  - Prints a small aligned text summary table to stdout (optional but nice; ~15 lines of code).

#### Testing (Phase 3):
- Run compare-all on a medium room; spot-check CSV output and visual table.

---

### Phase 4: Visualizer — Trajectory Playback (1.5–2 days)
**Goal:** Browser-based animator that plays back JSON trajectory files with controls.

#### New files in `visualization/`:
1. **`index.html`** — two tabs (Playback / Dashboard), file-input pickers, canvas + controls

2. **`style.css`** — layout, tab styling, canvas sizing, control bar

3. **`app.js`** — bootstrapping & tab switching
   - Playback tab: `<input type="file" accept=".json">` → read with `FileReader.readAsText` → `JSON.parse` (with error handling) → create `GridRenderer` + `Playback` state machine, wire up controls
   - Dashboard tab: placeholder for now (filled in Phase 5)

4. **`grid-renderer.js`** — `RVSim.GridRenderer` class
   - Two stacked `<canvas>` elements:
     - Static layer: obstacle bitmap (drawn once)
     - Dynamic layer: cleaned-cell overlay + rover position (redrawn each frame)
   - Scaling: `cellPx = min(maxCanvasWidth/width, maxCanvasHeight/height)`, always square cells
   - API: `new GridRenderer(staticCanvas, dynamicCanvas, room)`, `drawStatic()`, `drawCleanedCell(x, y)`, `drawRover(x, y, dirCode)`, `reset()`
   - Rover drawn as a small triangle/arrow oriented by `dirCode` (UP=↑, DOWN=↓, LEFT=←, RIGHT=→)

5. **`playback.js`** — `RVSim.Playback` class (state machine)
   - States: `STOPPED` → `PAUSED` ⇄ `PLAYING`
   - Maintains `currentStepIndex` and an incrementally-built `cleanedSet` (JS `Set` of `"x,y"` keys)
   - Forward-stepping is O(1); backward/scrubbing rebuilds `cleanedSet` by replaying from start (cheap, done only on scrub)
   - Playback tick: uses `setInterval` with `stepsPerTick = max(1, round(speedStepsPerSec / 60))` to batch multiple trajectory entries per render, avoiding 200k animation frames
   - Controls: Play, Pause, Step Forward/Backward, scrubber `<input type="range">` for seeking, speed slider
   - Emits `onFrame(stepIndex, newCells, roverX, roverY, dirCode)` for the renderer to consume

#### Critical constraint: Classic scripts only
- **No ES6 modules** (`import`/`export` are blocked under `file://` just like `fetch()`).
- All scripts are `<script src="...">` (classic), not `<script type="module">`.
- Each script attaches classes/functions to a shared namespace: `window.RVSim = {}`.
- Load order: `grid-renderer.js` → `playback.js` → `app.js` (dependency order).

#### JSON schema (what Phase 1 writes, Phase 4 reads):
```json
{
  "schemaVersion": 1,
  "algorithm": "ZigZag+RandomEscape",
  "room": {
    "width": 40,
    "height": 40,
    "complexityLevel": "moderate",
    "roomSeed": 42,
    "startX": 3,
    "startY": 5,
    "obstacles": ["0001100...", "0000000...", "..."]
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
    [4, 5, 4, 0],
    [5, 5, 4, 0]
  ],
  "summary": {
    "steps": 1234,
    "revisits": 45,
    "turns": 89,
    "coveragePercent": 90.4,
    "overlapRatio": 0.036,
    "travelDistanceCm": 24680.0,
    "cleaningTimeSec": 822.7,
    "reachedTarget": true
  }
}
```

#### Testing (Phase 4):
- Open `index.html` via `file://` in 2+ browsers (Chrome, Safari, Firefox).
- Load a small (20×20) and a large (60×60) trajectory JSON.
- Verify no CORS/module errors, verify all controls work (play/pause/step/scrub/speed).
- Profile performance on the worst-case 60×60 room with a stalled algorithm (many steps) — should remain smooth.

---

### Phase 5: Visualizer — Metrics Dashboard (0.5–1 day)
**Goal:** Parse CSV files (compare-all results or full batch results), render metrics as bar charts.

#### New file: `visualization/dashboard.js` — `RVSim.Dashboard` class
- `parseCsv(text)`: split lines, map header to column indices (robust to reordering)
- `aggregateByAlgorithm(rows, metricKey)`: mean per algorithm
- `renderBarChart(container, dataMap, {label, unit})`: DOM+CSS bars (not canvas)
  - One `<div>` per algorithm, `style.width/height` as a percentage of max
  - Text label + value overlay
  - Why DOM+CSS: no manual text metrics, trivial reflow, far fewer edge-case bugs than hand-rolled canvas charts

#### Updates to `visualization/app.js`:
- Dashboard tab: `<input type="file" accept=".csv">` → `FileReader.readAsText` → `Dashboard.parseCsv` → render 5 bar charts:
  - Coverage %
  - Steps
  - Overlap Ratio
  - Cleaning Time (sec)
  - Turns
- Works for both `results/interactive_compare.csv` (single room, 4–8 rows) and full batch `results/results.csv` (27 rooms × 4 algorithms, hundreds of rows).

#### Testing (Phase 5):
- Load `results/interactive_compare.csv` from Phase 3.
- Load the full `results/results.csv` from a batch run.
- Verify charts render correctly, bar heights scale sensibly.

---

### Phase 6: Polish + Documentation (0.5 day)
**Goal:** Edge cases, architectural notes, setup instructions.

#### Edge case handling:
- Algorithm gives up early (unreachable cells): trajectory array is simply shorter; no special JSON flag needed — visualizer handles it gracefully.
- `reachedTarget=false`: same — the animation just ends early.

#### Documentation updates:
1. **`CLAUDE.md` (this file)** — architecture & roadmap.
2. **`README.md`** — update with:
   - Mention of `./build/robot_vacuum_interactive` (new target)
   - How to run the interactive mode
   - How to open the visualizer (`visualization/index.html`)
   - Note that existing `./build/robot_vacuum_sim` (batch mode) is unchanged
3. **`.gitignore` (new)** — add (pre-existing gap):
   ```
   build/
   results/*.csv
   results/*.json
   .DS_Store
   ```

#### Optional polish:
- Add inline HTML comments in `visualization/index.html` explaining the two-canvas pattern, `file://` constraints, etc.
- Add a small README in `visualization/` documenting the JSON schema and the classic-scripts constraint.

---

## Total Time Estimate

| Phase | Est. Duration |
|-------|---------------|
| 1. Step-hook + JSON export | 0.5–1 day |
| 2. Interactive CLI (single algo) | 0.5–1 day |
| 3. Compare-all mode | 0.5 day |
| 4. Playback visualizer | 1.5–2 days |
| 5. Metrics dashboard | 0.5–1 day |
| 6. Polish + docs | 0.5 day |
| **TOTAL** | **~4–6 focused developer-days** |

With AI-assisted pair-programming, wall-clock could compress toward the lower end of each range, except the manual cross-browser `file://` testing in Phase 4–5, which doesn't compress much since it requires human validation. Realistically: **1–1.5 focused work weeks** for one developer, or **3–4 days** with active pair-programming and no unexpected integration surprises.

---

## Key Implementation Constraints & Risks

1. **`file://` sandboxing** — both `fetch()` and ES6 modules are blocked; Phase 4 mandates classic `<script>` tags and `FileReader` for local file loading. Test in multiple browsers; this is not hypothetical — it bites hard if overlooked.

2. **Large trajectory files** — a stalled algorithm on a 60×60 complex room can produce 200k+ steps. The compact `[x, y, dir, revisit]` array encoding (not verbose objects) and batched-tick playback in Phase 4 keep this responsive without pagination or streaming parsing.

3. **Backward-compatibility of the `Simulation::run` signature change** — Phase 1 adds an optional parameter; existing call sites don't pass it. Regression check is a byte-for-byte CSV diff of `robot_vacuum_sim` output before/after.

4. **Two separate binaries** — `robot_vacuum_sim` (batch) and `robot_vacuum_interactive` (interactive) coexist. Do NOT refactor shared code between `main.cpp` and `main_interactive.cpp` — duplicating ~25 lines is lower-risk than touching the tested batch mode.

---

## Running the Final Product

### Batch mode (unchanged):
```bash
./build/robot_vacuum_sim
# Generates results/results.csv with all 27 rooms × algorithm runs
```

### Interactive single-algorithm mode:
```bash
./build/robot_vacuum_interactive
# Prompts for room size, complexity, algorithm
# Records JSON trajectory to results/trajectory_<algo>_<seed>.json
# Open visualization/index.html, load the JSON file in the Playback tab
```

### Interactive compare-all mode:
```bash
./build/robot_vacuum_interactive
# Prompts for room size, complexity
# Runs all 4 algorithms, writes results/interactive_compare.csv
# Open visualization/index.html, load the CSV in the Dashboard tab
```

### Visualizer:
```bash
# Open directly in a browser (file:// protocol, no server needed):
open visualization/index.html   # macOS
# or on Linux/Windows: double-click the file or right-click → Open With Browser
```

---

## Next Steps (Immediate)

1. **Phase 1:** Implement `StepRecord`, `StepCallback`, `JsonWriter`, `TrajectoryRecorder`.
   - Verify regression: `robot_vacuum_sim` output unchanged.
   
2. **Phase 2:** Implement `main_interactive.cpp` with single-algorithm mode.
   - Verify interactive prompts, JSON output structure.

3. (Continue through phases 3–6 incrementally with testing at each gate.)

---

## Notes

- **Why not refactor `Simulation::run` into an iterator or generator?** The callback approach is minimal, backward-compatible, and proven (Phase 1's regression test confirms). A full refactor to return an iterator over `StepRecord`s would be cleaner architecturally but risks introducing bugs in the simulator core — not worth it for this scope.
- **Why not use a third-party visualization library (D3, three.js, Babylon.js)?** Constraints require no external CDN (due to `file://` sandboxing) and a simple grid + rover animation doesn't justify the complexity. Hand-rolled Canvas + CSS bars are appropriate here.
- **Why is `TrajectoryRecorder` storing a reference to the `pristineRoom` instead of a copy?** Because copying a 60×60 grid per run would waste memory and CPU; the contract is simple — the caller must ensure the room stays untouched, which is already how `main.cpp`'s demo section works. If this ever becomes an issue, switching to `const Grid& → std::string` serialization in `writeToFile()` is a trivial one-line change.
