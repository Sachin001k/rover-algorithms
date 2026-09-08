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

## Project layout

```
include/    Header files (one class per file)
src/        Implementation files + main.cpp (batch experiment runner)
results/    CSV output lands here (git-ignored)
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
| `Simulation` | Runs one algorithm on one room until the coverage target or step cap; records metrics. |
| `Metrics` | `SimulationResult` struct + CSV serialization. |

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
