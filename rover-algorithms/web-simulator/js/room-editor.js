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

        const densityPercent = density / 100;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                const random = (seed / 0x7fffffff);

                if (random < densityPercent) {
                    // Create small rectangular obstacles
                    const obstacleSize = Math.floor(random * 3) + 2;
                    for (let dy = 0; dy < obstacleSize && y + dy < height; dy++) {
                        for (let dx = 0; dx < obstacleSize && x + dx < width; dx++) {
                            grid[y + dy][x + dx] = 1;
                        }
                    }
                }
            }
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
