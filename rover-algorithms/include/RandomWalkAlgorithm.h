#pragma once

#include "Algorithm.h"
#include <random>

// Stochastic baseline (section 2.4.1): travel in a straight line until
// blocked, then pick a new direction uniformly at random among the
// currently accessible ones.
//
// Each straight run also gets a random length (1..max(width, height)).
// A real bump-and-turn robot leaves an obstacle at a random *angle*; on a
// 4-direction grid with no run limit the only way to leave a wall is
// straight across to the opposite wall, so the rover never reached the
// room interior (coverage capped at ~the perimeter). The random run length
// is the grid equivalent of a random bounce angle.
class RandomWalkAlgorithm : public Algorithm {
public:
    explicit RandomWalkAlgorithm(unsigned int seed);

    virtual void reset(const Grid& grid, const RoverState& rover) override;
    virtual Direction getNextMove(const Grid& grid, const RoverState& rover) override;
    virtual std::string getName() const override { return "RandomWalk"; }

private:
    std::mt19937 rng_;
    Direction currentDir_ = Direction::NONE;
    int runRemaining_ = 0; // steps left in the current straight run
    int maxRunLength_ = 1;
};
