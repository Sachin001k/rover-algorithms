#include "Metrics.h"
#include <sstream>

std::string SimulationResult::csvHeader() {
    return "algorithm,room_level,room_width,room_height,room_seed,trial,"
           "steps,revisits,turns,coverage_percent,overlap_ratio,"
           "travel_distance_cm,cleaning_time_sec,reached_target";
}

std::string SimulationResult::toCSVRow() const {
    std::ostringstream oss;
    oss << algorithmName << ','
        << roomLevel << ','
        << roomWidth << ','
        << roomHeight << ','
        << roomSeed << ','
        << trial << ','
        << steps << ','
        << revisits << ','
        << turns << ','
        << coveragePercent << ','
        << overlapRatio << ','
        << travelDistanceCm << ','
        << cleaningTimeSec << ','
        << (reachedTarget ? "true" : "false");
    return oss.str();
}
