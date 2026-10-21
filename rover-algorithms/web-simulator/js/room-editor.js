// Room Editor: Generate rooms with different patterns

class RoomEditor {
    constructor(gridUI) {
        this.gridUI = gridUI;
    }

    // Simple seeded random number generator for reproducibility
    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    generateRandomSeed() {
        return Math.floor(Math.random() * 1000000);
    }

    // Generate room with random obstacles
    generateRandom(density = 30, seed = null) {
        if (seed === null || seed === '') {
            seed = this.generateRandomSeed();
        } else {
            seed = parseInt(seed);
        }

        const width = this.gridUI.width;
        const height = this.gridUI.height;
        const grid = Array(height).fill(null).map(() => Array(width).fill(0));

        // Math.imul keeps the multiply in 32-bit integers; a plain `*`
        // overflows 2^53, drops the low bits and degenerates.
        const next = () => {
            seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
            return seed / 0x80000000;
        };
        const randInt = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));

        // Same scheme as the C++ RoomGenerator::placeObstacles: `density` is
        // the share of room AREA to cover with furniture-sized rectangles.
        // (It used to be a per-cell chance of spawning a 2x2 block, which
        // made "complex" ~34% obstacles instead of ~10%.)
        const areaBudget = width * height * (density / 100);
        let placedArea = 0;
        for (let attempts = 0; placedArea < areaBudget && attempts < 5000; attempts++) {
            const w = randInt(2, 4);
            const h = randInt(2, 3);
            if (w >= width - 2 || h >= height - 2) continue;
            const ox = randInt(0, width - w - 1);
            const oy = randInt(0, height - h - 1);
            for (let y = oy; y < oy + h; y++) {
                for (let x = ox; x < ox + w; x++) {
                    grid[y][x] = 1;
                }
            }
            placedArea += w * h;
        }

        this.gridUI.setGrid(grid);
        return seed;
    }

    // Preset pattern selector - only random obstacles (realistic for real-world cleaning)
    // Optimized for maximum coverage - very few obstacles for smooth rover movement
    generatePreset(presetName) {
        // All presets use random generation with different densities
        const densityMap = {
            'simple': 3,       // ~97% coverage area
            'moderate': 6,     // ~94% coverage area
            'complex': 10      // ~90% coverage area
        };

        const density = densityMap[presetName] || 6;
        this.generateRandom(density);
    }

    // Complexity-based generation (realistic obstacle densities for home environments)
    // Optimized for maximum coverage area while maintaining realistic layouts
    generateByComplexity(complexity, seed = null) {
        const densityMap = {
            'simple': 3,        // ~97% coverage area (sparse home)
            'moderate': 6,      // ~94% coverage area (normal home)
            'complex': 10       // ~90% coverage area (furnished home)
        };

        const density = densityMap[complexity] || 6;
        this.generateRandom(density, seed);
    }

    clear() {
        this.gridUI.clear();
    }
}
