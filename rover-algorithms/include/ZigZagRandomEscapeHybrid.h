#pragma once

#include "Algorithm.h"
#include <random>

// Hybrid #2 (section 2.4.4): behaves like ZigZagAlgorithm on open floor.
// It takes a short, randomised "escape" walk (biased towards unvisited
// cells) whenever either (a) the sweep and the row-shift are both blocked,
// or (b) it has gone a long stretch without cleaning any new cell — the
// second trigger catches the case where a plain Zig-Zag isn't literally
// blocked but is oscillating between already-cleaned rows and making no
// real progress. Once a spot is reached where the interrupted sweep
// direction is open again, it resumes systematic Zig-Zag coverage.
class ZigZagRandomEscapeHybrid : public Algorithm {
public:
    explicit ZigZagRandomEscapeHybrid(unsigned int seed);

    void reset(const Grid& grid, const RoverState& rover) override;
    Direction getNextMove(const Grid& grid, const RoverState& rover) override;
    std::string getName() const override { return "ZigZag+RandomEscape"; }

private:
    enum class Mode { SWEEP, SHIFT, RANDOM_ESCAPE };

    std::mt19937 rng_;

    Mode mode_ = Mode::SWEEP;
    Direction horizontalDir_ = Direction::RIGHT;
    Direction verticalShiftDir_ = Direction::DOWN;

    int escapeSteps_ = 0;
    int minEscapeSteps_ = 3;   // don't even check for re-entry before this many steps
    int maxEscapeSteps_ = 20;  // force a resume attempt after this many steps

    // Stagnation detector — see ZigZagWallFollowHybrid for the rationale.
    int lastCleanedCount_ = -1;
    int stepsSinceProgress_ = 0;
    int stagnationThreshold_ = 0;
    void updateProgress(const Grid& grid);

    Direction pickFallbackMove(const Grid& grid, const RoverState& rover) const;
};
