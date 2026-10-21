#pragma once

#include <string>
using namespace std;
// One row of results for a single simulation run (one algorithm, one room,
// one trial) — matches the metrics listed in section 2.6.
struct SimulationResult {
    string algorithmName;
    string roomLevel;
    int roomWidth = 0;
    int roomHeight = 0;
    unsigned int roomSeed = 0;
    int trial = 0;

    long steps = 0;
    long revisits = 0;
    long turns = 0;
    double coveragePercent = 0.0;
    double overlapRatio = 0.0;      // revisits / steps
    double travelDistanceCm = 0.0;
    double cleaningTimeSec = 0.0;
    bool reachedTarget = false;      // coverage >= minCoveragePercent (pass mark)
    bool fullCoverage = false;       // coverage >= targetCoveragePercent (100%)
    long stepsToMinCoverage = -1;    // first step at which the pass mark was hit; -1 = never
    double timeToMinCoverageSec = -1.0;

    static string csvHeader();
    string toCSVRow() const;
};
