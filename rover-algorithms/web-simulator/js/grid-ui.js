// Grid UI: Canvas rendering and interaction

class GridUI {
    constructor(canvasElement, width, height) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.width = width;
        this.height = height;

        // Calculate cell size based on canvas dimensions
        this.cellSize = Math.min(
            Math.floor(this.canvas.width / width),
            Math.floor(this.canvas.height / height)
        );

        // Resize canvas to fit perfect grid
        this.canvas.width = width * this.cellSize;
        this.canvas.height = height * this.cellSize;

        // Grid state: 0 = floor, 1 = obstacle, 2 = cleaned
        this.grid = Array(height).fill(null).map(() => Array(width).fill(0));

        // Colors
        this.colors = {
            floor: '#f5f5f5',
            obstacle: '#424242',
            cleaned: '#c8e6c9',
            cleanedDark: '#81c784',
            rover: '#ff7043',
            roverBorder: '#d84315',
            gridLine: '#f0f0f0'
        };

        // Rover state
        this.rover = {
            x: 0,
            y: 0,
            direction: 0  // 0=NONE, 1=UP, 2=DOWN, 3=LEFT, 4=RIGHT
        };

        // Event handling
        this.onCellClick = null;
        this.setupEventListeners();

        this.drawStatic();
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleCanvasRightClick(e);
        });
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    }

    handleCanvasClick(e) {
        const { x, y } = this.getGridCoordinates(e);
        if (this.isInBounds(x, y)) {
            this.toggleObstacle(x, y);
        }
    }

    handleCanvasRightClick(e) {
        const { x, y } = this.getGridCoordinates(e);
        if (this.isInBounds(x, y)) {
            this.setRoverStart(x, y);
        }
    }

    handleMouseMove(e) {
        const { x, y } = this.getGridCoordinates(e);
        if (this.isInBounds(x, y)) {
            document.getElementById('coordDisplay').textContent = `(${x}, ${y})`;
        }
    }

    getGridCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const x = Math.floor(canvasX / this.cellSize);
        const y = Math.floor(canvasY / this.cellSize);
        return { x, y };
    }

    isInBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    toggleObstacle(x, y) {
        if (this.grid[y][x] !== 2) {  // Don't place obstacle on cleaned cells
            this.grid[y][x] = this.grid[y][x] === 1 ? 0 : 1;
            this.draw();
            this.updateObstacleCount();
        }
    }

    setRoverStart(x, y) {
        if (this.grid[y][x] !== 1) {  // Can't start on obstacle
            this.rover.x = x;
            this.rover.y = y;
            this.draw();
        }
    }

    updateObstacleCount() {
        let count = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] === 1) count++;
            }
        }
        document.getElementById('obstacleCountDisplay').textContent = count;
    }

    drawStatic() {
        // Draw floor and grid lines
        this.ctx.fillStyle = this.colors.floor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid lines
        this.ctx.strokeStyle = this.colors.gridLine;
        this.ctx.lineWidth = 0.5;
        for (let i = 0; i <= this.width; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.cellSize, 0);
            this.ctx.lineTo(i * this.cellSize, this.canvas.height);
            this.ctx.stroke();
        }
        for (let i = 0; i <= this.height; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.cellSize);
            this.ctx.lineTo(this.canvas.width, i * this.cellSize);
            this.ctx.stroke();
        }
    }

    draw() {
        // Clear and redraw static layer
        this.drawStatic();

        // Draw obstacles
        this.ctx.fillStyle = this.colors.obstacle;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] === 1) {
                    this.ctx.fillRect(
                        x * this.cellSize + 1,
                        y * this.cellSize + 1,
                        this.cellSize - 2,
                        this.cellSize - 2
                    );
                }
            }
        }

        // Draw cleaned cells
        this.ctx.fillStyle = this.colors.cleaned;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] === 2) {
                    this.ctx.fillRect(
                        x * this.cellSize + 2,
                        y * this.cellSize + 2,
                        this.cellSize - 4,
                        this.cellSize - 4
                    );
                }
            }
        }

        // Draw rover
        this.drawRover();
    }

    drawRover() {
        const cx = (this.rover.x + 0.5) * this.cellSize;
        const cy = (this.rover.y + 0.5) * this.cellSize;
        const r = this.cellSize * 0.35;

        // Draw rover body
        this.ctx.fillStyle = this.colors.rover;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw rover border
        this.ctx.strokeStyle = this.colors.roverBorder;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw direction indicator (triangle)
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(this.getDirectionAngle());
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.moveTo(r * 0.7, 0);
        this.ctx.lineTo(-r * 0.4, -r * 0.4);
        this.ctx.lineTo(-r * 0.4, r * 0.4);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    getDirectionAngle() {
        switch (this.rover.direction) {
            case 1: return -Math.PI / 2;  // UP
            case 2: return Math.PI / 2;   // DOWN
            case 3: return Math.PI;       // LEFT
            case 4: return 0;             // RIGHT
            default: return 0;
        }
    }

    setRoverPosition(x, y, direction = 0) {
        this.rover.x = x;
        this.rover.y = y;
        this.rover.direction = direction;
        this.draw();
    }

    markCleaned(x, y) {
        if (this.isInBounds(x, y) && this.grid[y][x] !== 1) {
            this.grid[y][x] = 2;
        }
    }

    // Utility methods for room generation
    clear() {
        this.grid = Array(this.height).fill(null).map(() => Array(this.width).fill(0));
        this.rover.x = 0;
        this.rover.y = 0;
        this.rover.direction = 0;
        this.draw();
        this.updateObstacleCount();
    }

    getGrid() {
        return this.grid;
    }

    setGrid(newGrid) {
        this.grid = JSON.parse(JSON.stringify(newGrid));
        this.draw();
        this.updateObstacleCount();
    }

    resize(newWidth, newHeight) {
        this.width = newWidth;
        this.height = newHeight;
        this.cellSize = Math.min(
            Math.floor(this.canvas.width / newWidth),
            Math.floor(this.canvas.height / newHeight)
        );
        this.canvas.width = newWidth * this.cellSize;
        this.canvas.height = newHeight * this.cellSize;
        this.grid = Array(newHeight).fill(null).map(() => Array(newWidth).fill(0));
        this.rover.x = 0;
        this.rover.y = 0;
        this.rover.direction = 0;
        this.draw();
        this.updateObstacleCount();
        document.getElementById('gridSizeDisplay').textContent = `${newWidth}×${newHeight}`;
    }

    getAccessibleCellCount() {
        let count = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] !== 1) count++;
            }
        }
        return count;
    }

    getCleanedCellCount() {
        let count = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] === 2) count++;
            }
        }
        return count;
    }

    getCoveragePercent() {
        const accessible = this.getAccessibleCellCount();
        const cleaned = this.getCleanedCellCount();
        return accessible > 0 ? (cleaned / accessible) * 100 : 0;
    }

    isAccessible(x, y) {
        return this.isInBounds(x, y) && this.grid[y][x] !== 1;
    }

    isObstacle(x, y) {
        return this.isInBounds(x, y) && this.grid[y][x] === 1;
    }

    isCleaned(x, y) {
        return this.isInBounds(x, y) && this.grid[y][x] === 2;
    }
}
