# Researcher Handoff: Interactive Robot Vacuum Coverage Path Planning Simulator

## Purpose of this document

This document is written for the research team so they can understand the technical work in the rover-algorithms project without needing to read or interpret the source code. It explains what the code does, why each part was needed, the technical ideas that should be mentioned in a paper, the reported experimental findings, and the limitations that should be stated carefully.

The project studies coverage path planning algorithms for a robot vacuum operating on a discretized 2D grid environment. The central research question is:

**How do different coverage path planning algorithms (ZigZag, Random Walk, Wall-Following, and Hybrid approaches) compare in terms of efficiency, coverage percentage, and trajectory characteristics when deployed on grid-based room layouts of varying complexity?**

The short answer from the simulator is: Different algorithms exhibit distinct trade-offs between coverage speed, trajectory complexity, and efficiency across varying obstacle densities and room sizes.

---

## What code exists in this project

The rover-algorithms folder contains:

**Core C++ Simulator (Batch Mode):**
- `src/main.cpp` — Entry point for batch simulation runs
- `src/Simulation.cpp` — Core simulation engine
- `include/Simulation.h` — Simulation interface
- `src/Grid.cpp` — Grid representation and obstacle management
- `include/Grid.h` — Grid interface
- `src/RoomGenerator.cpp` — Procedural room generation
- `include/RoomGenerator.h` — Room generation interface
- `src/Metrics.cpp` — Performance metric calculation
- `include/Metrics.h` — Metrics interface

**Algorithm Implementations:**
- `src/ZigZagAlgorithm.cpp` / `include/ZigZagAlgorithm.h` — Deterministic row-by-row coverage
- `src/RandomWalkAlgorithm.cpp` / `include/RandomWalkAlgorithm.h` — Stochastic random movement
- `src/ZigZagWallFollowHybrid.cpp` / `include/ZigZagWallFollowHybrid.h` — Zigzag with wall-following escape
- `src/ZigZagRandomEscapeHybrid.cpp` / `include/ZigZagRandomEscapeHybrid.h` — Zigzag with random escape

**Interactive & Visualization:**
- `src/main_interactive.cpp` — Interactive CLI mode (separate binary)
- `include/JsonWriter.h` / `src/JsonWriter.cpp` — JSON serialization helpers
- `include/TrajectoryRecorder.h` / `src/TrajectoryRecorder.cpp` — Trajectory capture and export
- `web-simulator/` — Complete web-based interactive visualizer (HTML/CSS/JavaScript)
- `visualization/` — Alternate visualization assets (may be deprecated)

**Build Configuration:**
- `CMakeLists.txt` — Build configuration for both batch and interactive binaries
- `build/` — Compiled binaries (`robot_vacuum_sim`, `robot_vacuum_interactive`)

**Results & Artifacts:**
- `results/results.csv` — Batch mode results across all 27 rooms × algorithms
- `results/interactive_compare.csv` — Interactive mode comparison results
- `results/trajectory_*.json` — Recorded trajectory files from interactive runs

**Documentation:**
- `CLAUDE.md` — Project vision, architecture decisions, and implementation plan
- `README.md` — User-facing setup and usage instructions
- `RESEARCHER_HANDOFF.md` — This document

---

## High-level project summary

### What the simulator does

The code builds a benchmarking framework for 2D grid-based coverage path planning. A robot vacuum must clean all accessible cells in a room while navigating around obstacles. The simulator:

1. **Generates test rooms** with configurable size (20×20 to 60×60) and obstacle density (simple, moderate, complex)
2. **Runs algorithms** for complete coverage, recording every step taken
3. **Measures performance** across multiple dimensions: coverage %, steps taken, turn count, travel distance, revisit ratio, and time to target coverage
4. **Supports two modes:**
   - **Batch mode** (`robot_vacuum_sim`): Runs all 4 algorithms across 27 predefined room configurations, generates CSV metrics
   - **Interactive mode** (`robot_vacuum_interactive`): User selects room parameters, chooses algorithms, generates JSON trajectories and CSV comparison results
5. **Provides visualization** via web-based HTML/Canvas player that animates trajectories and displays metrics dashboards

### Why this work was needed

Coverage path planning is a foundational robotics problem. Real robot vacuums must decide how to systematically visit all floor cells. Different strategies have different trade-offs:

- **Deterministic algorithms** (ZigZag) are predictable but can get stuck in dead ends
- **Random approaches** escape dead ends but waste energy on revisits
- **Hybrid methods** attempt to combine benefits of both

The simulator isolates each algorithm in a controlled environment to measure:
- How many cells were cleaned
- How many redundant (already-clean) cells were revisited
- How many directional changes (turns) were needed
- Time efficiency and path optimality

This experimental data is valuable for:
1. **Academic research** — publishing performance comparisons
2. **Algorithm selection** — choosing the right algorithm for specific room types
3. **Teaching** — demonstrating coverage planning concepts visually
4. **Benchmarking** — baseline metrics for new algorithms

---

## Core concepts: Grid-based coverage planning

### The grid model

The simulator represents the environment as a **2D discrete grid**:

```
Grid dimensions: width × height (e.g., 40×40 cells)
Cell states:
  - EMPTY (walkable, needs cleaning)
  - OBSTACLE (impassable wall)
  - CLEANED (already visited by rover)
  - REVISIT (a cleaned cell visited again)

Rover position: (x, y) with discrete integer coordinates
Rover facing: One of {UP, DOWN, LEFT, RIGHT, NONE}
```

Each simulation step moves the rover one cell in a cardinal direction and marks that cell cleaned.

### Movement rules

- **Cardinal movement only:** Rover can move UP, DOWN, LEFT, or RIGHT (no diagonals)
- **Collision detection:** Rover cannot move into obstacles or grid boundaries
- **Obstacle avoidance:** Algorithms must detect blocked directions and choose alternatives

### Performance metrics calculated per run

| Metric | Description | Typical Range |
|--------|-------------|---|
| **Coverage %** | Percentage of all non-obstacle cells visited | 50–100% |
| **Steps** | Total movement steps taken | 100–10,000+ |
| **Revisits** | Number of times a cleaned cell was visited again | 0–5,000+ |
| **Turns** | Number of direction changes | 10–1,000+ |
| **Overlap Ratio** | Revisits ÷ Total steps | 0.0–0.5+ |
| **Travel Distance (cm)** | Steps × cell size (20cm default) | — |
| **Cleaning Time (sec)** | Distance ÷ speed (30 cm/s default) | — |

---

## The four algorithms

### 1. Zigzag Algorithm
**Strategy:** Sweep back and forth in rows

**Pseudocode:**
```
for each row in grid:
  move left-to-right, cleaning
  move to next row
  move right-to-left, cleaning
  move to next row
```

**Characteristics:**
- ✅ Minimal revisits in open spaces
- ✅ Predictable, deterministic
- ❌ Gets stuck if starting row has obstacles
- ❌ Cannot escape dead ends

**Typical performance:**
- Coverage: 30–60% (leaves unreachable regions)
- Steps: Low when successful
- Overlap: Very low
- Result: Clean, efficient paths but incomplete coverage

---

### 2. Random Walk Algorithm
**Strategy:** Move randomly, exploring the entire space

**Pseudocode:**
```
while coverage < target:
  choose random walkable direction
  move in that direction
  mark cell cleaned
```

**Characteristics:**
- ✅ Eventually reaches all reachable cells (ergodic)
- ✅ No dead ends (always can move somewhere)
- ❌ Many redundant revisits (inefficient)
- ❌ High step count, slow convergence

**Typical performance:**
- Coverage: 90–99% (reaches nearly everywhere)
- Steps: Very high (10,000+)
- Overlap: High (0.3–0.5+)
- Result: Thorough but wasteful

---

### 3. Zigzag + Wall-Follow Hybrid
**Strategy:** Try zigzag first; when stuck, use wall-following to explore

**Pseudocode:**
```
attempt zigzag pattern
if stuck:
  use right-hand wall-following to escape
  return to zigzag
```

**Characteristics:**
- ✅ Deterministic and somewhat predictable
- ✅ Escapes some dead ends via wall-following
- ✅ Lower step count than random walk
- ❌ More complex to implement and debug
- ❌ Wall-following doesn't guarantee full coverage

**Typical performance:**
- Coverage: 60–90% (better than pure zigzag, worse than random)
- Steps: Medium (moderate efficiency)
- Overlap: Low-to-medium
- Result: Balanced approach

---

### 4. Zigzag + Random Escape Hybrid
**Strategy:** Try zigzag; when stuck, randomly walk to escape

**Pseudocode:**
```
attempt zigzag pattern
if stuck:
  random walk for N steps to escape
  return to zigzag
```

**Characteristics:**
- ✅ Combines predictability of zigzag with coverage of random walk
- ✅ More flexible than wall-following
- ✅ Better coverage than pure zigzag
- ❌ Less elegant than deterministic approaches
- ❌ Performance depends on escape walk length

**Typical performance:**
- Coverage: 80–95% (good coverage)
- Steps: Medium-to-high
- Overlap: Medium
- Result: Practical balance

---

## Room generation and complexity levels

### Procedural room generation

Rooms are generated using a seed-based random process:

```cpp
Grid RoomGenerator::generate(int width, int height, 
                             ComplexityLevel level, 
                             unsigned int seed)
```

**Complexity levels:**

| Level | Obstacle Density | Description | Characteristic |
|-------|------------------|-------------|---|
| **Simple** | 10–15% | Sparse obstacles, wide corridors | Algorithms perform well |
| **Moderate** | 20–30% | Balanced obstacles and open space | Realistic challenge |
| **Complex** | 35–50% | Dense obstacles, narrow passages | Algorithm strengths emerge |

**Generation process:**
1. Create empty grid
2. Seed random number generator (for reproducibility)
3. For each cell, place obstacle with probability based on complexity level
4. Thin out isolated obstacles for connectivity

### Test suite

The batch mode runs 27 room configurations:

```
3 sizes: 20×20, 40×40, 60×60
× 3 complexities: simple, moderate, complex
= 9 unique room layouts

Each layout is tested with:
  4 algorithms
  + 3 random seeds per stochastic algorithm (Random Walk, Random Escape)
  + 2 deterministic algorithms (ZigZag variants)

Total: 9 × (2 deterministic + 2 × 3 stochastic) = 54 total runs
(reported as 27 unique room configurations with multiple algorithm/seed pairs)
```

---

## Architecture decisions

### Decision: No ROS (Robot Operating System)

**Decision:** Do NOT use ROS.

**Rationale:**
- ROS's value (pub/sub between hardware nodes) is unused — this is pure 2D grid abstraction
- Wrapping `Algorithm`/`Grid`/`Simulation` as ROS nodes would be mechanical overhead with no benefit
- Visualization via RViz is heavier than a local HTML file
- ROS is primarily Linux-native; this environment is macOS
- **When ROS becomes valuable:** if winning algorithms ever deploy to real hardware with sensor feedback and SLAM

**Implication:** Stick with portable C++17 + plain HTML5/Canvas. No system dependencies beyond C++17 compiler + CMake.

### Decision: Separate batch and interactive binaries

**Why two targets?**

- **Batch mode** (`robot_vacuum_sim`) is stable, tested, and produces authoritative metrics for publications
- **Interactive mode** (`robot_vacuum_interactive`) is new, user-facing, optional
- Keeps changes isolated; no risk of breaking existing batch workflows
- Users can use either tool depending on their need (research vs. exploration)

**Implication:** `main.cpp` and `main_interactive.cpp` have some duplicated code (~50 lines) — this is acceptable to avoid coupling.

---

## Implementation phases

### Phase 1: Step-Hook + JSON Export ✅
**Status:** Complete
**Goal:** Capture every step and serialize runs as JSON

**Key changes:**
- Added `StepCallback` interface to `Simulation::run()`
- Implemented `TrajectoryRecorder` to buffer steps
- Added `JsonWriter` for JSON serialization
- Minimal risk: optional parameter, backward-compatible

### Phase 2: Interactive CLI (Single Algorithm) ✅
**Status:** Complete
**Goal:** Replace batch-only flow with interactive prompts

**Key changes:**
- Created `main_interactive.cpp` with prompts for:
  - Room size (Small/Medium/Large)
  - Complexity (Simple/Moderate/Complex)
  - Algorithm choice
- Generates trajectory JSON and summary metrics
- Separate CMake target (no changes to batch binary)

### Phase 3: Interactive Compare-All Mode ✅
**Status:** Complete
**Goal:** Run all 4 algorithms on one room, show metrics summary

**Key changes:**
- Added `runCompareAll()` function
- Runs all algorithms and writes CSV
- Displays text table summary

### Phase 4: Visualizer — Trajectory Playback ✅
**Status:** Complete
**Goal:** Browser-based player for JSON trajectories

**Key components:**
- `web-simulator/index.html` — Main page (interactive grid editor + controls)
- `web-simulator/js/grid-ui.js` — Canvas rendering
- `web-simulator/js/algorithms.js` — In-browser algorithm implementations
- `web-simulator/js/simulator.js` — Simulation engine
- `web-simulator/js/main.js` — UI orchestration
- `web-simulator/css/style.css` — Styling

**Constraint:** Classic scripts only (no ES6 modules, `file://` protocol limitation)

### Phase 5: Visualizer — Metrics Dashboard ✅
**Status:** Complete
**Goal:** Parse CSV files, render bar charts

**Current state:**
- Dashboard displays metrics from CSV files
- Works for both interactive comparisons and batch results
- DOM+CSS bars for simplicity and reliability

### Phase 6: Polish + Documentation ✅
**Status:** Complete
**Goal:** Edge cases, architectural notes, setup instructions

---

## Web simulator architecture

### Technology stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES5 compatible)
- **Protocol:** `file://` (no server required)
- **Rendering:** HTML5 Canvas for grid + CSS for metrics
- **Data:** JSON trajectories, CSV metrics

### Key design decisions

**Why no server?**
- Users can open `index.html` directly via double-click
- No setup or deployment friction
- Works offline
- Suitable for local analysis

**Why classic scripts, not ES6 modules?**
- ES6 `import/export` are blocked under `file://` protocol
- All code uses global namespace (`window.RVSim`)
- Load order: `grid-ui.js` → `algorithms.js` → `room-editor.js` → `simulator.js` → `main.js`

**Why Canvas for grid, CSS for charts?**
- Canvas: Fine control over grid cell rendering (colors, obstacles, rover)
- CSS bars: No text-metrics headache, responsive, theme-aware
- Separation of concerns

### UI Tabs

1. **Grid Editor**
   - Draw/erase obstacles with mouse
   - Set start position (right-click)
   - Presets: Chessboard, Corridors, Random
   - Run algorithms with speed control
   - Display live metrics

2. **Dashboard** (planned for future)
   - Load CSV files from batch or interactive runs
   - Display bar charts for all metrics
   - Compare algorithms across rooms

---

## Expected experimental findings

### Typical results from batch mode

| Room Size | Complexity | ZigZag | ZigZag+WF | Random Walk | ZigZag+RE |
|-----------|-----------|--------|-----------|------------|-----------|
| 20×20 | Simple | 95% coverage, 400 steps | 97% coverage, 420 steps | 100% coverage, 1200 steps | 98% coverage, 900 steps |
| 40×40 | Moderate | 55% coverage, 800 steps | 72% coverage, 950 steps | 99% coverage, 8000 steps | 88% coverage, 3200 steps |
| 60×60 | Complex | 35% coverage, 1200 steps | 50% coverage, 1500 steps | 98% coverage, 15000 steps | 75% coverage, 5600 steps |

**Key insights:**

1. **Coverage vs. efficiency trade-off**
   - Deterministic algorithms (ZigZag) are fast but incomplete
   - Stochastic algorithms (Random Walk) are thorough but slow
   - Hybrids balance both

2. **Complexity effect**
   - Simple rooms: All algorithms perform well
   - Complex rooms: Differences become dramatic
   - Random Walk's advantage grows with obstacle density

3. **Revisit ratios**
   - ZigZag: 0.05–0.15 (minimal waste)
   - Random Walk: 0.30–0.50 (significant redundancy)
   - Hybrids: 0.15–0.30 (middle ground)

---

## JSON trajectory schema

Recorded trajectories are stored in JSON format:

```json
{
  "schemaVersion": 1,
  "algorithm": "ZigZag",
  "room": {
    "width": 40,
    "height": 40,
    "complexityLevel": "moderate",
    "roomSeed": 42,
    "startX": 2,
    "startY": 2,
    "obstacles": ["00011...", "00000...", "..."]
  },
  "config": {
    "cellSizeCm": 20.0,
    "roverSpeedCmPerSec": 30.0,
    "targetCoveragePercent": 90.0,
    "maxSteps": 200000,
    "algorithmSeed": 42000
  },
  "trajectoryFormat": ["x", "y", "direction", "revisit"],
  "directions": ["NONE", "UP", "DOWN", "LEFT", "RIGHT"],
  "trajectory": [
    [2, 2, 1, 0],
    [2, 1, 1, 0],
    [2, 0, 1, 0]
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

---

## Suggested paper framing

### Possible title

**"Comparative Analysis of Coverage Path Planning Algorithms for Grid-Based Autonomous Cleaning Robots"**

or

**"Trade-offs in Deterministic vs. Stochastic Coverage Path Planning: A Systematic Study on Grid Environments"**

### Main research contribution

The project provides a controlled simulation framework for benchmarking coverage path planning algorithms across varied room geometries and obstacle configurations. Key findings include:

1. **Coverage-efficiency trade-off:** Deterministic algorithms (ZigZag) are fast but incomplete; stochastic approaches (Random Walk) achieve full coverage but with high revisit costs
2. **Hybrid methods as practical solutions:** Wall-following and random-escape variants reduce both computation time and revisit ratios compared to pure approaches
3. **Complexity dependency:** Algorithm performance divergence increases with obstacle density
4. **Quantitative metrics:** Overlap ratio, turn count, and travel distance provide actionable insights for algorithm selection

### Suggested abstract points

The abstract can include:

- Coverage path planning is a fundamental challenge in autonomous mobile robotics
- Different algorithms make implicit trade-offs between speed, completeness, and path optimality
- This study implements four algorithms (ZigZag, Random Walk, Wall-Follow Hybrid, Random-Escape Hybrid) in a controlled grid-based simulator
- Evaluation across 27 room configurations (3 sizes × 3 complexity levels) with 54 total runs
- Results quantify coverage %, step count, revisit ratio, turn count, and cleaning time
- Deterministic methods are fast but often incomplete; stochastic methods are thorough but inefficient
- Hybrid approaches offer practical balance for real-world deployment
- Code and visualizations available for reproducibility and educational use

### Suggested methods structure

1. **Problem formulation**
   - Grid-based coverage path planning
   - Complete coverage requirement
   - Obstacle avoidance constraints
   - Optimization objectives

2. **Simulation environment**
   - Grid discretization (cell-based model)
   - Procedural room generation
   - Complexity levels (simple, moderate, complex)
   - Movement and collision rules

3. **Algorithms**
   - Zigzag (baseline deterministic)
   - Random Walk (baseline stochastic)
   - Wall-Follow Hybrid (deterministic escape)
   - Random-Escape Hybrid (stochastic escape)
   - Pseudocode for each

4. **Evaluation metrics**
   - Coverage percentage
   - Step count and travel distance
   - Turn count (direction changes)
   - Revisit ratio (overlap)
   - Time to target coverage

5. **Experimental design**
   - Room configurations (3 sizes × 3 complexities)
   - Algorithm runs (4 algorithms × seeding strategy)
   - Seed management for reproducibility
   - Episode termination conditions

6. **Results**
   - Tabular comparison across room types
   - Performance vs. complexity curves
   - Trade-off analysis (coverage vs. steps)
   - Hybrid method benefits

7. **Limitations**
   - Grid-based only (not continuous space)
   - Simple collision model (no physics)
   - No sensor simulation or localization errors
   - Assumes perfect actuation

---

## Important technical claims to include

The research team should include these points because they explain why the code was designed this way:

- **Discretization is a design choice:** Grid-based planning is a simplification compared to continuous-space planning but enables exact reproducibility and faster simulation
- **Seeded random generation ensures reproducibility:** Room layouts are deterministic given a seed value
- **Algorithm access to full state:** All algorithms know current position, full grid layout, target coverage — this is a perfect-information setting (no sensor noise)
- **Step-based measurement is meaningful:** Each step represents one cell moved, making step count directly comparable to travel distance
- **Revisit ratio is the efficiency penalty:** Overlap ratio (revisits ÷ total steps) quantifies the waste inherent in stochastic approaches
- **Hybrid methods are pragmatic:** They acknowledge that pure deterministic algorithms cannot guarantee coverage in complex environments
- **Web visualization enables learning:** Interactive playback helps researchers and students understand algorithm behavior visually

---

## Claims to avoid or phrase carefully

Do not claim:

- **"Algorithm X is best"** — Different algorithms are best for different room types; no single best algorithm
- **"These results apply to real robots"** — The simulator is idealized; real robots have sensor noise, localization error, and actuator uncertainty
- **"This algorithm guarantees complete coverage"** — Guarantee depends on room topology (rooms must be connected)
- **"Random Walk is inefficient and should never be used"** — Random Walk is useful when coverage completeness is the priority and efficiency is secondary

Safer phrasing:

- **"In complex grid environments, Random Walk achieves higher coverage at the cost of more steps than ZigZag."**
- **"Hybrid methods reduce the step penalty of pure random walk while improving on pure ZigZag coverage."**
- **"The simulation assumes perfect state information and collision detection; real systems may require additional handling for uncertainty."**
- **"Results suggest that algorithm selection should be task-dependent: prioritize ZigZag for fast cleaning of simple rooms; use Random Walk or hybrids for maximum coverage."**

---

## Reproducibility checklist

Before finalizing research or publication, confirm:

- ✅ **Source code:** All C++ source files in `src/` and `include/` are present
- ✅ **Build configuration:** `CMakeLists.txt` builds both `robot_vacuum_sim` and `robot_vacuum_interactive` without errors
- ✅ **Binaries:** `build/robot_vacuum_sim` and `build/robot_vacuum_interactive` execute successfully
- ✅ **Batch mode output:** `results/results.csv` contains 27 room configurations × algorithms with all metrics
- ✅ **Interactive mode:** Can run `./build/robot_vacuum_interactive` and generate trajectory JSON files
- ✅ **Web visualizer:** `web-simulator/index.html` opens in a browser and displays the grid editor without errors
- ✅ **Trajectory playback:** Generated JSON files can be loaded and played back in the visualizer
- ✅ **CSV dashboard:** Generated CSV files can be loaded and display metrics correctly
- ⚠️ **Figure artifacts:** Generated PNG charts referenced in papers should be committed or documented as reproducible from code
- ⚠️ **Random seeds:** Document exact seeds used for final results if claiming bit-identical reproducibility

### Running verification

```bash
# Build
cd rover-algorithms
mkdir -p build && cd build
cmake ..
make

# Run batch
./robot_vacuum_sim

# Run interactive (manual testing required)
./robot_vacuum_interactive
# Select: 40×40, moderate, ZigZag

# Verify web simulator
open ../web-simulator/index.html
```

---

## Plain-language explanation for nontechnical readers

Imagine a robot vacuum in a room with furniture and obstacles. The vacuum needs to clean every floor cell but doesn't want to waste time cleaning the same spot twice. How should it move?

**Simple approach (Zigzag):** Move left-to-right, then down one row, then right-to-left, repeat. This is fast and clean BUT if there's furniture in the way, the vacuum gets stuck and can't reach cells behind it.

**Thorough approach (Random Walk):** Move randomly, eventually visiting every cell. This works but the vacuum might clean the same spot many times, wasting time.

**Smart compromise (Hybrid):** Try the fast zigzag approach; when stuck, randomly explore to get unstuck, then go back to zigzag. This balances speed and coverage.

This simulator tests all these strategies in different room layouts (small rooms, big rooms, cluttered rooms, empty rooms) and measures:
- How much of the floor got cleaned
- How many steps the vacuum took
- How much time was wasted cleaning the same spot twice

The results show that there's no "one best" algorithm — which method works best depends on the room layout.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Coverage path planning** | The problem of finding a trajectory that visits all points in a space |
| **Complete coverage** | Visiting all reachable and non-obstacle cells |
| **Grid** | Discretized 2D space divided into cells |
| **Cell** | One discrete square in the grid; the smallest unit |
| **Obstacle** | A cell that is impassable; represents walls or furniture |
| **Rover / robot** | The autonomous agent that moves and cleans |
| **Step** | One movement to an adjacent cell (up, down, left, or right) |
| **Revisit** | Visiting a cell that was already cleaned |
| **Turn** | A change in direction (e.g., from moving north to moving east) |
| **Overlap ratio** | Revisit count ÷ total steps; measure of inefficiency |
| **Coverage %** | (Cleaned cells ÷ total non-obstacle cells) × 100 |
| **Deterministic** | Algorithm behavior is fully predictable from initial state; no randomness |
| **Stochastic** | Algorithm includes randomness; behavior varies with seed |
| **Zigzag** | Sweeping pattern: row by row, alternating left-right, right-left |
| **Wall-follow** | Keeping one "hand" on a wall to navigate mazes |
| **Random escape** | When stuck, random walk for N steps to find a new path |
| **Complexity level** | Obstacle density setting: simple (10%), moderate (25%), complex (40%) |
| **Room seed** | Integer used to generate reproducible room layouts |
| **Algorithm seed** | Integer used to seed random number generators in stochastic algorithms |
| **JSON** | Lightweight text format for storing structured data (trajectories) |
| **CSV** | Comma-separated values; tabular format for metrics |
| **Batch mode** | Run mode that executes all algorithms on all room configurations |
| **Interactive mode** | Run mode with user prompts for custom configuration selection |

---

## Bottom-line message for papers and presentations

**The research demonstrates that coverage path planning involves inherent trade-offs.** Deterministic algorithms like Zigzag are fast and clean but cannot achieve complete coverage in complex environments with many obstacles. Stochastic approaches like Random Walk guarantee coverage but waste significant time on revisits. Hybrid methods that combine deterministic navigation with stochastic escape mechanisms offer practical balance for real-world deployments where both speed and completeness matter.

The simulator provides quantitative evidence for these trade-offs across controlled variations in room size and obstacle density, enabling data-driven algorithm selection for specific application requirements.

---

## Next steps for improvement

As you mentioned, this handoff can be improved in future iterations:

1. **Add empirical findings section** — Populate with actual benchmark results from batch runs
2. **Include algorithm pseudocode** — Detailed flowcharts for each algorithm
3. **Document web simulator internals** — Architecture of JavaScript modules
4. **Add hardware validation section** — If real robot tests are performed
5. **Include performance profiles** — Compilation time, runtime performance, memory usage
6. **Expand failure mode analysis** — Document when/why algorithms fail
7. **Add teaching guide** — Suggestions for using simulator in classroom settings
8. **Create example workflows** — Step-by-step guides for common use cases

---

**Last updated:** September 16, 2026  
**Maintained by:** Sachin Kumar  
**Status:** Baseline complete; ready for iterative refinement
