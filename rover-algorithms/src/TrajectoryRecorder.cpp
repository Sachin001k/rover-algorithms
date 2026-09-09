#include "TrajectoryRecorder.h"
#include "JsonWriter.h"
#include <fstream>
#include <sstream>

TrajectoryRecorder::TrajectoryRecorder(const Grid& pristineRoom, int startX, int startY,
                                       std::string algorithmName, std::string complexityLevel,
                                       unsigned int roomSeed, unsigned int algorithmSeed,
                                       const SimulationConfig& config)
    : room_(pristineRoom), startX_(startX), startY_(startY),
      algorithmName_(std::move(algorithmName)), complexityLevel_(std::move(complexityLevel)),
      roomSeed_(roomSeed), algorithmSeed_(algorithmSeed), config_(config) {}

void TrajectoryRecorder::onStep(const StepRecord& record) {
    steps_.push_back(record);
}

bool TrajectoryRecorder::writeToFile(const std::string& path, const SimulationResult& result) const {
    std::ofstream file(path);
    if (!file.is_open()) {
        return false;
    }

    // Helper: convert Direction to compact integer code (NONE=0, UP=1, DOWN=2, LEFT=3, RIGHT=4)
    auto dirToCode = [](Direction dir) -> int {
        switch (dir) {
            case Direction::NONE:  return 0;
            case Direction::UP:    return 1;
            case Direction::DOWN:  return 2;
            case Direction::LEFT:  return 3;
            case Direction::RIGHT: return 4;
            default:               return 0;
        }
    };

    file << "{\n";
    file << "  \"schemaVersion\": 1,\n";

    file << "  \"algorithm\": ";
    json::writeEscapedString(file, algorithmName_);
    file << ",\n";

    file << "  \"room\": {\n";
    file << "    \"width\": " << room_.getWidth() << ",\n";
    file << "    \"height\": " << room_.getHeight() << ",\n";
    file << "    \"complexityLevel\": ";
    json::writeEscapedString(file, complexityLevel_);
    file << ",\n";
    file << "    \"roomSeed\": " << roomSeed_ << ",\n";
    file << "    \"startX\": " << startX_ << ",\n";
    file << "    \"startY\": " << startY_ << ",\n";
    file << "    \"obstacles\": [\n";

    // Write obstacle bitmap as newline-delimited binary strings
    for (int y = 0; y < room_.getHeight(); ++y) {
        file << "      \"";
        for (int x = 0; x < room_.getWidth(); ++x) {
            file << (room_.isObstacle(x, y) ? '1' : '0');
        }
        file << "\"";
        if (y < room_.getHeight() - 1) file << ",\n";
        else file << "\n";
    }
    file << "    ]\n";
    file << "  },\n";

    file << "  \"config\": {\n";
    file << "    \"cellSizeCm\": " << json::formatNumber(config_.cellSizeCm) << ",\n";
    file << "    \"roverSpeedCmPerSec\": " << json::formatNumber(config_.roverSpeedCmPerSec) << ",\n";
    file << "    \"targetCoveragePercent\": " << json::formatNumber(config_.targetCoveragePercent) << ",\n";
    file << "    \"maxSteps\": " << config_.maxSteps << ",\n";
    file << "    \"algorithmSeed\": " << algorithmSeed_ << "\n";
    file << "  },\n";

    file << "  \"trajectoryFormat\": [\"x\", \"y\", \"dirCode\", \"revisit\"],\n";
    file << "  \"dirCodes\": [\"NONE\", \"UP\", \"DOWN\", \"LEFT\", \"RIGHT\"],\n";

    file << "  \"trajectory\": [\n";
    for (size_t i = 0; i < steps_.size(); ++i) {
        const auto& step = steps_[i];
        file << "    [" << step.x << ", " << step.y << ", " << dirToCode(step.direction)
             << ", " << (step.wasAlreadyCleaned ? 1 : 0) << "]";
        if (i < steps_.size() - 1) file << ",\n";
        else file << "\n";
    }
    file << "  ],\n";

    file << "  \"summary\": {\n";
    file << "    \"steps\": " << result.steps << ",\n";
    file << "    \"revisits\": " << result.revisits << ",\n";
    file << "    \"turns\": " << result.turns << ",\n";
    file << "    \"coveragePercent\": " << json::formatNumber(result.coveragePercent) << ",\n";
    file << "    \"overlapRatio\": " << json::formatNumber(result.overlapRatio) << ",\n";
    file << "    \"travelDistanceCm\": " << json::formatNumber(result.travelDistanceCm) << ",\n";
    file << "    \"cleaningTimeSec\": " << json::formatNumber(result.cleaningTimeSec) << ",\n";
    file << "    \"reachedTarget\": " << (result.reachedTarget ? "true" : "false") << "\n";
    file << "  }\n";

    file << "}\n";

    file.close();
    return true;
}
