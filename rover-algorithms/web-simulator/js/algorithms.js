// Algorithm implementations — a direct port of the C++ strategies in
// src/*Algorithm.cpp / src/*Hybrid.cpp so the browser and the C++
// simulator behave the same way. Direction codes match the trajectory
// JSON: 0=NONE, 1=UP, 2=DOWN, 3=LEFT, 4=RIGHT.

const NONE = 0, UP = 1, DOWN = 2, LEFT = 3, RIGHT = 4;
const DIRS = [UP, DOWN, LEFT, RIGHT];

function directionDelta(dir) {
    switch (dir) {
        case UP:    return { dx: 0, dy: -1 };
        case DOWN:  return { dx: 0, dy: 1 };
        case LEFT:  return { dx: -1, dy: 0 };
        case RIGHT: return { dx: 1, dy: 0 };
        default:    return { dx: 0, dy: 0 };
    }
}

function oppositeDirection(dir) {
    switch (dir) {
        case UP:    return DOWN;
        case DOWN:  return UP;
        case LEFT:  return RIGHT;
        case RIGHT: return LEFT;
        default:    return NONE;
    }
}

function turnRight(dir) {
    switch (dir) {
        case UP:    return RIGHT;
        case RIGHT: return DOWN;
        case DOWN:  return LEFT;
        case LEFT:  return UP;
        default:    return NONE;
    }
}

function turnLeft(dir) {
    switch (dir) {
        case UP:    return LEFT;
        case LEFT:  return DOWN;
        case DOWN:  return RIGHT;
        case RIGHT: return UP;
        default:    return NONE;
    }
}

function canStep(grid, x, y, dir) {
    const { dx, dy } = directionDelta(dir);
    return grid.isAccessible(x + dx, y + dy);
}

function stepTo(x, y, dir) {
    const { dx, dy } = directionDelta(dir);
    return { nx: x + dx, ny: y + dy };
}

// Seeded 32-bit PRNG (mulberry32). The previous LCG multiplied in floating
// point, which overflowed 2^53 and lost the low bits, so it degenerated.
function makeRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randomIndex(rng, n) {
    return Math.floor(rng() * n);
}

// BFS: first step of a shortest path to the nearest uncleaned cell, or
// NONE if every reachable cell is cleaned. (The old helper returned the
// direction of the LAST hop of the search, not the first step from the
// rover, so the rover moved the wrong way or into walls.)
function firstStepTowardNearestUncleaned(grid, x, y) {
    const w = grid.width, h = grid.height;
    const firstDir = new Uint8Array(w * h);
    const seen = new Uint8Array(w * h);
    const queue = [x, y];
    seen[y * w + x] = 1;
    for (let head = 0; head < queue.length; head += 2) {
        const cx = queue[head], cy = queue[head + 1];
        for (const d of DIRS) {
            const { nx, ny } = stepTo(cx, cy, d);
            if (!grid.isAccessible(nx, ny)) continue;
            const idx = ny * w + nx;
            if (seen[idx]) continue;
            seen[idx] = 1;
            firstDir[idx] = (cx === x && cy === y) ? d : firstDir[cy * w + cx];
            if (!grid.isCleaned(nx, ny)) return firstDir[idx];
            queue.push(nx, ny);
        }
    }
    return NONE;
}

class Algorithm {
    constructor(name) {
        this.name = name;
    }
    reset(grid, rover) {}
    getNextMove(grid, rover) { return NONE; }
}

// Counts steps since a NEW cell was cleaned. Every non-revisit step cleans
// exactly one new cell, so progress == (steps - revisits) increasing —
// O(1) instead of rescanning the whole grid every step.
class ProgressTracker {
    constructor() { this.reset(0); }
    reset(threshold) {
        this.lastProgress = -1;
        this.stepsSinceProgress = 0;
        this.threshold = threshold;
    }
    update(rover) {
        const progress = rover.steps - rover.revisits;
        if (progress > this.lastProgress) this.stepsSinceProgress = 0;
        else this.stepsSinceProgress++;
        this.lastProgress = progress;
    }
    get stagnant() { return this.stepsSinceProgress >= this.threshold; }
}

// Short anti-cycling history used by the local fallback move.
class RecentCells {
    constructor(size) { this.size = size; this.cells = []; }
    clear() { this.cells = []; }
    record(x, y) {
        this.cells.push(x + ',' + y);
        if (this.cells.length > this.size) this.cells.shift();
    }
    has(x, y) { return this.cells.includes(x + ',' + y); }
}

// Prefer unvisited & not-recent, then not-recent, then unvisited, then anything.
function pickFallbackMove(grid, rover, recent) {
    const tiers = [
        (nx, ny) => !grid.isCleaned(nx, ny) && !recent.has(nx, ny),
        (nx, ny) => !recent.has(nx, ny),
        (nx, ny) => !grid.isCleaned(nx, ny),
        () => true
    ];
    for (const ok of tiers) {
        for (const d of DIRS) {
            if (!canStep(grid, rover.x, rover.y, d)) continue;
            const { nx, ny } = stepTo(rover.x, rover.y, d);
            if (ok(nx, ny)) return d;
        }
    }
    return NONE;
}

// ============= ZIGZAG (boustrophedon) =============
class ZigZagAlgorithm extends Algorithm {
    constructor() {
        super('ZigZag');
        this.progress = new ProgressTracker();
        this.recent = new RecentCells(12);
    }

    reset(grid, rover) {
        this.sweeping = true;
        this.horizontalDir = RIGHT;
        this.verticalShiftDir = DOWN;
        this.recent.clear();
        this.progress.reset(2 * (grid.width + grid.height));
    }

    getNextMove(grid, rover) {
        this.recent.record(rover.x, rover.y);
        this.progress.update(rover);

        // Stagnation recovery: walk to the nearest uncleaned cell.
        if (this.progress.stagnant) {
            this.sweeping = true;
            return firstStepTowardNearestUncleaned(grid, rover.x, rover.y);
        }

        if (this.sweeping) {
            if (canStep(grid, rover.x, rover.y, this.horizontalDir)) return this.horizontalDir;
            this.sweeping = false; // blocked mid-row: shift next
        }

        if (canStep(grid, rover.x, rover.y, this.verticalShiftDir)) {
            this.horizontalDir = oppositeDirection(this.horizontalDir);
            this.sweeping = true;
            return this.verticalShiftDir;
        }
        const otherVertical = oppositeDirection(this.verticalShiftDir);
        if (canStep(grid, rover.x, rover.y, otherVertical)) {
            this.verticalShiftDir = otherVertical;
            this.horizontalDir = oppositeDirection(this.horizontalDir);
            this.sweeping = true;
            return this.verticalShiftDir;
        }

        this.sweeping = true;
        return pickFallbackMove(grid, rover, this.recent);
    }
}

// ============= RANDOM WALK (bump-and-turn) =============
class RandomWalkAlgorithm extends Algorithm {
    constructor(seed) {
        super('RandomWalk');
        this.seed = seed;
    }

    reset(grid, rover) {
        this.rng = makeRng(this.seed);
        this.currentDir = NONE;
        this.runRemaining = 0;
        this.maxRunLength = Math.max(1, grid.width, grid.height);
    }

    getNextMove(grid, rover) {
        if (this.currentDir !== NONE && this.runRemaining > 0 &&
            canStep(grid, rover.x, rover.y, this.currentDir)) {
            this.runRemaining--;
            return this.currentDir;
        }
        const options = DIRS.filter(d => canStep(grid, rover.x, rover.y, d));
        if (options.length === 0) {
            this.currentDir = NONE;
            return NONE;
        }
        this.currentDir = options[randomIndex(this.rng, options.length)];
        // Random run length = grid analogue of a random bounce angle.
        this.runRemaining = randomIndex(this.rng, this.maxRunLength);
        return this.currentDir;
    }
}

// ============= ZIGZAG + WALL FOLLOW =============
class ZigZagWallFollowHybrid extends Algorithm {
    constructor() {
        super('ZigZag+WallFollow');
        this.progress = new ProgressTracker();
        this.recent = new RecentCells(12);
    }

    reset(grid, rover) {
        this.mode = 'SWEEP';
        this.horizontalDir = RIGHT;
        this.verticalShiftDir = DOWN;
        this.wallFollowSteps = 0;
        this.maxWallFollowSteps = 2 * (grid.width + grid.height);
        this.recent.clear();
        this.progress.reset(2 * (grid.width + grid.height));
    }

    getNextMove(grid, rover) {
        this.recent.record(rover.x, rover.y);
        this.progress.update(rover);

        if (this.progress.stagnant) {
            this.mode = 'SWEEP';
            return firstStepTowardNearestUncleaned(grid, rover.x, rover.y);
        }

        if (this.mode === 'SWEEP') {
            if (canStep(grid, rover.x, rover.y, this.horizontalDir)) return this.horizontalDir;
            this.mode = 'SHIFT';
        }

        if (this.mode === 'SHIFT') {
            if (canStep(grid, rover.x, rover.y, this.verticalShiftDir)) {
                this.horizontalDir = oppositeDirection(this.horizontalDir);
                this.mode = 'SWEEP';
                return this.verticalShiftDir;
            }
            const otherVertical = oppositeDirection(this.verticalShiftDir);
            if (canStep(grid, rover.x, rover.y, otherVertical)) {
                this.verticalShiftDir = otherVertical;
                this.horizontalDir = oppositeDirection(this.horizontalDir);
                this.mode = 'SWEEP';
                return this.verticalShiftDir;
            }
            // Blocked: hug the obstacle with it on the rover's right.
            this.mode = 'WALL_FOLLOW';
            this.sweepRow = rover.y;
            this.hitX = rover.x;
            this.resumeDir = this.horizontalDir;
            this.followHeading = turnLeft(this.horizontalDir);
            this.wallFollowSteps = 0;
        }

        // WALL_FOLLOW (right-hand rule)
        if (++this.wallFollowSteps > this.maxWallFollowSteps) {
            this.mode = 'SWEEP';
            return pickFallbackMove(grid, rover, this.recent);
        }
        const candidates = [
            turnRight(this.followHeading),
            this.followHeading,
            turnLeft(this.followHeading),
            oppositeDirection(this.followHeading)
        ];
        const chosen = candidates.find(c => canStep(grid, rover.x, rover.y, c));
        if (chosen === undefined) {
            this.mode = 'SWEEP';
            return pickFallbackMove(grid, rover, this.recent);
        }
        this.followHeading = chosen;

        // Rejoin the sweep row only once past the obstacle.
        const { nx, ny } = stepTo(rover.x, rover.y, chosen);
        const pastObstacle = this.resumeDir === RIGHT ? nx > this.hitX : nx < this.hitX;
        if (ny === this.sweepRow && pastObstacle && canStep(grid, nx, ny, this.resumeDir)) {
            this.mode = 'SWEEP';
            this.horizontalDir = this.resumeDir;
        }
        return chosen;
    }
}

// ============= ZIGZAG + RANDOM ESCAPE =============
class ZigZagRandomEscapeHybrid extends Algorithm {
    constructor(seed) {
        super('ZigZag+RandomEscape');
        this.seed = seed;
        this.progress = new ProgressTracker();
        this.minEscapeSteps = 3;
        this.maxEscapeSteps = 20;
    }

    reset(grid, rover) {
        this.rng = makeRng(this.seed);
        this.mode = 'SWEEP';
        this.horizontalDir = RIGHT;
        this.verticalShiftDir = DOWN;
        this.escapeSteps = 0;
        this.progress.reset(2 * (grid.width + grid.height));
    }

    getNextMove(grid, rover) {
        this.progress.update(rover);
        const stagnant = this.progress.stagnant;

        if (this.mode === 'SWEEP') {
            if (!stagnant && canStep(grid, rover.x, rover.y, this.horizontalDir)) return this.horizontalDir;
            this.mode = 'SHIFT';
        }

        if (this.mode === 'SHIFT') {
            if (!stagnant && canStep(grid, rover.x, rover.y, this.verticalShiftDir)) {
                this.horizontalDir = oppositeDirection(this.horizontalDir);
                this.mode = 'SWEEP';
                return this.verticalShiftDir;
            }
            const otherVertical = oppositeDirection(this.verticalShiftDir);
            if (!stagnant && canStep(grid, rover.x, rover.y, otherVertical)) {
                this.verticalShiftDir = otherVertical;
                this.horizontalDir = oppositeDirection(this.horizontalDir);
                this.mode = 'SWEEP';
                return this.verticalShiftDir;
            }
            this.mode = 'RANDOM_ESCAPE';
            this.escapeSteps = 0;
        }

        // RANDOM_ESCAPE, biased towards unvisited neighbours.
        const anyAccessible = DIRS.filter(d => canStep(grid, rover.x, rover.y, d));
        if (anyAccessible.length === 0) return NONE;
        const unvisited = anyAccessible.filter(d => {
            const { nx, ny } = stepTo(rover.x, rover.y, d);
            return !grid.isCleaned(nx, ny);
        });
        const pool = unvisited.length > 0 ? unvisited : anyAccessible;
        const chosen = pool[randomIndex(this.rng, pool.length)];

        this.escapeSteps++;
        const { nx, ny } = stepTo(rover.x, rover.y, chosen);
        const canResume = canStep(grid, nx, ny, this.horizontalDir);
        if ((this.escapeSteps >= this.minEscapeSteps && canResume) ||
            this.escapeSteps >= this.maxEscapeSteps) {
            this.mode = 'SWEEP';
        }
        return chosen;
    }
}

window.Algorithms = {
    ZigZagAlgorithm,
    ZigZagWallFollowHybrid,
    RandomWalkAlgorithm,
    ZigZagRandomEscapeHybrid
};
