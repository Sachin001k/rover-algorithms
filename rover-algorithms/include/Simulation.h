#pragma once

#include "Grid.h"
#include "Algorithm.h"
#include "Metrics.h"
#include "Direction.h"
#include <functional>

// Model parameters from section 2.2 / 2.5 (cleaning width, rover speed,
// coverage stopping threshold, step cap).
struct SimulationConfig {
    double targetCoveragePercent = 90.0;
    long maxSteps = 200000;
    double cellSizeCm = 20.0;        // matches the assumed cleaning width
    double roverSpeedCmPerSec = 30.0;
};

// Record of a single step in the rover's trajectory.
// Emitted by the step callback if one is provided to Simulation::run().
struct StepRecord {
    long stepIndex;         // rover.steps AFTER this move (1-based)
    int x, y;               // new rover position
    Direction direction;    // move just taken (never NONE)
    bool wasAlreadyCleaned; // true => this step was a revisit
};

// Callback function type for step events during simulation.
// Fired after each successful move, before coverage check. Optional; if nullptr, no callbacks fire.
using StepCallback = std::function<void(const StepRecord&)>;

class Simulation {
public:
    // Runs `algorithm` on a copy of `grid` starting at (startX, startY)
    // until the coverage target or step cap is reached. Takes grid by value
    // so the same room can be reused unmodified across algorithms/trials.
    // If onStep is provided, it is called once per step with the move details.
    static SimulationResult run(Grid grid, int startX, int startY,
                                 Algorithm& algorithm, const SimulationConfig& config,
                                 const StepCallback& onStep = nullptr);
};
