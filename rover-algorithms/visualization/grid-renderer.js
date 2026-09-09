// Grid rendering system for trajectory visualization
// Manages two canvas layers: static (obstacles) and dynamic (cleaned cells + rover)

window.RVSim = window.RVSim || {};

window.RVSim.GridRenderer = class {
    constructor(staticCanvas, dynamicCanvas, room) {
        this.staticCanvas = staticCanvas;
        this.dynamicCanvas = dynamicCanvas;
        this.staticCtx = staticCanvas.getContext('2d');
        this.dynamicCtx = dynamicCanvas.getContext('2d');
        this.room = room;

        // Calculate cell size to fit canvas while keeping square cells
        const maxWidth = Math.min(staticCanvas.width, 800);
        const maxHeight = Math.min(staticCanvas.height, 600);
        this.cellPx = Math.min(
            Math.floor(maxWidth / room.width),
            Math.floor(maxHeight / room.height)
        );

        // Resize canvases to fit perfectly
        this.staticCanvas.width = this.room.width * this.cellPx;
        this.staticCanvas.height = this.room.height * this.cellPx;
        this.dynamicCanvas.width = this.room.width * this.cellPx;
        this.dynamicCanvas.height = this.room.height * this.cellPx;

        // Color scheme
        this.colors = {
            floor: '#f5f5f5',
            cleaned: '#c8e6c9',
            obstacle: '#424242',
            rover: '#ff7043',
            text: '#333'
        };
    }

    drawStatic() {
        const ctx = this.staticCtx;
        ctx.fillStyle = this.colors.floor;
        ctx.fillRect(0, 0, this.staticCanvas.width, this.staticCanvas.height);

        // Draw obstacles
        ctx.fillStyle = this.colors.obstacle;
        for (let y = 0; y < this.room.height; y++) {
            for (let x = 0; x < this.room.width; x++) {
                if (this.room.obstacles[y][x] === '1') {
                    ctx.fillRect(x * this.cellPx, y * this.cellPx, this.cellPx, this.cellPx);
                }
            }
        }

        // Draw grid lines (light)
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= this.room.width; i++) {
            ctx.beginPath();
            ctx.moveTo(i * this.cellPx, 0);
            ctx.lineTo(i * this.cellPx, this.staticCanvas.height);
            ctx.stroke();
        }
        for (let i = 0; i <= this.room.height; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * this.cellPx);
            ctx.lineTo(this.staticCanvas.width, i * this.cellPx);
            ctx.stroke();
        }
    }

    drawCleanedCell(x, y) {
        const ctx = this.dynamicCtx;
        ctx.fillStyle = this.colors.cleaned;
        ctx.fillRect(x * this.cellPx + 1, y * this.cellPx + 1, this.cellPx - 2, this.cellPx - 2);
    }

    drawRover(x, y, dirCode) {
        const ctx = this.dynamicCtx;
        const cx = x * this.cellPx + this.cellPx / 2;
        const cy = y * this.cellPx + this.cellPx / 2;
        const r = this.cellPx / 3;

        // Draw rover body
        ctx.fillStyle = this.colors.rover;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Draw direction indicator (small triangle)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.dirCodeToAngle(dirCode));
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(r * 0.6, 0);
        ctx.lineTo(-r * 0.3, -r * 0.3);
        ctx.lineTo(-r * 0.3, r * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    dirCodeToAngle(dirCode) {
        switch (dirCode) {
            case 1: return -Math.PI / 2;  // UP
            case 2: return Math.PI / 2;   // DOWN
            case 3: return Math.PI;       // LEFT
            case 4: return 0;             // RIGHT
            default: return 0;
        }
    }

    reset() {
        this.dynamicCtx.clearRect(0, 0, this.dynamicCanvas.width, this.dynamicCanvas.height);
    }
};
