#include "RoomGenerator.h"
#include <queue>
#include <algorithm>

double RoomGenerator::densityFractionFor(ComplexityLevel level) {
    // Target share of total room area covered by obstacles.
    switch (level) {
        case ComplexityLevel::SIMPLE:   return 0.06;
        case ComplexityLevel::MODERATE: return 0.15;
        case ComplexityLevel::COMPLEX:  return 0.28;
    }
    return 0.10;
}

Grid RoomGenerator::generateRoom(const RoomConfig& config, int& startX, int& startY) {
    double densityFraction = densityFractionFor(config.level);
    double area = static_cast<double>(config.width) * static_cast<double>(config.height);
    double expectedFreeCells = area * (1.0 - densityFraction);

    Grid grid(config.width, config.height);
    const int maxAttempts = 6;

    for (int attempt = 0; attempt < maxAttempts; ++attempt) {
        grid = Grid(config.width, config.height);
        std::mt19937 rng(config.seed + static_cast<unsigned int>(attempt) * 7919u);

        placeObstacles(grid, densityFraction, rng);

        // Start near the top-left corner, at the first accessible cell found.
        startX = 0;
        startY = 0;
        bool found = false;
        for (int y = 0; y < grid.getHeight() && !found; ++y) {
            for (int x = 0; x < grid.getWidth() && !found; ++x) {
                if (grid.isAccessible(x, y)) {
                    startX = x;
                    startY = y;
                    found = true;
                }
            }
        }
        if (!found) continue; // pathological, retry with a fresh layout

        sealUnreachablePockets(grid, startX, startY);

        // If obstacle placement accidentally sealed off most of the room,
        // regenerate rather than handing back a near-unusable layout.
        if (grid.countAccessibleCells() >= 0.5 * expectedFreeCells) {
            return grid;
        }
    }

    return grid; // best effort after maxAttempts retries
}

void RoomGenerator::placeObstacles(Grid& grid, double densityFraction, std::mt19937& rng) {
    int width = grid.getWidth();
    int height = grid.getHeight();
    double totalArea = static_cast<double>(width) * static_cast<double>(height);
    double areaBudget = totalArea * densityFraction;

    // Fixed, furniture-scale obstacle footprints (in grid cells) regardless
    // of room size — a couch doesn't get bigger just because the room does.
    std::uniform_int_distribution<int> obstacleW(2, 4);
    std::uniform_int_distribution<int> obstacleH(2, 3);

    double placedArea = 0.0;
    int attempts = 0;
    const int maxAttempts = 5000;

    while (placedArea < areaBudget && attempts < maxAttempts) {
        ++attempts;
        int w = obstacleW(rng);
        int h = obstacleH(rng);

        // Leave at least a 1-cell margin so obstacles never touch the wall
        // on both sides of a corridor and seal it shut by construction.
        if (w >= width - 2 || h >= height - 2) continue;

        std::uniform_int_distribution<int> xDist(0, width - w - 1);
        std::uniform_int_distribution<int> yDist(0, height - h - 1);
        int ox = xDist(rng);
        int oy = yDist(rng);

        for (int y = oy; y < oy + h; ++y) {
            for (int x = ox; x < ox + w; ++x) {
                grid.setState(x, y, CellState::OBSTACLE);
            }
        }
        placedArea += static_cast<double>(w * h);
    }
}

void RoomGenerator::sealUnreachablePockets(Grid& grid, int startX, int startY) {
    int width = grid.getWidth();
    int height = grid.getHeight();
    std::vector<std::vector<bool>> visited(height, std::vector<bool>(width, false));

    if (!grid.isAccessible(startX, startY)) return; // nothing to flood from

    std::queue<std::pair<int, int>> q;
    q.push({startX, startY});
    visited[startY][startX] = true;

    const int dx[4] = {0, 0, -1, 1};
    const int dy[4] = {-1, 1, 0, 0};

    while (!q.empty()) {
        auto [x, y] = q.front();
        q.pop();
        for (int d = 0; d < 4; ++d) {
            int nx = x + dx[d];
            int ny = y + dy[d];
            if (grid.isAccessible(nx, ny) && !visited[ny][nx]) {
                visited[ny][nx] = true;
                q.push({nx, ny});
            }
        }
    }

    // Any accessible cell never reached by the flood fill is a sealed
    // pocket the rover could never physically enter — treat it as an
    // obstacle so it does not inflate the "accessible cells" denominator.
    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            if (grid.isAccessible(x, y) && !visited[y][x]) {
                grid.setState(x, y, CellState::OBSTACLE);
            }
        }
    }
}
