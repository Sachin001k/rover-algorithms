#include "ZigZagAlgorithm.h"
#include "NavUtils.h"

void ZigZagAlgorithm::reset(const Grid& /*grid*/, const RoverState& /*rover*/) {
    mode_ = Mode::SWEEP;
    horizontalDir_ = Direction::RIGHT;
    verticalShiftDir_ = Direction::DOWN;
    recentCells_.clear();
}

void ZigZagAlgorithm::recordVisit(int x, int y) {
    recentCells_.push_back({x, y});
    if (recentCells_.size() > kRecentHistorySize) {
        recentCells_.erase(recentCells_.begin());
    }
}

bool ZigZagAlgorithm::isRecent(int x, int y) const {
    for (const auto& p : recentCells_) {
        if (p.first == x && p.second == y) return true;
    }
    return false;
}

Direction ZigZagAlgorithm::pickFallbackMove(const Grid& grid, const RoverState& rover) const {
    const Direction dirs[4] = {Direction::UP, Direction::DOWN, Direction::LEFT, Direction::RIGHT};

    // Tier 1: unvisited and not recently visited — genuine forward progress.
    for (Direction d : dirs) {
        if (!canStep(grid, rover.x, rover.y, d)) continue;
        int nx, ny;
        applyStep(rover.x, rover.y, d, nx, ny);
        if (!grid.isCleaned(nx, ny) && !isRecent(nx, ny)) return d;
    }
    // Tier 2: not recently visited, even if already cleaned — still breaks a cycle.
    for (Direction d : dirs) {
        if (!canStep(grid, rover.x, rover.y, d)) continue;
        int nx, ny;
        applyStep(rover.x, rover.y, d, nx, ny);
        if (!isRecent(nx, ny)) return d;
    }
    // Tier 3: unvisited, even if it happens to be in recent history.
    for (Direction d : dirs) {
        if (!canStep(grid, rover.x, rover.y, d)) continue;
        int nx, ny;
        applyStep(rover.x, rover.y, d, nx, ny);
        if (!grid.isCleaned(nx, ny)) return d;
    }
    // Tier 4: anything accessible at all.
    for (Direction d : dirs) {
        if (canStep(grid, rover.x, rover.y, d)) return d;
    }
    return Direction::NONE; // fully enclosed, nothing reachable at all
}

Direction ZigZagAlgorithm::getNextMove(const Grid& grid, const RoverState& rover) {
    recordVisit(rover.x, rover.y);

    if (mode_ == Mode::SWEEP) {
        if (canStep(grid, rover.x, rover.y, horizontalDir_)) {
            return horizontalDir_;
        }
        // Blocked mid-row: try to shift down (or up) one row next.
        mode_ = Mode::SHIFT;
    }

    // mode_ == Mode::SHIFT
    if (canStep(grid, rover.x, rover.y, verticalShiftDir_)) {
        horizontalDir_ = oppositeDirection(horizontalDir_);
        mode_ = Mode::SWEEP;
        return verticalShiftDir_;
    }

    // Preferred shift direction is blocked (e.g. reached the bottom/top of
    // the room) — try the opposite vertical direction instead.
    Direction otherVertical = oppositeDirection(verticalShiftDir_);
    if (canStep(grid, rover.x, rover.y, otherVertical)) {
        verticalShiftDir_ = otherVertical;
        horizontalDir_ = oppositeDirection(horizontalDir_);
        mode_ = Mode::SWEEP;
        return verticalShiftDir_;
    }

    // Both the sweep and the shift are blocked — an obstacle has broken the
    // pattern. Fall back to a local move, then go straight back to trying
    // to SWEEP next call (rather than staying latched in SHIFT), so the
    // rover resumes systematic coverage as soon as it possibly can.
    mode_ = Mode::SWEEP;
    return pickFallbackMove(grid, rover);
}
