#include "RandomWalkAlgorithm.h"
#include "NavUtils.h"
#include <vector>
#include <algorithm>

RandomWalkAlgorithm::RandomWalkAlgorithm(unsigned int seed) : rng_(seed) {}

void RandomWalkAlgorithm::reset(const Grid& grid, const RoverState& /*rover*/) {
    currentDir_ = Direction::NONE;
    runRemaining_ = 0;
    maxRunLength_ = std::max(1, std::max(grid.getWidth(), grid.getHeight()));
}

Direction RandomWalkAlgorithm::getNextMove(const Grid& grid, const RoverState& rover) {
    if (currentDir_ != Direction::NONE && runRemaining_ > 0 &&
        canStep(grid, rover.x, rover.y, currentDir_)) {
        --runRemaining_;
        return currentDir_; // keep travelling in a straight line
    }

    // Blocked, run finished, or just starting — gather every direction that is
    // currently open and pick one uniformly at random.
    std::vector<Direction> options;
    const Direction dirs[4] = {Direction::UP, Direction::DOWN, Direction::LEFT, Direction::RIGHT};
    for (Direction d : dirs) {
        if (canStep(grid, rover.x, rover.y, d)) options.push_back(d);
    }

    if (options.empty()) {
        currentDir_ = Direction::NONE;
        return Direction::NONE;
    }

    std::uniform_int_distribution<size_t> dist(0, options.size() - 1);
    currentDir_ = options[dist(rng_)];
    std::uniform_int_distribution<int> runDist(1, maxRunLength_);
    runRemaining_ = runDist(rng_) - 1; // this call already takes the first step
    return currentDir_;
}
