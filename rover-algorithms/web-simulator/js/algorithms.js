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
    }

    reset(grid, rover) {
        this.sweepDirection = 4;  // Start sweeping RIGHT
        this.targetRow = rover.y;
        this.sweptRows.clear();
    }

    getNextMove(grid, rover) {
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

        // Check if stuck in same cell
        if (this.visited.get(key) > 8) {
            this.stuckAttempts++;
            if (this.stuckAttempts > 50) {
                return 0;  // Give up completely
            }
        } else {
            this.stuckAttempts = 0;
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
            return 0;  // Completely blocked
        }

        // STRATEGY 1: Find and move to unvisited cells (99% priority)
        const unvisited = adjacent.filter(a => a.visitCount === 0);
        if (unvisited.length > 0) {
            const chosen = unvisited[Math.floor(this.seededRandom() * unvisited.length)];
            return chosen.dir;
        }

        // STRATEGY 2: No unvisited nearby, use BFS to find unvisited area
        const nearestUnvisited = this.findNearestUnvisited(grid, rover, this.visited);
        if (nearestUnvisited !== 0) {
            return nearestUnvisited;
        }

        // STRATEGY 3: All reachable cells visited, move to least-visited
        adjacent.sort((a, b) => a.visitCount - b.visitCount);
        return adjacent[0].dir;
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
    }

    reset(grid, rover) {
        this.zigzag.reset(grid, rover);
        this.inWallFollowMode = false;
        this.wallFollowCount = 0;
    }

    getNextMove(grid, rover) {
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

        // Stuck, start wall following
        this.inWallFollowMode = true;
        this.wallFollowCount = 0;
        return this.wallFollow(grid, rover);
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
    }

    reset(grid, rover) {
        this.zigzag.reset(grid, rover);
        this.visited.clear();
        this.visited.set(`${rover.x},${rover.y}`, 1);
        this.inEscapeMode = false;
        this.escapeCount = 0;
    }

    getNextMove(grid, rover) {
        const key = `${rover.x},${rover.y}`;
        this.visited.set(key, (this.visited.get(key) || 0) + 1);

        // If escaping, continue smart escape
        if (this.inEscapeMode) {
            const move = this.smartEscape(grid, rover);
            if (move !== 0) {
                this.escapeCount++;
                if (this.escapeCount > 25) {
                    this.inEscapeMode = false;
                }
                return move;
            } else {
                this.inEscapeMode = false;
            }
        }

        // Try zigzag
        const zigMove = this.zigzag.getNextMove(grid, rover);
        if (zigMove !== 0) {
            return zigMove;
        }

        // Activate escape mode
        this.inEscapeMode = true;
        this.escapeCount = 0;
        return this.smartEscape(grid, rover);
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
