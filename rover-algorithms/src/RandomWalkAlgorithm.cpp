#include "RandomWalkAlgorithm.h"
#include "NavUtils.h"
#include <vector>

RandomWalkAlgorithm::RandomWalkAlgorithm(unsigned int seed) : rng_(seed) {}

void RandomWalkAlgorithm::reset(const Grid& /*grid*/, const RoverState& /*rover*/) {
    currentDir_ = Direction::NONE;
}

Direction RandomWalkAlgorithm::getNextMove(const Grid& grid, const RoverState& rover) {
    if (currentDir_ != Direction::NONE && canStep(grid, rover.x, rover.y, currentDir_)) {
        return currentDir_; // keep travelling in a straight line
    }

    // Blocked (or just starting) — gather every direction that is
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
    return currentDir_;
}
