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

    // Chessboard pattern
    generateChessboard() {
        const width = this.gridUI.width;
        const height = this.gridUI.height;
        const grid = Array(height).fill(null).map(() => Array(width).fill(0));

        const squareSize = 3;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const squareX = Math.floor(x / squareSize);
                const squareY = Math.floor(y / squareSize);
                if ((squareX + squareY) % 2 === 0) {
                    grid[y][x] = 1;
                }
            }
        }

        this.gridUI.setGrid(grid);
    }

    // Corridors pattern
    generateCorridors() {
        const width = this.gridUI.width;
        const height = this.gridUI.height;
        const grid = Array(height).fill(null).map(() => Array(width).fill(1));  // Start filled

        const corridorWidth = 3;
        const corridorSpacing = 8;

        // Horizontal corridors
        for (let y = 0; y < height; y += corridorSpacing) {
            for (let x = 0; x < width; x++) {
                for (let dy = 0; dy < corridorWidth && y + dy < height; dy++) {
                    grid[y + dy][x] = 0;
                }
            }
        }

        // Vertical corridors
        for (let x = 0; x < width; x += corridorSpacing) {
            for (let y = 0; y < height; y++) {
                for (let dx = 0; dx < corridorWidth && x + dx < width; dx++) {
                    grid[y][x + dx] = 0;
                }
            }
        }

        this.gridUI.setGrid(grid);
    }

    // Preset pattern selector
    generatePreset(presetName) {
        switch (presetName) {
            case 'chessboard':
                this.generateChessboard();
                break;
            case 'corridors':
                this.generateCorridors();
                break;
            case 'random':
                this.generateRandom(30);
                break;
            default:
                this.generateRandom(30);
        }
    }

    // Complexity-based generation
    generateByComplexity(complexity, seed = null) {
        const densityMap = {
            'simple': 15,
            'moderate': 30,
            'complex': 50
        };

        const density = densityMap[complexity] || 30;
        this.generateRandom(density, seed);
    }

    clear() {
        this.gridUI.clear();
    }
}
