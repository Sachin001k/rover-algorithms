#pragma once

#include "Algorithm.h"
#include <random>

// Stochastic baseline (section 2.4.1): travel in a straight line until
// blocked, then pick a new direction uniformly at random among the
// currently accessible ones.
class RandomWalkAlgorithm : public Algorithm {
public:
    explicit RandomWalkAlgorithm(unsigned int seed);

    virtual void reset(const Grid& grid, const RoverState& rover) override;
    virtual Direction getNextMove(const Grid& grid, const RoverState& rover) override;
    virtual std::string getName() const override { return "RandomWalk"; }

private:
    std::mt19937 rng_;
    Direction currentDir_ = Direction::NONE;
};
