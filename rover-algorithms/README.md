# Robot Vacuum Coverage Path Planning Simulation

A grid-based C++ simulation comparing coverage path-planning strategies for
autonomous robotic vacuum cleaners: Random Walk, Zig-Zag, and two hybrids
(Zig-Zag + Wall-Following, Zig-Zag + Random-Escape).

## Build

Requires CMake 3.10+ and a C++17 compiler.

```bash
mkdir build && cd build
cmake ..
cmake --build .
```

## Run

### Batch Mode (Original)

From the project root (so the `results/` folder is found):

```bash
./build/robot_vacuum_sim
```

This generates rooms of three sizes (20x20, 40x40, 60x60) at three obstacle
densities (simple / moderate / complex), runs all four algorithms on each
room, and writes one row per run to `results/results.csv`. Stochastic
algorithms (Random Walk, Zig-Zag+Random-Escape) are repeated 5 times per
room with different seeds; deterministic algorithms (Zig-Zag,
Zig-Zag+Wall-Follow) run once.

### Interactive Mode (New)

```bash
./build/robot_vacuum_interactive
```

Interactive mode lets you:
1. Choose a room size (Small 20×20 / Medium 40×40 / Large 60×60)
2. Choose obstacle complexity (Simple / Moderate / Complex)
3. Optionally set the room seed (or use random)
4. Preview the generated room
5. Run a **single algorithm** with step-by-step trajectory recording
   - Outputs JSON to `results/trajectory_<algo>_<seed>.json`
6. Or run **all algorithms** on the same room to compare
   - Outputs CSV to `results/interactive_compare.csv` with side-by-side metrics

### Visualization

Open the trajectory playback visualizer:

```bash
open visualization/index.html    # macOS
# or on Linux/Windows: double-click the file or right-click → Open With Browser
```

**Playback Tab:**
- Load a trajectory JSON file (from Interactive Mode)
- Play/Pause/Step through the animation
- Adjust playback speed (1–200 steps/sec)
- Scrub to any step with the slider
- View live metrics (steps, coverage %, overlap ratio, time)

**Dashboard Tab:**
- Load a CSV file (from Interactive Compare or batch results)
- View algorithm comparison bar charts:
  - Coverage %, Total Steps, Overlap Ratio, Cleaning Time, Turns
- Automatic mean aggregation across trials

## Project layout

```
include/        Header files (one class per file)
src/            Implementation files
                - main.cpp (batch experiment runner)
                - main_interactive.cpp (interactive runner)
                - JsonWriter.cpp, TrajectoryRecorder.cpp (trajectory recording)
results/        CSV and JSON output (git-ignored)
visualization/  Browser-based visualizer (HTML/CSS/JS, no server required)
                - index.html (main page with tabs)
                - app.js (bootstrapper and controller)
                - grid-renderer.js (canvas rendering)
                - playback.js (animation state machine)
                - dashboard.js (CSV metrics charting)
                - style.css (styling)
```

| File | Responsibility |
|---|---|
| `Grid` | The room: FREE / CLEANED / OBSTACLE cell states, coverage %. |
| `RoomGenerator` | Builds rooms with rectangular obstacles at a given density; seals off any sealed-in pockets so coverage % is always well-defined. |
| `Rover` | Plain struct tracking rover position, steps, revisits, turns. |
| `Algorithm` | Interface every strategy implements (`getNextMove`). |
| `ZigZagAlgorithm` | Deterministic baseline: sweep, shift row, repeat. |
| `RandomWalkAlgorithm` | Stochastic baseline: straight until blocked, then random turn. |
| `ZigZagWallFollowHybrid` | Zig-Zag that hugs an obstacle boundary when stuck, then rejoins the sweep line. |
| `ZigZagRandomEscapeHybrid` | Zig-Zag that takes a short random walk when stuck, then resumes the sweep. |
| `Simulation` | Runs one algorithm on one room until the coverage target or step cap; records metrics. Optional callback for step-by-step recording. |
| `Metrics` | `SimulationResult` struct + CSV serialization. |
| `JsonWriter` | Helpers for JSON string escaping and number formatting. |
| `TrajectoryRecorder` | Collects step records during a run and serializes to JSON with room metadata. |

## Metrics recorded (per run)

Coverage percentage, steps to reach target coverage, overlap ratio
(revisits / steps), travel distance (steps × cleaning width), estimated
cleaning time (distance / rover speed), and number of turns.

## Notes

- This models coverage path planning only — mapping/SLAM is out of scope;
  the room layout is generated up front and handed to the simulator.
- Movement is 4-directional (no diagonals) on a uniform grid.
- Cleaning width (20 cm) and rover speed (30 cm/s) are provisional
  parameters set in `SimulationConfig` (`include/Simulation.h`) and can be
  tuned once a final grid resolution is chosen.
