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

    // Stagnation recovery (shared with ZigZagAlgorithm): wall-following only
    // makes sense next to an obstacle, so a stall on open floor — or a
    // wall-follow loop that keeps rejoining already-swept rows — is resolved
    // by walking the shortest path to the nearest uncleaned cell instead.
    if (stepsSinceProgress_ >= stagnationThreshold_) {
        mode_ = Mode::SWEEP;
        return firstStepTowardNearestUncleaned(grid, rover.x, rover.y);
    }

    if (mode_ == Mode::SWEEP) {
        if (canStep(grid, rover.x, rover.y, horizontalDir_)) {
            return horizontalDir_;
        }
        mode_ = Mode::SHIFT;
    }

    if (mode_ == Mode::SHIFT) {
        if (canStep(grid, rover.x, rover.y, verticalShiftDir_)) {
            horizontalDir_ = oppositeDirection(horizontalDir_);
            mode_ = Mode::SWEEP;
            return verticalShiftDir_;
        }
        Direction otherVertical = oppositeDirection(verticalShiftDir_);
        if (canStep(grid, rover.x, rover.y, otherVertical)) {
            verticalShiftDir_ = otherVertical;
            horizontalDir_ = oppositeDirection(horizontalDir_);
            mode_ = Mode::SWEEP;
            return verticalShiftDir_;
        }

        // Sweep and shift are both blocked by an obstacle: start hugging
        // its boundary. Heading = turnLeft(blocked direction) puts the
        // obstacle on the rover's right, which is what the right-hand rule
        // below assumes (starting with it straight ahead made the rule turn
        // right into open floor and circle on the spot).
        mode_ = Mode::WALL_FOLLOW;
        sweepRow_ = rover.y;
        hitX_ = rover.x;
        resumeDir_ = horizontalDir_;
        followHeading_ = turnLeft(horizontalDir_);
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
    // interrupted sweep line on the FAR side of the obstacle — if so, hand
    // control back to SWEEP mode. Without the "past hitX_" test this fired
    // one cell before the obstacle, sending the rover straight back into it
    // (an endless 2-cell oscillation).
    int nx, ny;
    applyStep(rover.x, rover.y, chosen, nx, ny);
    bool pastObstacle = (resumeDir_ == Direction::RIGHT) ? nx > hitX_ : nx < hitX_;
    if (ny == sweepRow_ && pastObstacle && canStep(grid, nx, ny, resumeDir_)) {
        mode_ = Mode::SWEEP;
        horizontalDir_ = resumeDir_;
    }

    return chosen;
}
