#pragma once

#include "Direction.h"

// Tracks everything the simulation needs to know about the rover's progress.
// Deliberately a plain struct (no behaviour) — algorithms read it, and
// Simulation is the only thing allowed to mutate it during a run.
struct RoverState {
    int x;
    int y;
    Direction lastDirection = Direction::NONE;

    long steps = 0;    // valid movement steps taken so far
    long revisits = 0; // steps that landed on an already-cleaned cell
    long turns = 0;    // direction changes (a simple proxy for manoeuvring cost)

    RoverState(int startX, int startY) : x(startX), y(startY) {}
};
