#include "ZigZagWallFollowHybrid.h"
#include "NavUtils.h"

void ZigZagWallFollowHybrid::reset(const Grid& grid, const RoverState& /*rover*/) {
    mode_ = Mode::SWEEP;
    horizontalDir_ = Direction::RIGHT;
    verticalShiftDir_ = Direction::DOWN;
    wallFollowSteps_ = 0;
    recentCells_.clear();
    lastCleanedCount_ = -1;
    stepsSinceProgress_ = 0;
    stagnationThreshold_ = 2 * (grid.getWidth() + grid.getHeight());
}

void ZigZagWallFollowHybrid::updateProgress(const Grid& grid) {
    int cleaned = grid.countCleanedCells();
    if (cleaned > lastCleanedCount_) {
        stepsSinceProgress_ = 0;
    } else {
        ++stepsSinceProgress_;
    }
    lastCleanedCount_ = cleaned;
}

void ZigZagWallFollowHybrid::recordVisit(int x, int y) {
    recentCells_.push_back({x, y});
    if (recentCells_.size() > kRecentHistorySize) {
        recentCells_.erase(recentCells_.begin());
    }
}

bool ZigZagWallFollowHybrid::isRecent(int x, int y) const {
    for (const auto& p : recentCells_) {
        if (p.first == x && p.second == y) return true;
    }
    return false;
}

Direction ZigZagWallFollowHybrid::pickFallbackMove(const Grid& grid, const RoverState& rover) const {
    const Direction dirs[4] = {Direction::UP, Direction::DOWN, Direction::LEFT, Direction::RIGHT};

    for (Direction d : dirs) {
        if (!canStep(grid, rover.x, rover.y, d)) continue;
        int nx, ny;
        applyStep(rover.x, rover.y, d, nx, ny);
        if (!grid.isCleaned(nx, ny) && !isRecent(nx, ny)) return d;
    }
    for (Direction d : dirs) {
        if (!canStep(grid, rover.x, rover.y, d)) continue;
        int nx, ny;
        applyStep(rover.x, rover.y, d, nx, ny);
        if (!isRecent(nx, ny)) return d;
    }
    for (Direction d : dirs) {
        if (!canStep(grid, rover.x, rover.y, d)) continue;
        int nx, ny;
        applyStep(rover.x, rover.y, d, nx, ny);
        if (!grid.isCleaned(nx, ny)) return d;
    }
    for (Direction d : dirs) {
        if (canStep(grid, rover.x, rover.y, d)) return d;
    }
    return Direction::NONE;
}

Direction ZigZagWallFollowHybrid::getNextMove(const Grid& grid, const RoverState& rover) {
    recordVisit(rover.x, rover.y);
    updateProgress(grid);
    bool stagnant = stepsSinceProgress_ >= stagnationThreshold_;

    if (mode_ == Mode::SWEEP) {
        if (!stagnant && canStep(grid, rover.x, rover.y, horizontalDir_)) {
            return horizontalDir_;
        }
        mode_ = Mode::SHIFT;
    }

    if (mode_ == Mode::SHIFT) {
        if (!stagnant && canStep(grid, rover.x, rover.y, verticalShiftDir_)) {
            horizontalDir_ = oppositeDirection(horizontalDir_);
            mode_ = Mode::SWEEP;
            return verticalShiftDir_;
        }
        Direction otherVertical = oppositeDirection(verticalShiftDir_);
        if (!stagnant && canStep(grid, rover.x, rover.y, otherVertical)) {
            verticalShiftDir_ = otherVertical;
            horizontalDir_ = oppositeDirection(horizontalDir_);
            mode_ = Mode::SWEEP;
            return verticalShiftDir_;
        }

        // Sweep and shift are both blocked by an obstacle — or the sweep
        // has stagnated without covering new floor: start hugging the
        // nearest boundary instead of continuing to stall/oscillate.
        mode_ = Mode::WALL_FOLLOW;
        sweepRow_ = rover.y;
        resumeDir_ = horizontalDir_;
        followHeading_ = horizontalDir_;
        wallFollowSteps_ = 0;
        maxWallFollowSteps_ = 2 * (grid.getWidth() + grid.getHeight());
        // fall through to WALL_FOLLOW handling below
    }

    // mode_ == Mode::WALL_FOLLOW
    ++wallFollowSteps_;
    if (wallFollowSteps_ > maxWallFollowSteps_) {
        // Boundary too large / re-entry point never found — bail out and
        // go straight back to trying to SWEEP, same reasoning as
        // ZigZagAlgorithm's fallback (avoid getting permanently latched
        // into recovery-mode logic instead of resuming systematic coverage).
        mode_ = Mode::SWEEP;
        return pickFallbackMove(grid, rover);
    }

    // Right-hand-rule wall hug: prefer hugging the obstacle closely (turn
    // right), then straight ahead, then turn left, and only reverse as a
    // last resort.
    const Direction candidates[4] = {
        turnRight(followHeading_),
        followHeading_,
        turnLeft(followHeading_),
        oppositeDirection(followHeading_)
    };

    Direction chosen = Direction::NONE;
    for (Direction c : candidates) {
        if (canStep(grid, rover.x, rover.y, c)) {
            chosen = c;
            break;
        }
    }

    if (chosen == Direction::NONE) {
        mode_ = Mode::SWEEP;
        return pickFallbackMove(grid, rover);
    }

    followHeading_ = chosen;

    // Check whether the cell we're about to land on lets us rejoin the
    // interrupted sweep line — if so, hand control back to SWEEP mode.
    int nx, ny;
    applyStep(rover.x, rover.y, chosen, nx, ny);
    if (ny == sweepRow_ && canStep(grid, nx, ny, resumeDir_)) {
        mode_ = Mode::SWEEP;
        horizontalDir_ = resumeDir_;
    }

    return chosen;
}
