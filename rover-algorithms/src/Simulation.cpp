#include "Simulation.h"
#include "Rover.h"
#include "NavUtils.h"

SimulationResult Simulation::run(Grid grid, int startX, int startY,
                                  Algorithm& algorithm, const SimulationConfig& config,
                                  const StepCallback& onStep) {
    RoverState rover(startX, startY);
    algorithm.reset(grid, rover);
    grid.markCleaned(rover.x, rover.y);

    while (grid.coveragePercent() < config.targetCoveragePercent && rover.steps < config.maxSteps) {
        Direction dir = algorithm.getNextMove(grid, rover);
        if (dir == Direction::NONE) break; // algorithm has given up

        int nx, ny;
        applyStep(rover.x, rover.y, dir, nx, ny);
        if (!grid.isAccessible(nx, ny)) {
            // Defensive check: an algorithm should never return an invalid
            // move, but stop cleanly instead of looping forever if it does.
            break;
        }

        if (rover.lastDirection != Direction::NONE && dir != rover.lastDirection) {
            rover.turns++;
        }

        bool wasAlreadyCleaned = grid.isCleaned(nx, ny);

        rover.x = nx;
        rover.y = ny;
        rover.lastDirection = dir;
        rover.steps++;
        if (wasAlreadyCleaned) rover.revisits++;

        grid.markCleaned(nx, ny);

        if (onStep) {
            onStep(StepRecord{rover.steps, nx, ny, dir, wasAlreadyCleaned});
        }
    }

    SimulationResult result;
    result.algorithmName = algorithm.getName();
    result.steps = rover.steps;
    result.revisits = rover.revisits;
    result.turns = rover.turns;
    result.coveragePercent = grid.coveragePercent();
    result.overlapRatio = rover.steps > 0
        ? static_cast<double>(rover.revisits) / static_cast<double>(rover.steps)
        : 0.0;
    result.travelDistanceCm = static_cast<double>(rover.steps) * config.cellSizeCm;
    result.cleaningTimeSec = result.travelDistanceCm / config.roverSpeedCmPerSec;
    result.reachedTarget = grid.coveragePercent() >= config.targetCoveragePercent;

    return result;
}
