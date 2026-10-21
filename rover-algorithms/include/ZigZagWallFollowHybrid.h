#pragma once

#include "Algorithm.h"
#include <vector>
#include <utility>
// using namespace std;  // Avoid namespace pollution in headers
// Hybrid #1 (section 2.4.3): behaves exactly like ZigZagAlgorithm while
// sweeping open floor. It switches into a right-hand-rule wall-following
// mode to hug an obstacle boundary whenever the sweep AND the planned
// row-shift are both blocked, and rejoins the original sweep line once it
// is back on that row past the obstacle. If it goes a long stretch of steps
// without cleaning any new cell (re-sweeping covered rows, or a boundary
// loop that never finds a re-entry point) it walks the shortest path to the
// nearest uncleaned cell and resumes sweeping there.
class ZigZagWallFollowHybrid : public Algorithm {
public:
    void reset(const Grid& grid, const RoverState& rover) override;
    Direction getNextMove(const Grid& grid, const RoverState& rover) override;
    std::string getName() const override { return "ZigZag+WallFollow"; }

private:
    enum class Mode { SWEEP, SHIFT, WALL_FOLLOW };

    Mode mode_ = Mode::SWEEP;
    Direction horizontalDir_ = Direction::RIGHT;
    Direction verticalShiftDir_ = Direction::DOWN;

    // State kept only while WALL_FOLLOW is active.
    Direction followHeading_ = Direction::NONE; // current wall-hugging heading
    int sweepRow_ = 0;                          // row we're trying to get back to
    int hitX_ = 0;                              // column where the sweep was blocked
    Direction resumeDir_ = Direction::RIGHT;    // direction to resume sweeping in
    int wallFollowSteps_ = 0;
    int maxWallFollowSteps_ = 0;

    // Same anti-cycling history used by ZigZagAlgorithm's fallback — see
    // that class for why it's needed.
    static constexpr size_t kRecentHistorySize = 12;
    std::vector<std::pair<int, int>> recentCells_;
    void recordVisit(int x, int y);
    bool isRecent(int x, int y) const;

    // Stagnation detector: counts steps since the last time a *new* cell
    // was cleaned. A high count means the rover is moving but not covering
    // new floor (e.g. oscillating between two already-swept rows).
    int lastCleanedCount_ = -1;
    int stepsSinceProgress_ = 0;
    int stagnationThreshold_ = 0;
    void updateProgress(const Grid& grid);

    Direction pickFallbackMove(const Grid& grid, const RoverState& rover) const;
};
