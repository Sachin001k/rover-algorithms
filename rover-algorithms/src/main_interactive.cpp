#include "Grid.h"
#include "RoomGenerator.h"
#include "ZigZagAlgorithm.h"
#include "RandomWalkAlgorithm.h"
#include "ZigZagWallFollowHybrid.h"
#include "ZigZagRandomEscapeHybrid.h"
#include "Simulation.h"
#include "TrajectoryRecorder.h"

#include <iostream>
#include <string>
#include <memory>
#include <sstream>
#include <iomanip>
#include <cstdlib>
#include <fstream>
#include <ctime>

namespace {

std::string levelName(ComplexityLevel level) {
    switch (level) {
        case ComplexityLevel::SIMPLE:   return "simple";
        case ComplexityLevel::MODERATE: return "moderate";
        case ComplexityLevel::COMPLEX:  return "complex";
    }
    return "unknown";
}

int promptChoice(const std::string& title, const std::vector<std::string>& options) {
    std::cout << "\n" << title << ":\n";
    for (size_t i = 0; i < options.size(); ++i) {
        std::cout << "  " << (i + 1) << ") " << options[i] << "\n";
    }
    std::cout << "Enter choice (1-" << options.size() << "): ";

    int choice;
    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) {
            std::cout << "Invalid input. Try again: ";
            continue;
        }
        try {
            choice = std::stoi(line);
            if (choice >= 1 && choice <= static_cast<int>(options.size())) {
                return choice - 1;
            }
        } catch (...) {}
        std::cout << "Invalid input. Try again: ";
    }
    exit(1);
}

unsigned int promptSeed(const std::string& label, unsigned int defaultSeed) {
    std::cout << "\n" << label << " (default " << defaultSeed << ", or 0 for random): ";

    std::string line;
    if (!std::getline(std::cin, line)) {
        exit(1);
    }

    if (line.empty()) {
        return defaultSeed;
    }

    try {
        unsigned int seed = std::stoi(line);
        if (seed == 0) {
            // Return a "random" seed based on time
            return static_cast<unsigned int>(std::time(nullptr));
        }
        return seed;
    } catch (...) {
        std::cout << "Invalid seed, using default.\n";
        return defaultSeed;
    }
}

std::pair<int, int> roomSizeFor(int choice) {
    switch (choice) {
        case 0: return {20, 20};
        case 1: return {40, 40};
        case 2: return {60, 60};
        default: return {20, 20};
    }
}

ComplexityLevel complexityFor(int choice) {
    switch (choice) {
        case 0: return ComplexityLevel::SIMPLE;
        case 1: return ComplexityLevel::MODERATE;
        case 2: return ComplexityLevel::COMPLEX;
        default: return ComplexityLevel::SIMPLE;
    }
}

std::unique_ptr<Algorithm> algorithmFor(int choice, unsigned int seed) {
    switch (choice) {
        case 0:
            return std::make_unique<ZigZagAlgorithm>();
        case 1:
            return std::make_unique<ZigZagWallFollowHybrid>();
        case 2:
            return std::make_unique<RandomWalkAlgorithm>(seed);
        case 3:
            return std::make_unique<ZigZagRandomEscapeHybrid>(seed);
        default:
            return std::make_unique<ZigZagAlgorithm>();
    }
}

std::string algorithmName(int choice) {
    switch (choice) {
        case 0: return "ZigZag";
        case 1: return "ZigZag+WallFollow";
        case 2: return "RandomWalk";
        case 3: return "ZigZag+RandomEscape";
        default: return "Unknown";
    }
}

void printSummary(const SimulationResult& result) {
    std::cout << "\n=== Simulation Complete ===\n";
    std::cout << "Algorithm: " << result.algorithmName << "\n";
    std::cout << "Steps: " << result.steps << "\n";
    std::cout << "Revisits: " << result.revisits << "\n";
    std::cout << "Turns: " << result.turns << "\n";
    std::cout << "Coverage: " << std::fixed << std::setprecision(2)
              << result.coveragePercent << "%\n";
    std::cout << "Overlap Ratio: " << std::setprecision(6)
              << result.overlapRatio << "\n";
    std::cout << "Travel Distance: " << std::setprecision(1)
              << result.travelDistanceCm << " cm\n";
    std::cout << "Cleaning Time: " << std::setprecision(1)
              << result.cleaningTimeSec << " sec\n";
    std::cout << "Reached Target: " << (result.reachedTarget ? "yes" : "no") << "\n";
}

void runSingleAlgorithm(const Grid& pristineRoom, int startX, int startY,
                        ComplexityLevel complexity, unsigned int roomSeed,
                        int algoChoice, unsigned int algoSeed,
                        const SimulationConfig& config) {
    std::string algoName = algorithmName(algoChoice);
    auto algorithm = algorithmFor(algoChoice, algoSeed);

    // Create trajectory recorder
    TrajectoryRecorder recorder(pristineRoom, startX, startY, algoName,
                               levelName(complexity), roomSeed, algoSeed, config);

    // Run simulation with callback
    auto result = Simulation::run(
        pristineRoom, startX, startY, *algorithm, config,
        [&recorder](const StepRecord& step) { recorder.onStep(step); }
    );

    printSummary(result);

    // Write JSON trajectory file
    std::ostringstream jsonPath;
    jsonPath << "results/trajectory_" << algoName << "_" << roomSeed << ".json";
    if (recorder.writeToFile(jsonPath.str(), result)) {
        std::cout << "JSON trajectory saved to: " << jsonPath.str() << "\n";
    } else {
        std::cerr << "Failed to write JSON file.\n";
    }
}

void runCompareAll(const Grid& pristineRoom, int startX, int startY,
                   ComplexityLevel complexity, unsigned int roomSeed,
                   const SimulationConfig& config) {
    std::cout << "\nRunning all 4 algorithms...\n";

    std::ofstream csvFile("results/interactive_compare.csv");
    if (!csvFile) {
        std::cerr << "Failed to open results/interactive_compare.csv\n";
        return;
    }
    csvFile << SimulationResult::csvHeader() << "\n";

    std::vector<SimulationResult> results;
    std::vector<std::string> names;

    // Run deterministic algorithms once
    {
        std::cout << "Running ZigZag...\n";
        ZigZagAlgorithm algo;
        auto result = Simulation::run(pristineRoom, startX, startY, algo, config);
        result.roomLevel = levelName(complexity);
        result.roomWidth = pristineRoom.getWidth();
        result.roomHeight = pristineRoom.getHeight();
        result.roomSeed = roomSeed;
        result.trial = 0;
        results.push_back(result);
        names.push_back("ZigZag");
        csvFile << result.toCSVRow() << "\n";
    }
    {
        std::cout << "Running ZigZag+WallFollow...\n";
        ZigZagWallFollowHybrid algo;
        auto result = Simulation::run(pristineRoom, startX, startY, algo, config);
        result.roomLevel = levelName(complexity);
        result.roomWidth = pristineRoom.getWidth();
        result.roomHeight = pristineRoom.getHeight();
        result.roomSeed = roomSeed;
        result.trial = 0;
        results.push_back(result);
        names.push_back("ZigZag+WallFollow");
        csvFile << result.toCSVRow() << "\n";
    }

    // Run stochastic algorithms with 3 trials each
    for (int trial = 0; trial < 3; ++trial) {
        unsigned int algoSeed = roomSeed * 1000u + static_cast<unsigned int>(trial);

        {
            std::cout << "Running RandomWalk (trial " << (trial + 1) << "/3)...\n";
            RandomWalkAlgorithm algo(algoSeed);
            auto result = Simulation::run(pristineRoom, startX, startY, algo, config);
            result.roomLevel = levelName(complexity);
            result.roomWidth = pristineRoom.getWidth();
            result.roomHeight = pristineRoom.getHeight();
            result.roomSeed = roomSeed;
            result.trial = trial;
            results.push_back(result);
            names.push_back("RandomWalk");
            csvFile << result.toCSVRow() << "\n";
        }
        {
            std::cout << "Running ZigZag+RandomEscape (trial " << (trial + 1) << "/3)...\n";
            ZigZagRandomEscapeHybrid algo(algoSeed);
            auto result = Simulation::run(pristineRoom, startX, startY, algo, config);
            result.roomLevel = levelName(complexity);
            result.roomWidth = pristineRoom.getWidth();
            result.roomHeight = pristineRoom.getHeight();
            result.roomSeed = roomSeed;
            result.trial = trial;
            results.push_back(result);
            names.push_back("ZigZag+RandomEscape");
            csvFile << result.toCSVRow() << "\n";
        }
    }

    csvFile.close();

    // Print summary table
    std::cout << "\n=== Comparison Summary ===\n";
    std::cout << std::left << std::setw(25) << "Algorithm"
              << std::setw(10) << "Steps" << std::setw(10) << "Coverage%"
              << std::setw(10) << "Overlap" << std::setw(10) << "Time(s)\n";
    std::cout << std::string(65, '-') << "\n";

    for (size_t i = 0; i < results.size(); ++i) {
        const auto& r = results[i];
        std::string algoLabel = names[i];
        if (i >= 2) {
            algoLabel += " [T" + std::to_string(results[i].trial + 1) + "]";
        }
        std::cout << std::left << std::setw(25) << algoLabel
                  << std::setw(10) << r.steps
                  << std::setw(10) << std::fixed << std::setprecision(1) << r.coveragePercent
                  << std::setw(10) << std::setprecision(4) << r.overlapRatio
                  << std::setw(10) << std::setprecision(1) << r.cleaningTimeSec << "\n";
    }

    std::cout << "\nResults CSV saved to: results/interactive_compare.csv\n";
}

} // namespace

int main() {
    std::cout << "=== Robot Vacuum Simulator - Interactive Mode ===\n";

    SimulationConfig simConfig;

    // 1. Room size
    int sizeChoice = promptChoice(
        "Room Size",
        {"Small (20x20)", "Medium (40x40)", "Large (60x60)"}
    );
    auto [width, height] = roomSizeFor(sizeChoice);

    // 2. Complexity
    int complexityChoice = promptChoice(
        "Obstacle Complexity",
        {"Simple", "Moderate", "Complex"}
    );
    ComplexityLevel complexity = complexityFor(complexityChoice);

    // 3. Room seed
    unsigned int roomSeed = promptSeed("Room seed", 42);

    // Generate room
    RoomConfig roomConfig{width, height, complexity, roomSeed};
    int startX = 0, startY = 0;
    Grid baseGrid = RoomGenerator::generateRoom(roomConfig, startX, startY);

    std::cout << "\n=== Generated Room ===\n";
    std::cout << "Size: " << width << "x" << height << "\n";
    std::cout << "Complexity: " << levelName(complexity) << "\n";
    std::cout << "Seed: " << roomSeed << "\n";
    std::cout << "Accessible cells: " << baseGrid.countAccessibleCells() << "\n";
    std::cout << "\nRoom Layout:\n";
    baseGrid.printAscii(startX, startY);

    // 4. Mode
    int modeChoice = promptChoice(
        "Mode",
        {"Run single algorithm", "Compare all algorithms"}
    );

    if (modeChoice == 0) {
        // Single algorithm mode
        int algoChoice = promptChoice(
            "Algorithm",
            {"ZigZag", "ZigZag+WallFollow", "RandomWalk", "ZigZag+RandomEscape"}
        );

        unsigned int algoSeed = 0;
        if (algoChoice == 2 || algoChoice == 3) {
            algoSeed = promptSeed("Algorithm seed", roomSeed * 1000);
        }

        runSingleAlgorithm(baseGrid, startX, startY, complexity, roomSeed,
                          algoChoice, algoSeed, simConfig);
    } else {
        // Compare all mode
        runCompareAll(baseGrid, startX, startY, complexity, roomSeed, simConfig);
    }

    return 0;
}
