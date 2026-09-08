#pragma once

#include "Grid.h"
#include "Algorithm.h"
#include "Metrics.h"

// Model parameters from section 2.2 / 2.5 (cleaning width, rover speed,
// coverage stopping threshold, step cap).
struct SimulationConfig {
    double targetCoveragePercent = 90.0;
    long maxSteps = 200000;
    double cellSizeCm = 20.0;        // matches the assumed cleaning width
    double roverSpeedCmPerSec = 30.0;
};

class Simulation {
public:
    // Runs `algorithm` on a copy of `grid` starting at (startX, startY)
    // until the coverage target or step cap is reached. Takes grid by value
    // so the same room can be reused unmodified across algorithms/trials.
    static SimulationResult run(Grid grid, int startX, int startY,
                                 Algorithm& algorithm, const SimulationConfig& config);
};
