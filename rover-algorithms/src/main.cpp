#include "Grid.h"
#include "RoomGenerator.h"
#include "ZigZagAlgorithm.h"
#include "RandomWalkAlgorithm.h"
#include "ZigZagWallFollowHybrid.h"
#include "ZigZagRandomEscapeHybrid.h"
#include "Simulation.h"
#include "Metrics.h"

#include <fstream>
#include <iostream>
#include <vector>
#include <string>

namespace {

std::string levelName(ComplexityLevel level) {
    switch (level) {
        case ComplexityLevel::SIMPLE:   return "simple";
        case ComplexityLevel::MODERATE: return "moderate";
        case ComplexityLevel::COMPLEX:  return "complex";
    }
    return "unknown";
}

void writeResult(std::ofstream& out, SimulationResult result,
                  const std::string& level, int width, int height,
                  unsigned int seed, int trial) {
    result.roomLevel = level;
    result.roomWidth = width;
    result.roomHeight = height;
    result.roomSeed = seed;
    result.trial = trial;
    out << result.toCSVRow() << "\n";
}

} // namespace

int main() {
    const std::vector<std::pair<int, int>> roomSizes = {{20, 20}, {40, 40}, {60, 60}};
    const std::vector<ComplexityLevel> levels = {
        ComplexityLevel::SIMPLE, ComplexityLevel::MODERATE, ComplexityLevel::COMPLEX
    };
    const int trialsPerStochasticAlgorithm = 5;
    const unsigned int masterSeed = 42;

    SimulationConfig simConfig; // uses the section 2.2 defaults

    std::ofstream out("results/results.csv");
    if (!out) {
        std::cerr << "Could not open results/results.csv for writing.\n";
        return 1;
    }
    out << SimulationResult::csvHeader() << "\n";

    bool printedDemo = false;
    unsigned int roomSeedCounter = masterSeed;

    for (const auto& size : roomSizes) {
        int width = size.first;
        int height = size.second;

        for (ComplexityLevel level : levels) {
            unsigned int roomSeed = roomSeedCounter++;
            RoomConfig roomConfig{width, height, level, roomSeed};

            int startX = 0, startY = 0;
            Grid baseGrid = RoomGenerator::generateRoom(roomConfig, startX, startY);
            std::string level_str = levelName(level);

            std::cout << "Room " << width << "x" << height
                      << " [" << level_str << "] seed=" << roomSeed
                      << " accessible cells=" << baseGrid.countAccessibleCells() << "\n";

            // --- Deterministic algorithms: one run each is sufficient ---
            {
                ZigZagAlgorithm zigzag;
                auto result = Simulation::run(baseGrid, startX, startY, zigzag, simConfig);
                writeResult(out, result, level_str, width, height, roomSeed, 0);
            }
            {
                ZigZagWallFollowHybrid hybrid;
                auto result = Simulation::run(baseGrid, startX, startY, hybrid, simConfig);
                writeResult(out, result, level_str, width, height, roomSeed, 0);
            }

            // --- Stochastic algorithms: repeat with different seeds and average later ---
            for (int trial = 0; trial < trialsPerStochasticAlgorithm; ++trial) {
                unsigned int trialSeed = roomSeed * 1000u + static_cast<unsigned int>(trial);

                RandomWalkAlgorithm randomWalk(trialSeed);
                auto rwResult = Simulation::run(baseGrid, startX, startY, randomWalk, simConfig);
                writeResult(out, rwResult, level_str, width, height, roomSeed, trial);

                ZigZagRandomEscapeHybrid escapeHybrid(trialSeed);
                auto escResult = Simulation::run(baseGrid, startX, startY, escapeHybrid, simConfig);
                writeResult(out, escResult, level_str, width, height, roomSeed, trial);
            }

            // Print one small room's before/after map so you can visually
            // sanity-check the simulation (only once, for the smallest room).
            if (!printedDemo && width == 20 && level == ComplexityLevel::MODERATE) {
                printedDemo = true;
                std::cout << "\nDemo room (20x20, moderate obstacles):\n";
                baseGrid.printAscii(startX, startY);

                ZigZagAlgorithm demoAlgo;
                Grid demoGrid = baseGrid;
                auto demoResult = Simulation::run(demoGrid, startX, startY, demoAlgo, simConfig);
                std::cout << "ZigZag on this room reached "
                          << demoResult.coveragePercent << "% coverage in "
                          << demoResult.steps << " steps.\n\n";
            }
        }
    }

    out.close();
    std::cout << "\nAll simulations complete. Results written to results/results.csv\n";
    return 0;
}
