#pragma once

#include "Grid.h"
#include "Rover.h"
#include <string>
using namespace std;
// Common interface for every coverage path-planning strategy (section 2.4).
// An Algorithm only *decides* the next move; Simulation is responsible for
// actually applying it and updating metrics. This keeps the strategies easy
// to swap in and out of the same simulation loop.
class Algorithm {
public:
    virtual ~Algorithm() = default;

    // Called once at the start of a run so stateful algorithms (Zig-Zag and
    // its hybrids) can reset their internal sweep state.
    virtual void reset(const Grid& grid, const RoverState& rover) = 0;

    // Returns the direction to move next. Returning Direction::NONE tells
    // the simulation the algorithm has given up (e.g. rover fully enclosed).
    virtual Direction getNextMove(const Grid& grid, const RoverState& rover) = 0;

    virtual string getName() const = 0;
};
