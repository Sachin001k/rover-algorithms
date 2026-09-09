// Main application: bootstraps playback and dashboard tabs

window.RVSim = window.RVSim || {};

window.RVSim.App = class {
    constructor() {
        this.playbackTab = null;
        this.dashboardTab = null;
        this.setupTabs();
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach((button, index) => {
            button.addEventListener('click', () => {
                tabButtons.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                button.classList.add('active');
                tabContents[index].classList.add('active');
            });
        });

        // Setup Playback tab
        this.setupPlaybackTab();

        // Setup Dashboard tab (placeholder for Phase 5)
        this.setupDashboardTab();
    }

    setupPlaybackTab() {
        const fileInput = document.getElementById('trajectoryFile');
        const loadBtn = document.getElementById('loadTrajectoryBtn');

        loadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    this.loadPlayback(data);
                } catch (err) {
                    alert('Error parsing JSON: ' + err.message);
                }
            };
            reader.readAsText(file);
        });
    }

    loadPlayback(jsonData) {
        const container = document.getElementById('playbackContainer');
        container.innerHTML = '';

        try {
            // Validate JSON structure
            if (!jsonData.room || !jsonData.trajectory || !jsonData.summary) {
                throw new Error('Invalid JSON schema: missing room, trajectory, or summary');
            }

            // Create canvas elements
            const staticCanvas = document.createElement('canvas');
            staticCanvas.id = 'staticLayer';
            staticCanvas.width = 800;
            staticCanvas.height = 600;

            const dynamicCanvas = document.createElement('canvas');
            dynamicCanvas.id = 'dynamicLayer';
            dynamicCanvas.width = 800;
            dynamicCanvas.height = 600;

            staticCanvas.style.position = 'absolute';
            dynamicCanvas.style.position = 'absolute';

            const canvasContainer = document.createElement('div');
            canvasContainer.style.position = 'relative';
            canvasContainer.style.width = '800px';
            canvasContainer.style.height = '600px';
            canvasContainer.style.border = '1px solid #ddd';
            canvasContainer.appendChild(staticCanvas);
            canvasContainer.appendChild(dynamicCanvas);

            container.appendChild(canvasContainer);

            // Create controls
            const controls = this.createPlaybackControls(jsonData, staticCanvas, dynamicCanvas);
            container.appendChild(controls);

            // Create info panel
            const info = this.createInfoPanel(jsonData);
            container.appendChild(info);
        } catch (err) {
            container.innerHTML = '<p style="color: red;">Error loading playback: ' + err.message + '</p>';
        }
    }

    createPlaybackControls(jsonData, staticCanvas, dynamicCanvas) {
        const div = document.createElement('div');
        div.className = 'playback-controls';

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginBottom = '10px';

        const playBtn = document.createElement('button');
        playBtn.textContent = '▶ Play';
        playBtn.className = 'control-btn';

        const pauseBtn = document.createElement('button');
        pauseBtn.textContent = '⏸ Pause';
        pauseBtn.className = 'control-btn';

        const stopBtn = document.createElement('button');
        stopBtn.textContent = '⏹ Stop';
        stopBtn.className = 'control-btn';

        const stepBackBtn = document.createElement('button');
        stepBackBtn.textContent = '◀ Step Back';
        stepBackBtn.className = 'control-btn';

        const stepFwdBtn = document.createElement('button');
        stepFwdBtn.textContent = 'Step Forward ▶';
        stepFwdBtn.className = 'control-btn';

        buttonContainer.appendChild(playBtn);
        buttonContainer.appendChild(pauseBtn);
        buttonContainer.appendChild(stopBtn);
        buttonContainer.appendChild(stepBackBtn);
        buttonContainer.appendChild(stepFwdBtn);

        // Speed control
        const speedContainer = document.createElement('div');
        speedContainer.style.marginBottom = '10px';
        speedContainer.innerHTML = '<label>Speed: <input type="range" id="speedSlider" min="1" max="200" value="30" style="width: 150px;"> <span id="speedLabel">30</span> steps/sec</label>';

        // Scrubber
        const scrubContainer = document.createElement('div');
        scrubContainer.style.marginBottom = '10px';
        const scrubInput = document.createElement('input');
        scrubInput.type = 'range';
        scrubInput.id = 'scrubber';
        scrubInput.min = '0';
        scrubInput.max = jsonData.trajectory.length;
        scrubInput.value = '0';
        scrubInput.style.width = '100%';
        scrubInput.style.cursor = 'pointer';

        const scrubLabel = document.createElement('label');
        scrubLabel.style.display = 'block';
        scrubLabel.style.marginTop = '5px';
        scrubLabel.innerHTML = 'Step: <span id="stepLabel">0</span> / ' + jsonData.trajectory.length;

        scrubContainer.appendChild(scrubInput);
        scrubContainer.appendChild(scrubLabel);

        div.appendChild(buttonContainer);
        div.appendChild(speedContainer);
        div.appendChild(scrubContainer);

        // Initialize renderer and playback
        const room = {
            width: jsonData.room.width,
            height: jsonData.room.height,
            obstacles: jsonData.room.obstacles,
            startX: jsonData.room.startX,
            startY: jsonData.room.startY
        };

        const renderer = new window.RVSim.GridRenderer(staticCanvas, dynamicCanvas, room);
        renderer.drawStatic();

        const playback = new window.RVSim.Playback(jsonData.trajectory, room);
        playback.onFrame = (stepIndex, newCells, roverX, roverY, roverDir) => {
            renderer.reset();
            newCells.forEach(cellKey => {
                const [x, y] = cellKey.split(',').map(Number);
                renderer.drawCleanedCell(x, y);
            });
            if (stepIndex > 0) {
                renderer.drawRover(roverX, roverY, roverDir);
            }
            document.getElementById('stepLabel').textContent = stepIndex;
            scrubInput.value = stepIndex;
        };

        playback.emitFrame();

        // Wire up buttons
        playBtn.addEventListener('click', () => playback.play());
        pauseBtn.addEventListener('click', () => playback.pause());
        stopBtn.addEventListener('click', () => playback.stop());
        stepBackBtn.addEventListener('click', () => playback.stepBackward());
        stepFwdBtn.addEventListener('click', () => playback.stepForward());

        const speedSlider = speedContainer.querySelector('#speedSlider');
        speedSlider.addEventListener('input', (e) => {
            const speed = parseInt(e.target.value);
            playback.setSpeed(speed);
            speedContainer.querySelector('#speedLabel').textContent = speed;
        });

        scrubInput.addEventListener('input', (e) => {
            playback.seek(parseInt(e.target.value));
        });

        return div;
    }

    createInfoPanel(jsonData) {
        const div = document.createElement('div');
        div.className = 'info-panel';
        div.style.marginTop = '20px';
        div.style.padding = '10px';
        div.style.backgroundColor = '#f5f5f5';
        div.style.borderRadius = '4px';

        const s = jsonData.summary;
        const r = jsonData.room;
        const c = jsonData.config;

        div.innerHTML = `
            <strong>Algorithm:</strong> ${jsonData.algorithm}<br>
            <strong>Room:</strong> ${r.width}×${r.height} (${r.complexityLevel})<br>
            <strong>Coverage:</strong> ${s.coveragePercent.toFixed(1)}%<br>
            <strong>Steps:</strong> ${s.steps} | <strong>Revisits:</strong> ${s.revisits} | <strong>Turns:</strong> ${s.turns}<br>
            <strong>Overlap Ratio:</strong> ${s.overlapRatio.toFixed(6)}<br>
            <strong>Time:</strong> ${s.cleaningTimeSec.toFixed(1)}s
        `;

        return div;
    }

    setupDashboardTab() {
        const fileInput = document.getElementById('metricsFile');
        const loadBtn = document.getElementById('loadMetricsBtn');

        loadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const csv = event.target.result;
                    this.loadDashboard(csv);
                } catch (err) {
                    alert('Error parsing CSV: ' + err.message);
                }
            };
            reader.readAsText(file);
        });
    }

    loadDashboard(csvText) {
        const container = document.getElementById('dashboardContainer');
        window.RVSim.Dashboard.render(container, csvText);
    }
};

// Initialize app on document ready
document.addEventListener('DOMContentLoaded', () => {
    window.RVSim.app = new window.RVSim.App();
});
