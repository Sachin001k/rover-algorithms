// Simulation Engine - Main loop and step execution

class Simulator {
    constructor(gridUI, algorithm) {
        this.gridUI = gridUI;
        this.algorithm = algorithm;

        // Rover state
        this.rover = {
            x: gridUI.start.x,
            y: gridUI.start.y,
            steps: 0,
            revisits: 0,
            turns: 0,
            lastDirection: 0
        };

        // Simulation config
        // Same rules as the C++ SimulationConfig so web and CLI results are
        // comparable: keep cleaning until all reachable floor is covered
        // (or the step cap stops it); 90% is the pass mark, and the step at
        // which it was crossed is recorded so both times can be compared.
        this.config = {
            targetCoveragePercent: 100.0,  // "Stop at coverage" (set from the UI)
            minCoveragePercent: 90.0,      // pass mark
            timeLimitSec: 0,               // simulated cleaning time limit; 0 = none
            maxSteps: 1000000,
            cellSizeCm: 20.0,
            roverSpeedCmPerSec: 30.0
        };

        // State tracking
        this.running = false;
        this.paused = false;
        this.startTime = 0;
        this.pausedTime = 0;
        this.animationFrameId = null;
        this.stepQueue = [];
        this.currentAnimationStep = 0;
        this.animationProgress = 0;
        this.speed = 30;  // steps per second
        this.stepBudget = 0;  // fractional steps carried between frames
        this.lastFrameTime = null;

        // Metrics tracking
        this.visitedMap = Array(gridUI.height).fill(null).map(() => Array(gridUI.width).fill(0));
        this.reachableCells = new Set();
        this.unreachableCells = 0;
        this.completionReason = null;  // Track why simulation ended
        this.lastCleanedCellCount = 0;  // For stagnation detection
        this.stepsToMinCoverage = -1;   // first step at which the pass mark was hit
        this.stepsSinceProgress = 0;  // Steps without cleaning new cells

        // Callbacks
        this.onStepComplete = null;
        this.onSimulationComplete = null;
        this.onFrameUpdate = null;
    }

    start() {
        this.running = true;
        this.paused = false;
        this.startTime = Date.now();
        this.pausedTime = 0;
        this.rover.steps = 0;
        this.rover.revisits = 0;
        this.rover.turns = 0;
        this.rover.lastDirection = 0;
        this.lastCleanedCellCount = 1;  // Start with 1 (starting cell)
        this.stepsSinceProgress = 0;
        this.lastProgressCheckStep = 0;  // For aggressive coverage check
        this.lastCoverageCheckValue = 1;  // Cells cleaned at last check

        // Calculate reachable cells using flood-fill
        this.calculateReachableCells();

        // Start from a clean floor (a previous run may have left cleaned
        // cells behind), then mark the start position as cleaned.
        this.gridUI.clearCleaned();
        this.gridUI.resetRover();
        this.gridUI.markCleaned(this.rover.x, this.rover.y);
        this.visitedMap[this.rover.y][this.rover.x]++;

        // Initialize algorithm
        this.algorithm.reset(this.gridUI, this.rover);

        // Start simulation loop
        this.simulationLoop();
    }

    calculateReachableCells() {
        this.reachableCells.clear();
        const visited = Array(this.gridUI.height).fill(null).map(() => Array(this.gridUI.width).fill(false));
        const queue = [[this.rover.x, this.rover.y]];
        visited[this.rover.y][this.rover.x] = true;

        while (queue.length > 0) {
            const [x, y] = queue.shift();
            this.reachableCells.add(`${x},${y}`);

            const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (const [dx, dy] of dirs) {
                const nx = x + dx;
                const ny = y + dy;
                if (this.gridUI.isInBounds(nx, ny) && !visited[ny][nx] && this.gridUI.isAccessible(nx, ny)) {
                    visited[ny][nx] = true;
                    queue.push([nx, ny]);
                }
            }
        }

        // Calculate unreachable cells
        const totalAccessible = this.gridUI.getAccessibleCellCount();
        this.unreachableCells = totalAccessible - this.reachableCells.size;
    }

    // Cleaned cells: the start cell plus one per non-revisit step (O(1)).
    getCleanedCount() {
        return 1 + this.rover.steps - this.rover.revisits;
    }

    // Coverage of the floor the rover can actually reach. Using every
    // non-obstacle cell as the denominator meant sealed-off pockets made
    // the target impossible to hit.
    getCoverage() {
        const reachable = this.reachableCells.size;
        return reachable > 0 ? (this.getCleanedCount() / reachable) * 100 : 100;
    }

    pause() {
        this.paused = true;
        this.pausedTime = Date.now();
    }

    resume() {
        if (this.paused) {
            this.paused = false;
            // Adjust start time to account for pause
            const pauseDuration = Date.now() - this.pausedTime;
            this.startTime += pauseDuration;
            this.lastFrameTime = null;
            this.simulationLoop();
        }
    }

    stop() {
        this.running = false;
        this.paused = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    setSpeed(stepsPerSecond) {
        this.speed = Math.max(1, Math.min(stepsPerSecond, 5000));
    }

    simulationLoop(timestamp) {
        if (!this.running) return;
        if (this.paused) return;

        // Fractional step accumulator driven by real frame time. The old
        // max(1, round(speed / 60)) ran every speed below ~90 at 60 steps/s.
        const now = timestamp !== undefined ? timestamp : performance.now();
        const dt = this.lastFrameTime === null ? 1000 / 60 : Math.max(0, Math.min(now - this.lastFrameTime, 100));
        this.lastFrameTime = now;
        this.stepBudget += this.speed * dt / 1000;
        const stepsPerFrame = Math.floor(this.stepBudget);
        this.stepBudget -= stepsPerFrame;

        for (let i = 0; i < stepsPerFrame; i++) {
            if (!this.step()) {
                // Simulation complete
                this.complete();
                return;
            }
        }

        // Update display
        this.updateDisplay();

        // Continue loop
        this.animationFrameId = requestAnimationFrame((t) => this.simulationLoop(t));
    }

    step() {
        // Check stop conditions
        const coverage = this.getCoverage();

        if (this.stepsToMinCoverage < 0 && coverage >= this.config.minCoveragePercent) {
            this.stepsToMinCoverage = this.rover.steps;
        }

        // STOP CONDITION 1: every reachable cell cleaned
        if (coverage >= 100) {
            this.completionReason = 'PERFECT_COVERAGE';
            return false;
        }

        // STOP CONDITION 2: the chosen "stop at coverage" level (e.g. 99%)
        if (coverage >= this.config.targetCoveragePercent) {
            this.completionReason = 'TARGET_REACHED';
            return false;
        }

        // STOP CONDITION 3: time limit passed and the 90% pass mark is met.
        // Measured in SIMULATED cleaning time (steps × cell ÷ speed), not
        // wall-clock time, so the rule is the same at any playback speed.
        // Below 90% the run continues until it gets there.
        const simTimeSec = this.rover.steps * this.config.cellSizeCm / this.config.roverSpeedCmPerSec;
        if (this.config.timeLimitSec > 0 && simTimeSec >= this.config.timeLimitSec &&
            coverage >= this.config.minCoveragePercent) {
            this.completionReason = 'TIME_LIMIT';
            return false;
        }

        // No "stagnant" stop: every algorithm keeps making progress (the
        // random ones just find the last corner cells slowly), and stopping
        // them early cut legitimate runs short. maxSteps is the only cap,
        // exactly as in the C++ simulator.

        // STOP CONDITION 4: Max steps safety limit
        if (this.rover.steps >= this.config.maxSteps) {
            this.completionReason = 'MAX_STEPS';
            return false;
        }

        // Get next move from algorithm
        const direction = this.algorithm.getNextMove(this.gridUI, this.rover);

        if (direction === 0) {
            this.completionReason = 'ALGORITHM_GAVE_UP';
            return false;
        }

        // Apply move
        const { dx, dy } = this.directionDelta(direction);
        const nx = this.rover.x + dx;
        const ny = this.rover.y + dy;

        // Validate move
        if (!this.gridUI.isAccessible(nx, ny)) {
            this.completionReason = 'INVALID_MOVE';
            return false;
        }

        // Track turns
        if (this.rover.lastDirection !== 0 && direction !== this.rover.lastDirection) {
            this.rover.turns++;
        }

        // Check if revisiting
        const wasAlreadyCleaned = this.gridUI.isCleaned(nx, ny);

        // Update rover position
        this.rover.x = nx;
        this.rover.y = ny;
        this.rover.lastDirection = direction;
        this.rover.steps++;
        if (wasAlreadyCleaned) {
            this.rover.revisits++;
        }

        // Track visit count for heatmap
        this.visitedMap[ny][nx]++;

        // Mark cell as cleaned (the canvas is redrawn once per frame in
        // updateDisplay, not once per step)
        this.gridUI.markCleaned(nx, ny);
        this.gridUI.rover.x = nx;
        this.gridUI.rover.y = ny;
        this.gridUI.rover.direction = direction;

        // Callback
        if (this.onStepComplete) {
            this.onStepComplete({
                step: this.rover.steps,
                x: nx,
                y: ny,
                direction,
                wasAlreadyCleaned
            });
        }

        return true;  // Continue
    }

    complete() {
        this.running = false;

        this.gridUI.draw();
        const coverage = this.getCoverage();
        const elapsed = (Date.now() - this.startTime) / 1000;
        const travelDistance = this.rover.steps * this.config.cellSizeCm;
        const cleaningTime = travelDistance / this.config.roverSpeedCmPerSec;
        const overlapRatio = this.rover.steps > 0 ? this.rover.revisits / this.rover.steps : 0;
        const revisitPercentage = this.rover.steps > 0 ? (this.rover.revisits / this.rover.steps) * 100 : 0;

        // Calculate efficiency metrics
        const cellsCleaned = this.getCleanedCount();
        const accessibleCells = this.gridUI.getAccessibleCellCount();
        const areaExplored = this.reachableCells.size;
        const areaExploredPercent = accessibleCells > 0 ? (this.reachableCells.size / accessibleCells) * 100 : 0;

        // Efficiency score: Coverage / (Steps / 100)
        const efficiencyScore = this.rover.steps > 0 ? coverage / (this.rover.steps / 100) : 0;

        // Performance rating (A+, A, B, C, D)
        const rating = this.getPerformanceRating(coverage, revisitPercentage, areaExploredPercent);

        // Average speed (steps per second)
        const avgSpeed = elapsed > 0 ? (this.rover.steps / elapsed).toFixed(1) : 0;

        // Determine status message
        // A run that stopped before 100% still passes at >= 90%.
        const passed = coverage >= this.config.minCoveragePercent;
        const verdict = passed ? 'passed (≥90%)' : 'below the 90% minimum';
        let status = '⚠️ Incomplete';
        let statusTitle = 'Simulation Ended';

        if (this.completionReason === 'PERFECT_COVERAGE') {
            status = '✅ PERFECT - 100% COVERAGE!';
            statusTitle = 'Everything Covered!';
        } else if (this.completionReason === 'TARGET_REACHED') {
            status = `✅ ${coverage.toFixed(1)}% coverage (stop level ${this.config.targetCoveragePercent}%)`;
            statusTitle = 'Coverage Target Reached';
        } else if (this.completionReason === 'TIME_LIMIT') {
            status = `⏱️ ${coverage.toFixed(1)}% coverage when the ${Math.round(this.config.timeLimitSec / 60)} min limit passed, ${verdict}`;
            statusTitle = 'Time Limit Reached';
        } else if (this.completionReason === 'ALGORITHM_GAVE_UP' || this.completionReason === 'INVALID_MOVE') {
            status = `⏸️ Stopped - ${coverage.toFixed(1)}%, ${verdict}`;
            statusTitle = 'Algorithm Stopped';
        } else if (this.completionReason === 'STAGNANT') {
            status = `⏸️ Stuck - ${coverage.toFixed(1)}% (no progress), ${verdict}`;
            statusTitle = 'Rover Stuck - Cannot Continue';
        } else if (this.completionReason === 'MAX_STEPS') {
            status = `⏸️ Max Steps - ${coverage.toFixed(1)}%, ${verdict}`;
            statusTitle = 'Maximum Steps Exceeded';
        }

        const result = {
            algorithmName: this.algorithm.name,
            steps: this.rover.steps,
            revisits: this.rover.revisits,
            turns: this.rover.turns,
            coveragePercent: coverage,
            overlapRatio,
            revisitPercentage,
            travelDistanceCm: travelDistance,
            cleaningTimeSec: cleaningTime,
            reachedTarget: passed,
            fullCoverage: coverage >= this.config.targetCoveragePercent,
            stepsToMinCoverage: this.stepsToMinCoverage,
            timeToMinCoverageSec: this.stepsToMinCoverage >= 0
                ? this.stepsToMinCoverage * this.config.cellSizeCm / this.config.roverSpeedCmPerSec
                : -1,
            elapsedSeconds: elapsed,

            // New metrics
            cellsCleaned,
            accessibleCells,
            areaExplored,
            areaExploredPercent,
            unreachableCells: this.unreachableCells,
            efficiencyScore: efficiencyScore.toFixed(2),
            performanceRating: rating,
            avgSpeed,
            status,
            statusTitle,
            completionReason: this.completionReason
        };

        if (this.onSimulationComplete) {
            this.onSimulationComplete(result);
        }
    }

    getPerformanceRating(coverage, revisitPercent, areaPercent) {
        // A+ : >95% coverage, <20% revisits, >95% area explored
        if (coverage >= 95 && revisitPercent < 20 && areaPercent >= 95) return 'A+';
        // A  : >90% coverage, <30% revisits, >90% area explored
        if (coverage >= 90 && revisitPercent < 30 && areaPercent >= 90) return 'A';
        // B  : >80% coverage, <50% revisits, >80% area explored
        if (coverage >= 80 && revisitPercent < 50 && areaPercent >= 80) return 'B';
        // C  : >70% coverage, <70% revisits, >70% area explored
        if (coverage >= 70 && revisitPercent < 70 && areaPercent >= 70) return 'C';
        // D  : Anything else
        return 'D';
    }

    updateDisplay() {
        this.gridUI.draw();
        const coverage = this.getCoverage();
        const elapsed = (Date.now() - this.startTime) / 1000;

        if (this.onFrameUpdate) {
            this.onFrameUpdate({
                step: this.rover.steps,
                x: this.rover.x,
                y: this.rover.y,
                direction: this.rover.lastDirection,
                coverage,
                revisits: this.rover.revisits,
                turns: this.rover.turns,
                time: elapsed
            });
        }
    }

    directionDelta(dir) {
        switch (dir) {
            case 1: return { dx: 0, dy: -1 };  // UP
            case 2: return { dx: 0, dy: 1 };   // DOWN
            case 3: return { dx: -1, dy: 0 };  // LEFT
            case 4: return { dx: 1, dy: 0 };   // RIGHT
            default: return { dx: 0, dy: 0 };
        }
    }

    getDirectionName(dirCode) {
        const names = {
            0: '-',
            1: '↑ UP',
            2: '↓ DOWN',
            3: '← LEFT',
            4: '→ RIGHT'
        };
        return names[dirCode] || '-';
    }
}

// Export for use
window.Simulator = Simulator;
