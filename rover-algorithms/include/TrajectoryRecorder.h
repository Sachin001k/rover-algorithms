#pragma once

#include "Grid.h"
#include "Simulation.h"
#include <vector>
#include <string>

// Records step-by-step trajectory data from a simulation run and serializes to JSON.
// Intended as a callback sink for Simulation::run(). The recorder stores references
// to the pristine Grid (unchanged by the run) and collects StepRecords as they occur.
// On completion, writeToFile() produces a JSON file with full room metadata, compact
// trajectory encoding ([x, y, dirCode, revisit]), and summary metrics.
class TrajectoryRecorder {
public:
    // Initialize recorder with room metadata and simulation config.
    // Stores references; caller must ensure Grid/config remain valid until writeToFile().
    TrajectoryRecorder(const Grid& pristineRoom, int startX, int startY,
                       std::string algorithmName, std::string complexityLevel,
                       unsigned int roomSeed, unsigned int algorithmSeed,
                       const SimulationConfig& config);

    // Callback to collect step records. Suitable for passing to Simulation::run().
    void onStep(const StepRecord& record);

    // Serialize collected trajectory and metadata to a JSON file.
    // Encodes obstacles as bitmap strings, trajectory as compact [x,y,dir,revisit] entries.
    bool writeToFile(const std::string& path, const SimulationResult& result) const;

private:
    const Grid& room_;
    int startX_, startY_;
    std::string algorithmName_;
    std::string complexityLevel_;
    unsigned int roomSeed_;
    unsigned int algorithmSeed_;
    SimulationConfig config_;
    std::vector<StepRecord> steps_;
};
