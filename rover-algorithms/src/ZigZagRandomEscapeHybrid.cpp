#include "ZigZagRandomEscapeHybrid.h"
#include "NavUtils.h"
#include <vector>

ZigZagRandomEscapeHybrid::ZigZagRandomEscapeHybrid(unsigned int seed) : rng_(seed) {}

void ZigZagRandomEscapeHybrid::reset(const Grid& grid, const RoverState& /*rover*/) {
    mode_ = Mode::SWEEP;
    horizontalDir_ = Direction::RIGHT;
    verticalShiftDir_ = Direction::DOWN;
    escapeSteps_ = 0;
    lastCleanedCount_ = -1;
    stepsSinceProgress_ = 0;
    stagnationThreshold_ = 2 * (grid.getWidth() + grid.getHeight());
}

void ZigZagRandomEscapeHybrid::updateProgress(const Grid& grid) {
    int cleaned = grid.countCleanedCells();
    if (cleaned > lastCleanedCount_) {
        stepsSinceProgress_ = 0;
    } else {
        ++stepsSinceProgress_;
    }
    lastCleanedCount_ = cleaned;
}

Direction ZigZagRandomEscapeHybrid::pickFallbackMove(const Grid& grid, const RoverState& rover) const {
    const Direction dirs[4] = {Direction::UP, Direction::DOWN, Direction::LEFT, Direction::RIGHT};
    for (Direction d : dirs) {
        if (d == oppositeDirection(rover.lastDirection)) continue;
        if (canStep(grid, rover.x, rover.y, d)) return d;
    }
    for (Direction d : dirs) {
        if (canStep(grid, rover.x, rover.y, d)) return d;
    }
    return Direction::NONE;
}

Direction ZigZagRandomEscapeHybrid::getNextMove(const Grid& grid, const RoverState& rover) {
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

        // Fully blocked, or stagnating without covering new floor — escape
        // randomly rather than continuing to stall/oscillate.
        mode_ = Mode::RANDOM_ESCAPE;
        escapeSteps_ = 0;
        // fall through to RANDOM_ESCAPE handling below
    }

    // mode_ == Mode::RANDOM_ESCAPE
    const Direction dirs[4] = {Direction::UP, Direction::DOWN, Direction::LEFT, Direction::RIGHT};

    // Bias towards unvisited neighbours where possible, matching the
    // description of the rover heading towards "an unvisited or suitable
    // re-entry region".
    std::vector<Direction> unvisited;
    std::vector<Direction> anyAccessible;
    for (Direction d : dirs) {
        if (canStep(grid, rover.x, rover.y, d)) {
            anyAccessible.push_back(d);
            int nx, ny;
            applyStep(rover.x, rover.y, d, nx, ny);
            if (!grid.isCleaned(nx, ny)) unvisited.push_back(d);
        }
    }

    if (anyAccessible.empty()) {
        return Direction::NONE; // truly enclosed
    }

    const std::vector<Direction>& pool = !unvisited.empty() ? unvisited : anyAccessible;
    std::uniform_int_distribution<size_t> dist(0, pool.size() - 1);
    Direction chosen = pool[dist(rng_)];

    ++escapeSteps_;

    // After enough escape steps, check whether the destination re-opens
    // the original sweep direction; if so, resume systematic coverage.
    int nx, ny;
    applyStep(rover.x, rover.y, chosen, nx, ny);
    bool canResume = canStep(grid, nx, ny, horizontalDir_);

    if ((escapeSteps_ >= minEscapeSteps_ && canResume) || escapeSteps_ >= maxEscapeSteps_) {
        mode_ = Mode::SWEEP;
    }

    return chosen;
}
