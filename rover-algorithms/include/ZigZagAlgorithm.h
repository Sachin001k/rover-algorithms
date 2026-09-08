#pragma once

#include "Algorithm.h"
#include <vector>
#include <utility>

// Deterministic baseline (section 2.4.2 / 1.3.1): sweep in one horizontal
// direction until blocked, shift one row, reverse horizontal direction,
// repeat. When both the sweep and the shift are blocked (an obstacle has
// interrupted the pattern) it falls back to picking any accessible
// neighbour so the run doesn't stall — this fallback is what the write-up
// describes as Zig-Zag's obstacle-navigation weakness.
class ZigZagAlgorithm : public Algorithm {
public:
    void reset(const Grid& grid, const RoverState& rover) override;
    Direction getNextMove(const Grid& grid, const RoverState& rover) override;
    std::string getName() const override { return "ZigZag"; }

protected:
    enum class Mode { SWEEP, SHIFT };

    Mode mode_ = Mode::SWEEP;
    Direction horizontalDir_ = Direction::RIGHT;
    Direction verticalShiftDir_ = Direction::DOWN;

    // Short history of recently-visited cells, used only to keep the
    // fallback move below from oscillating in a 2-3 cell loop when it's
    // deciding on its own (a deterministic "prefer unvisited neighbour"
    // rule can otherwise walk itself into a stable cycle).
    static constexpr size_t kRecentHistorySize = 12;
    std::vector<std::pair<int, int>> recentCells_;
    void recordVisit(int x, int y);
    bool isRecent(int x, int y) const;

    // Shared fallback used when neither sweeping nor shifting is possible.
    // Prefers an unvisited, non-recently-visited neighbour; degrades
    // gracefully down to "any accessible neighbour" if nothing better exists.
    Direction pickFallbackMove(const Grid& grid, const RoverState& rover) const;
};
