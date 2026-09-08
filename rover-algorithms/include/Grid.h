#pragma once

#include <vector>
#include <string>
using namespace std;
// A cell in the simulated room is either free floor, floor the rover has
// already cleaned, or an obstacle (furniture / wall interior) it cannot
// enter. This mirrors the three-state grid described in the methodology.
enum class CellState { FREE, CLEANED, OBSTACLE };

class Grid {
public:
    Grid(int width, int height);

    int getWidth() const { return width_; }
    int getHeight() const { return height_; }

    bool isInBounds(int x, int y) const;
    bool isObstacle(int x, int y) const;

    // "Accessible" = inside the room AND not an obstacle (FREE or CLEANED).
    bool isAccessible(int x, int y) const;

    CellState getState(int x, int y) const;
    void setState(int x, int y, CellState state);

    void markCleaned(int x, int y);
    bool isCleaned(int x, int y) const;

    int countAccessibleCells() const;
    int countCleanedCells() const;

    // Percentage of accessible floor that has been cleaned so far.
    double coveragePercent() const;

    // Debug helper: prints the room to stdout.
    // '#' = obstacle, '.' = uncleaned floor, 'o' = cleaned floor, 'R' = rover.
    void printAscii(int roverX = -1, int roverY = -1) const;

private:
    int width_;
    int height_;
    vector<vector<CellState>> cells_; // cells_[y][x]

    // Maintained incrementally by setState() so countAccessibleCells() /
    // countCleanedCells() are O(1) instead of an O(width*height) scan.
    // This matters because Simulation checks coveragePercent() every single
    // step, potentially hundreds of thousands of times per run.
    int accessibleCount_;
    int cleanedCount_;
};
