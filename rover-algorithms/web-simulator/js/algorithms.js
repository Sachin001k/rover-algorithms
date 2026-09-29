// Algorithm implementations - COMPLETE REWRITE with proven logic

class Algorithm {
    constructor(name) {
        this.name = name;
    }

    reset(grid, rover) {}

    getNextMove(grid, rover) {
        return 0;
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

    getDirection(dx, dy) {
        if (dy === -1) return 1;
        if (dy === 1) return 2;
        if (dx === -1) return 3;
        if (dx === 1) return 4;
        return 0;
    }

    // BFS to find nearest unvisited cell
    findNearestUnvisited(grid, rover, visited) {
        const queue = [[rover.x, rover.y, 0]];
        const seen = new Set();
        seen.add(`${rover.x},${rover.y}`);

        while (queue.length > 0) {
            const [x, y, dist] = queue.shift();

            if (dist > 25) break;  // Limit search distance

            const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (const [dx, dy] of dirs) {
                const nx = x + dx;
                const ny = y + dy;
                const key = `${nx},${ny}`;

                if (grid.isInBounds(nx, ny) && !seen.has(key)) {
                    seen.add(key);

                    // Found unvisited accessible cell!
                    if (grid.isAccessible(nx, ny) && !visited.has(key)) {
                        return this.getDirection(dx, dy);
                    }

                    // Add to queue to continue search
                    if (grid.isAccessible(nx, ny)) {
                        queue.push([nx, ny, dist + 1]);
                    }
                }
            }
        }

        return 0;
    }
}

// ============= ZIGZAG: PROPER BOUSTROPHEDON SWEEP =============
class ZigZagAlgorithm extends Algorithm {
    constructor() {
        super('ZigZag');
        this.sweepDirection = 4;  // 4=RIGHT, 3=LEFT (alternates per row)
        this.targetRow = 0;
        this.sweptRows = new Set();
        this.cellVisitCount = new Map();  // Track visits to each cell
    }

    reset(grid, rover) {
        this.sweepDirection = 4;  // Start sweeping RIGHT
        this.targetRow = rover.y;
        this.sweptRows.clear();
        this.cellVisitCount.clear();
    }

    getNextMove(grid, rover) {
        // AGGRESSIVE STUCK DETECTION: If we've visited this cell 3+ times, FORCE ESCAPE
        const cellKey = `${rover.x},${rover.y}`;
        const visitCount = (this.cellVisitCount.get(cellKey) || 0) + 1;
        this.cellVisitCount.set(cellKey, visitCount);

        if (visitCount > 3) {
            // AGGRESSIVE ESCAPE: Try all 4 directions until one works
            // Try multiple times - don't give up easily
            const dirs = [1, 2, 3, 4];
            for (let attempt = 0; attempt < 2; attempt++) {
                for (const dir of dirs) {
                    const { dx, dy } = this.directionDelta(dir);
                    const nx = rover.x + dx;
                    const ny = rover.y + dy;
                    if (grid.isAccessible(nx, ny)) {
                        this.cellVisitCount.set(cellKey, 0);  // Reset counter
                        return dir;
                    }
                }
            }
            // If truly no way out, try unvisited neighbors
            const unvisitedDirs = dirs.filter(dir => {
                const { dx, dy } = this.directionDelta(dir);
                const key = `${rover.x + dx},${rover.y + dy}`;
                return grid.isAccessible(rover.x + dx, rover.y + dy) && this.cellVisitCount.get(key) === 0;
            });
            if (unvisitedDirs.length > 0) {
                return unvisitedDirs[0];
            }
            return 0;  // Truly enclosed
        }
        // PHASE 1: Sweep current row in sweep direction
        const { dx, dy } = this.directionDelta(this.sweepDirection);
        const nx = rover.x + dx;
        const ny = rover.y + dy;

        if (grid.isAccessible(nx, ny)) {
            // Can continue sweeping in current direction
            return this.sweepDirection;
        }

        // PHASE 2: Current row sweep complete, mark it
        this.sweptRows.add(rover.y);

        // PHASE 3: Try to move to next row (DOWN first)
        if (grid.isAccessible(rover.x, rover.y + 1)) {
            // Flip direction for next row (boustrophedon pattern)
            this.sweepDirection = (this.sweepDirection === 4) ? 3 : 4;
            return 2;  // Move DOWN
        }

        // PHASE 4: Can't move down, try UP (continuous sweep back up)
        if (grid.isAccessible(rover.x, rover.y - 1)) {
            // Flip direction for next row
            this.sweepDirection = (this.sweepDirection === 4) ? 3 : 4;
            return 1;  // Move UP - continue sweeping pattern
        }

        // PHASE 5: Stuck in current row end, search for unswept row
        // Search downward for unswept accessible row
        for (let checkY = rover.y + 1; checkY < grid.height; checkY++) {
            if (!this.sweptRows.has(checkY)) {
                for (let checkX = 0; checkX < grid.getWidth(); checkX++) {
                    if (grid.isAccessible(checkX, checkY)) {
                        return 2;  // Move DOWN towards unswept row
                    }
                }
            }
        }

        // Search upward for unswept accessible row
        for (let checkY = rover.y - 1; checkY >= 0; checkY--) {
            if (!this.sweptRows.has(checkY)) {
                for (let checkX = 0; checkX < grid.getWidth(); checkX++) {
                    if (grid.isAccessible(checkX, checkY)) {
                        return 1;  // Move UP towards unswept row
                    }
                }
            }
        }

        // PHASE 6: Last resort - use BFS to find any unvisited cell
        const nearestUnvisited = this.findNearestUnvisited(grid, rover, this.cellVisitCount);
        if (nearestUnvisited !== 0) {
            return nearestUnvisited;
        }

        return 0;  // COMPLETELY STUCK
    }
}

// ============= RANDOM WALK: DFS WITH UNVISITED PRIORITY =============
class RandomWalkAlgorithm extends Algorithm {
    constructor(seed = null) {
        super('RandomWalk');
        this.seed = seed || Date.now();
        this.visited = new Map();  // x,y -> count
        this.stuckAttempts = 0;
    }

    reset(grid, rover) {
        this.visited.clear();
        this.visited.set(`${rover.x},${rover.y}`, 1);
        this.stuckAttempts = 0;
    }

    getNextMove(grid, rover) {
        const key = `${rover.x},${rover.y}`;
        this.visited.set(key, (this.visited.get(key) || 0) + 1);

        // AGGRESSIVE STUCK DETECTION: If stuck in same cell > 3 times, FORCE escape
        const currentVisitCount = this.visited.get(key);
        if (currentVisitCount > 3) {
            // Aggressive escape: try all directions multiple times
            const dirs = [1, 2, 3, 4];
            for (let attempt = 0; attempt < 2; attempt++) {
                for (const dir of dirs) {
                    const { dx, dy } = this.directionDelta(dir);
                    const nx = rover.x + dx;
                    const ny = rover.y + dy;
                    if (grid.isAccessible(nx, ny)) {
                        this.visited.set(key, 0);  // Reset counter
                        return dir;
                    }
                }
            }
            return 0;  // Completely enclosed
        }

        // Get all valid adjacent cells
        const adjacent = [];
        const dirs = [1, 2, 3, 4];

        for (const dir of dirs) {
            const { dx, dy } = this.directionDelta(dir);
            const nx = rover.x + dx;
            const ny = rover.y + dy;

            if (grid.isAccessible(nx, ny)) {
                const visitCount = this.visited.get(`${nx},${ny}`) || 0;
                adjacent.push({ dir, x: nx, y: ny, visitCount });
            }
        }

        if (adjacent.length === 0) {
            return 0;  // Completely blocked - truly stuck
        }

        // STRATEGY 1: Strongly prefer unvisited cells (99% of the time)
        const unvisited = adjacent.filter(a => a.visitCount === 0);
        if (unvisited.length > 0) {
            // Randomly pick from unvisited cells
            const randomIndex = Math.floor(this.seededRandom() * unvisited.length);
            const chosen = unvisited[randomIndex];
            return chosen.dir;
        }

        // STRATEGY 2: No unvisited neighbors - use BFS to find unvisited area
        const nearestUnvisited = this.findNearestUnvisited(grid, rover, this.visited);
        if (nearestUnvisited !== 0) {
            return nearestUnvisited;
        }

        // STRATEGY 3: All reachable cells visited - move to least-visited neighbor
        adjacent.sort((a, b) => a.visitCount - b.visitCount);
        const leastVisited = adjacent[0];
        return leastVisited.dir;
    }

    seededRandom() {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }
}

// ============= ZIGZAG + WALL FOLLOW =============
class ZigZagWallFollowHybrid extends Algorithm {
    constructor() {
        super('ZigZag+WallFollow');
        this.zigzag = new ZigZagAlgorithm();
        this.inWallFollowMode = false;
        this.wallFollowCount = 0;
        this.cellVisitCount = new Map();  // Stuck detection
    }

    reset(grid, rover) {
        this.zigzag.reset(grid, rover);
        this.inWallFollowMode = false;
        this.wallFollowCount = 0;
        this.cellVisitCount.clear();
    }

    getNextMove(grid, rover) {
        // AGGRESSIVE STUCK DETECTION: Force escape if stuck > 3 times
        const cellKey = `${rover.x},${rover.y}`;
        const visitCount = (this.cellVisitCount.get(cellKey) || 0) + 1;
        this.cellVisitCount.set(cellKey, visitCount);

        // Trigger wall-follow mode more aggressively
        if (visitCount > 3 && !this.inWallFollowMode) {
            this.inWallFollowMode = true;  // Force wall-follow escape
            this.wallFollowCount = 0;
        }
        // If wall following, continue
        if (this.inWallFollowMode) {
            const move = this.wallFollow(grid, rover);
            if (move !== 0) {
                this.wallFollowCount++;
                if (this.wallFollowCount > 30) {
                    this.inWallFollowMode = false;
                }
                return move;
            } else {
                this.inWallFollowMode = false;
            }
        }

        // Try zigzag
        const zigMove = this.zigzag.getNextMove(grid, rover);
        if (zigMove !== 0) {
            return zigMove;
        }

        // Stuck in zigzag, try wall following
        const wallMove = this.wallFollow(grid, rover);
        if (wallMove !== 0) {
            this.inWallFollowMode = true;
            this.wallFollowCount = 0;
            return wallMove;
        }

        // Last resort: BFS to find nearest unvisited
        const nearestUnvisited = this.findNearestUnvisited(grid, rover, this.cellVisitCount);
        if (nearestUnvisited !== 0) {
            return nearestUnvisited;
        }

        return 0;  // Completely enclosed
    }

    wallFollow(grid, rover) {
        // Right-hand rule: right, forward, left, back
        const attempts = [4, 1, 2, 3];  // RIGHT, UP, DOWN, LEFT

        for (const dir of attempts) {
            const { dx, dy } = this.directionDelta(dir);
            const nx = rover.x + dx;
            const ny = rover.y + dy;

            if (grid.isAccessible(nx, ny)) {
                return dir;
            }
        }

        return 0;
    }
}

// ============= ZIGZAG + RANDOM ESCAPE =============
class ZigZagRandomEscapeHybrid extends Algorithm {
    constructor(seed = null) {
        super('ZigZag+RandomEscape');
        this.zigzag = new ZigZagAlgorithm();
        this.seed = seed || Date.now();
        this.visited = new Map();
        this.inEscapeMode = false;
        this.escapeCount = 0;
        this.lastCleanedCount = -1;
        this.stepsSinceProgress = 0;
        this.stagnationThreshold = 0;
    }

    reset(grid, rover) {
        this.zigzag.reset(grid, rover);
        this.visited.clear();
        this.visited.set(`${rover.x},${rover.y}`, 1);
        this.inEscapeMode = false;
        this.escapeCount = 0;
        this.lastCleanedCount = -1;
        this.stepsSinceProgress = 0;
        this.stagnationThreshold = 2 * (grid.width + grid.height);
    }

    countCleanedCells(grid) {
        let count = 0;
        for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
                if (grid.isCleaned(x, y)) count++;
            }
        }
        return count;
    }

    updateProgress(grid) {
        const cleaned = this.countCleanedCells(grid);
        if (cleaned > this.lastCleanedCount) {
            this.stepsSinceProgress = 0;
        } else {
            this.stepsSinceProgress++;
        }
        this.lastCleanedCount = cleaned;
    }

    getNextMove(grid, rover) {
        const key = `${rover.x},${rover.y}`;
        const currentCellVisits = (this.visited.get(key) || 0) + 1;
        this.visited.set(key, currentCellVisits);
        this.updateProgress(grid);

        // AGGRESSIVE STUCK DETECTION: If stuck in same cell > 3 times, FORCE escape immediately
        if (currentCellVisits > 3) {
            this.inEscapeMode = true;
            this.escapeCount = 0;
            return this.smartEscape(grid, rover);
        }

        // Check if stagnant (not making progress toward new cells)
        const isStagnant = this.stepsSinceProgress >= this.stagnationThreshold;

        // If escaping, continue smart escape
        if (this.inEscapeMode) {
            const move = this.smartEscape(grid, rover);
            if (move !== 0) {
                this.escapeCount++;
                // Resume zigzag when:
                // 1. Escaped long enough (min steps)
                // 2. Original sweep direction is now open
                // OR forced to stop after max steps
                if (this.escapeCount >= 3 && (this.canResumeZigZag(grid, rover) || this.escapeCount > 20)) {
                    this.inEscapeMode = false;
                }
                return move;
            } else {
                this.inEscapeMode = false;
            }
        }

        // Trigger escape if stagnant (don't just wait for zigzag to fail)
        if (isStagnant) {
            this.inEscapeMode = true;
            this.escapeCount = 0;
            return this.smartEscape(grid, rover);
        }

        // Try zigzag
        const zigMove = this.zigzag.getNextMove(grid, rover);
        if (zigMove !== 0) {
            return zigMove;
        }

        // Zigzag failed - activate escape mode
        this.inEscapeMode = true;
        this.escapeCount = 0;
        return this.smartEscape(grid, rover);
    }

    canResumeZigZag(grid, rover) {
        // Check if we can move in a preferred direction after escape
        // This is a simplified check; C++ version is more sophisticated
        const dirs = [1, 2, 3, 4];
        for (const dir of dirs) {
            const { dx, dy } = this.directionDelta(dir);
            if (grid.isAccessible(rover.x + dx, rover.y + dy)) {
                return true;
            }
        }
        return false;
    }

    smartEscape(grid, rover) {
        // Get all valid adjacent cells
        const adjacent = [];
        const dirs = [1, 2, 3, 4];

        for (const dir of dirs) {
            const { dx, dy } = this.directionDelta(dir);
            const nx = rover.x + dx;
            const ny = rover.y + dy;

            if (grid.isAccessible(nx, ny)) {
                const visitCount = this.visited.get(`${nx},${ny}`) || 0;
                adjacent.push({ dir, visitCount });
            }
        }

        if (adjacent.length === 0) {
            // No adjacent cells - use BFS to find nearest unvisited
            const nearestMove = this.findNearestUnvisited(grid, rover, this.visited);
            if (nearestMove !== 0) {
                return nearestMove;
            }
            return 0;
        }

        // Prefer unvisited strongly
        const unvisited = adjacent.filter(a => a.visitCount === 0);
        if (unvisited.length > 0) {
            return unvisited[Math.floor(this.seededRandom() * unvisited.length)].dir;
        }

        // Otherwise least visited
        adjacent.sort((a, b) => a.visitCount - b.visitCount);
        return adjacent[0].dir;
    }

    seededRandom() {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }
}

// Export for use
window.Algorithms = {
    ZigZagAlgorithm,
    ZigZagWallFollowHybrid,
    RandomWalkAlgorithm,
    ZigZagRandomEscapeHybrid
};
