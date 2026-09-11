// Simulation Engine - Main loop and step execution

class Simulator {
    constructor(gridUI, algorithm) {
        this.gridUI = gridUI;
        this.algorithm = algorithm;

        // Rover state
        this.rover = {
            x: gridUI.rover.x,
            y: gridUI.rover.y,
            steps: 0,
            revisits: 0,
            turns: 0,
            lastDirection: 0
        };

        // Simulation config
        this.config = {
            targetCoveragePercent: 99.9,  // Run until maximum possible coverage
            maxSteps: 500000,  // Increased from 200000
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

        // Metrics tracking
        this.visitedMap = Array(gridUI.height).fill(null).map(() => Array(gridUI.width).fill(0));
        this.reachableCells = new Set();
        this.unreachableCells = 0;
        this.completionReason = null;  // Track why simulation ended

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

        // Calculate reachable cells using flood-fill
        this.calculateReachableCells();

        // Initialize grid (mark start position as cleaned)
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
        this.speed = Math.max(1, Math.min(stepsPerSecond, 120));
    }

    simulationLoop() {
        if (!this.running) return;
        if (this.paused) return;

        // Process multiple steps per frame based on speed
        const stepsPerFrame = Math.max(1, Math.round(this.speed / 60));

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
        this.animationFrameId = requestAnimationFrame(() => this.simulationLoop());
    }

    step() {
        // Check stop conditions
        const coverage = this.gridUI.getCoveragePercent();

        // STOP if 100% coverage achieved
        if (coverage >= 100) {
            this.completionReason = 'PERFECT_COVERAGE';
            return false;  // 100% coverage!
        }

        if (coverage >= this.config.targetCoveragePercent) {
            this.completionReason = 'TARGET_REACHED';
            return false;  // Target reached
        }
        if (this.rover.steps >= this.config.maxSteps) {
            this.completionReason = 'MAX_STEPS';
            return false;  // Max steps reached
        }

        // Get next move from algorithm
        const direction = this.algorithm.getNextMove(this.gridUI, this.rover);

        if (direction === 0) {
            return false;  // Algorithm gave up
        }

        // Apply move
        const { dx, dy } = this.directionDelta(direction);
        const nx = this.rover.x + dx;
        const ny = this.rover.y + dy;

        // Validate move
        if (!this.gridUI.isAccessible(nx, ny)) {
            return false;  // Invalid move
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

        // Mark cell as cleaned
        this.gridUI.markCleaned(nx, ny);
        this.gridUI.setRoverPosition(nx, ny, direction);

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

        const coverage = this.gridUI.getCoveragePercent();
        const elapsed = (Date.now() - this.startTime) / 1000;
        const travelDistance = this.rover.steps * this.config.cellSizeCm;
        const cleaningTime = travelDistance / this.config.roverSpeedCmPerSec;
        const overlapRatio = this.rover.steps > 0 ? this.rover.revisits / this.rover.steps : 0;
        const revisitPercentage = this.rover.steps > 0 ? (this.rover.revisits / this.rover.steps) * 100 : 0;

        // Calculate efficiency metrics
        const cellsCleaned = this.gridUI.getCleanedCellCount();
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
        let status = '⚠️ Incomplete';
        let statusTitle = 'Simulation Ended';

        if (this.completionReason === 'PERFECT_COVERAGE') {
            status = '✅ PERFECT - 100% COVERAGE!';
            statusTitle = 'Everything Covered!';
        } else if (coverage >= this.config.targetCoveragePercent) {
            status = '✅ Success';
            statusTitle = 'Target Reached';
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
            reachedTarget: coverage >= this.config.targetCoveragePercent,
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
        const coverage = this.gridUI.getCoveragePercent();
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
