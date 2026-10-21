#pragma once

#include "Grid.h"
#include "Direction.h"
#include <queue>
#include <utility>
#include <vector>

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

// BFS over accessible cells from (x, y); returns the FIRST step of a
// shortest path to the nearest uncleaned cell, or NONE if every reachable
// cell is already cleaned. Deterministic (fixed neighbour order), so
// calling it again on the next step continues along the same path.
// Used as the last-resort recovery that guarantees the deterministic
// strategies can't cycle forever between already-cleaned cells.
inline Direction firstStepTowardNearestUncleaned(const Grid& grid, int x, int y) {
    const int w = grid.getWidth();
    const int h = grid.getHeight();
    const Direction dirs[4] = {Direction::UP, Direction::DOWN, Direction::LEFT, Direction::RIGHT};

    // firstDir[cell] = the move out of (x, y) that started the path to cell.
    std::vector<Direction> firstDir(static_cast<size_t>(w) * h, Direction::NONE);
    std::vector<bool> seen(static_cast<size_t>(w) * h, false);
    std::queue<std::pair<int, int>> q;
    seen[static_cast<size_t>(y) * w + x] = true;
    q.push({x, y});

    while (!q.empty()) {
        auto [cx, cy] = q.front();
        q.pop();
        for (Direction d : dirs) {
            int nx, ny;
            applyStep(cx, cy, d, nx, ny);
            if (!grid.isAccessible(nx, ny)) continue;
            size_t idx = static_cast<size_t>(ny) * w + nx;
            if (seen[idx]) continue;
            seen[idx] = true;
            firstDir[idx] = (cx == x && cy == y) ? d : firstDir[static_cast<size_t>(cy) * w + cx];
            if (!grid.isCleaned(nx, ny)) return firstDir[idx];
            q.push({nx, ny});
        }
    }
    return Direction::NONE;
}
