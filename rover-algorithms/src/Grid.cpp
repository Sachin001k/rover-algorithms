#include "Grid.h"
#include <iostream>

Grid::Grid(int width, int height)
    : width_(width),
      height_(height),
      cells_(height, std::vector<CellState>(width, CellState::FREE)),
      accessibleCount_(width * height),
      cleanedCount_(0) {}

bool Grid::isInBounds(int x, int y) const {
    return x >= 0 && x < width_ && y >= 0 && y < height_;
}

bool Grid::isObstacle(int x, int y) const {
    if (!isInBounds(x, y)) return true; // treat out-of-bounds as an obstacle
    return cells_[y][x] == CellState::OBSTACLE;
}

bool Grid::isAccessible(int x, int y) const {
    return isInBounds(x, y) && cells_[y][x] != CellState::OBSTACLE;
}

CellState Grid::getState(int x, int y) const {
    return cells_[y][x];
}

void Grid::setState(int x, int y, CellState state) {
    if (!isInBounds(x, y)) return;

    CellState oldState = cells_[y][x];
    if (oldState == state) return;

    bool wasAccessible = (oldState != CellState::OBSTACLE);
    bool willBeAccessible = (state != CellState::OBSTACLE);
    if (wasAccessible && !willBeAccessible) --accessibleCount_;
    if (!wasAccessible && willBeAccessible) ++accessibleCount_;

    bool wasCleaned = (oldState == CellState::CLEANED);
    bool willBeCleaned = (state == CellState::CLEANED);
    if (wasCleaned && !willBeCleaned) --cleanedCount_;
    if (!wasCleaned && willBeCleaned) ++cleanedCount_;

    cells_[y][x] = state;
}

void Grid::markCleaned(int x, int y) {
    if (isAccessible(x, y)) {
        setState(x, y, CellState::CLEANED);
    }
}

bool Grid::isCleaned(int x, int y) const {
    return isInBounds(x, y) && cells_[y][x] == CellState::CLEANED;
}

int Grid::countAccessibleCells() const {
    return accessibleCount_;
}

int Grid::countCleanedCells() const {
    return cleanedCount_;
}

double Grid::coveragePercent() const {
    if (accessibleCount_ == 0) return 100.0;
    return 100.0 * static_cast<double>(cleanedCount_) / static_cast<double>(accessibleCount_);
}

void Grid::printAscii(int roverX, int roverY) const {
    for (int y = 0; y < height_; ++y) {
        for (int x = 0; x < width_; ++x) {
            if (x == roverX && y == roverY) {
                std::cout << 'R';
                continue;
            }
            switch (cells_[y][x]) {
                case CellState::OBSTACLE: std::cout << '#'; break;
                case CellState::CLEANED:  std::cout << 'o'; break;
                case CellState::FREE:     std::cout << '.'; break;
            }
        }
        std::cout << '\n';
    }
}
