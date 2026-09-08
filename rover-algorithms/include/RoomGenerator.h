#pragma once

#include "Grid.h"
#include <random>

// Matches section 2.3: three levels of room complexity, driven by how many
// rectangular "furniture" obstacles are scattered through the grid.
enum class ComplexityLevel { SIMPLE, MODERATE, COMPLEX };

struct RoomConfig {
    int width;
    int height;
    ComplexityLevel level;
    unsigned int seed;
};

class RoomGenerator {
public:
    // Builds a room of the requested size/complexity and reports a starting
    // cell (startX, startY) guaranteed to be accessible.
    //
    // Any FREE cell that ends up unreachable from the start position (e.g.
    // sealed off behind obstacles) is converted to OBSTACLE, so
    // grid.countAccessibleCells() always equals the cells a rover could
    // actually ever reach. This keeps coverage-percentage metrics honest
    // without needing a generate-and-retry loop.
    static Grid generateRoom(const RoomConfig& config, int& startX, int& startY);

private:
    // densityFraction is the target share of the room's total area to cover
    // with obstacles (e.g. 0.15 = 15%), not a raw obstacle count — obstacle
    // rectangles are fixed, furniture-scale sizes independent of room size.
    static void placeObstacles(Grid& grid, double densityFraction, std::mt19937& rng);
    static void sealUnreachablePockets(Grid& grid, int startX, int startY);
    static double densityFractionFor(ComplexityLevel level);
};
