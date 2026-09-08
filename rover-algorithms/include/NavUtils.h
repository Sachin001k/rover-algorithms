#pragma once

#include "Grid.h"
#include "Direction.h"

// True if stepping one cell from (x, y) in `dir` lands on an accessible cell.
inline bool canStep(const Grid& grid, int x, int y, Direction dir) {
    int dx, dy;
    directionDelta(dir, dx, dy);
    return grid.isAccessible(x + dx, y + dy);
}

// Computes the destination cell of a step without mutating anything.
inline void applyStep(int x, int y, Direction dir, int& nx, int& ny) {
    int dx, dy;
    directionDelta(dir, dx, dy);
    nx = x + dx;
    ny = y + dy;
}
