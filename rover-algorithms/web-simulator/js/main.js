// Main Application: Initialize and manage UI

class RobotVacuumSimulator {
    constructor() {
        // Initialize UI components
        this.canvas = document.getElementById('gridCanvas');
        this.gridUI = new GridUI(this.canvas, 40, 40);
        this.roomEditor = new RoomEditor(this.gridUI);

        // State
        this.simulator = null;
        this.currentAlgorithm = 'zigzag';

        // Setup event listeners
        this.setupUIListeners();

        // Generate initial room
        this.generateRoom();
    }

    setupUIListeners() {
        // Room settings
        document.getElementById('roomSize').addEventListener('change', () => this.handleRoomSizeChange());
        document.getElementById('complexity').addEventListener('change', () => this.generateRoom());
        document.getElementById('density').addEventListener('input', (e) => {
            document.getElementById('densityValue').textContent = e.target.value + '%';
        });

        // Room generation
        document.getElementById('generateRoomBtn').addEventListener('click', () => this.generateRoom());
        document.getElementById('clearRoomBtn').addEventListener('click', () => this.clearRoom());

        // Preset buttons
        document.querySelectorAll('.btn-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.target.getAttribute('data-preset');
                this.roomEditor.generatePreset(preset);
            });
        });

        // Algorithm selection
        document.querySelectorAll('input[name="algorithm"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentAlgorithm = e.target.value;
            });
        });

        // Speed control
        document.getElementById('speed').addEventListener('input', (e) => {
            document.getElementById('speedValue').textContent = e.target.value;
            if (this.simulator && this.simulator.running) {
                this.simulator.setSpeed(parseInt(e.target.value));
            }
        });

        // Simulation controls
        document.getElementById('startBtn').addEventListener('click', () => this.startSimulation());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pauseSimulation());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetSimulation());
    }

    handleRoomSizeChange() {
        const size = parseInt(document.getElementById('roomSize').value);
        this.gridUI.resize(size, size);
        this.generateRoom();
    }

    generateRoom() {
        const complexity = document.getElementById('complexity').value;
        const density = document.getElementById('density').value;
        const seed = document.getElementById('seed').value;

        if (complexity === 'custom') {
            this.gridUI.clear();
        } else {
            this.roomEditor.generateByComplexity(complexity, seed || null);
        }
    }

    clearRoom() {
        this.roomEditor.clear();
    }

    createAlgorithm(algorithmName, seed = null) {
        const seedVal = seed ? parseInt(seed) : Math.floor(Math.random() * 1000000);

        switch (algorithmName) {
            case 'zigzag':
                return new window.Algorithms.ZigZagAlgorithm();
            case 'wallfollow':
                return new window.Algorithms.ZigZagWallFollowHybrid();
            case 'randomwalk':
                return new window.Algorithms.RandomWalkAlgorithm(seedVal);
            case 'randomescapse':
                return new window.Algorithms.ZigZagRandomEscapeHybrid(seedVal);
            default:
                return new window.Algorithms.ZigZagAlgorithm();
        }
    }

    startSimulation() {
        console.log('🚀 Starting simulation with:', this.currentAlgorithm);

        // Disable room editing
        this.setRoomControlsEnabled(false);

        // Enable simulation controls
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('resetBtn').disabled = false;

        // Reset metrics
        this.resetMetrics();

        // Create algorithm
        const seed = document.getElementById('algoSeed').value;
        const algorithm = this.createAlgorithm(this.currentAlgorithm, seed);

        // Create simulator
        this.simulator = new window.Simulator(this.gridUI, algorithm);
        this.simulator.setSpeed(parseInt(document.getElementById('speed').value));

        // Setup callbacks
        this.simulator.onFrameUpdate = (metrics) => this.updateMetricsDisplay(metrics);
        this.simulator.onSimulationComplete = (result) => this.simulationComplete(result);

        // Start simulation
        this.simulator.start();
    }

    pauseSimulation() {
        if (this.simulator) {
            if (this.simulator.paused) {
                this.simulator.resume();
                document.getElementById('pauseBtn').textContent = '⏸ Pause';
            } else {
                this.simulator.pause();
                document.getElementById('pauseBtn').textContent = '▶ Resume';
            }
        }
    }

    resetSimulation() {
        if (this.simulator) {
            this.simulator.stop();
            this.simulator = null;
        }

        // Reset rover to start position
        this.gridUI.clear();

        // Re-enable room editing
        this.setRoomControlsEnabled(true);

        // Disable simulation controls
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('pauseBtn').textContent = '⏸ Pause';
        document.getElementById('resetBtn').disabled = true;

        // Reset metrics
        this.resetMetrics();
    }

    setRoomControlsEnabled(enabled) {
        document.getElementById('generateRoomBtn').disabled = !enabled;
        document.getElementById('clearRoomBtn').disabled = !enabled;
        document.getElementById('roomSize').disabled = !enabled;
        document.getElementById('complexity').disabled = !enabled;
        document.getElementById('density').disabled = !enabled;
        document.getElementById('seed').disabled = !enabled;
        document.getElementById('algoSeed').disabled = !enabled;
        document.querySelectorAll('input[name="algorithm"]').forEach(radio => {
            radio.disabled = !enabled;
        });
    }

    updateMetricsDisplay(metrics) {
        document.getElementById('metricStep').textContent = metrics.step;
        document.getElementById('metricCoord').textContent = `(${metrics.x}, ${metrics.y})`;
        document.getElementById('metricCoverage').textContent = metrics.coverage.toFixed(1) + '%';
        document.getElementById('metricDir').textContent = this.getDirectionName(metrics.direction);
        document.getElementById('metricRevisits').textContent = metrics.revisits;
        document.getElementById('metricTurns').textContent = metrics.turns;
        document.getElementById('metricTime').textContent = metrics.time.toFixed(1) + 's';

        // Update progress bar
        const coverage = Math.min(metrics.coverage, 100);
        document.getElementById('progressFill').style.width = coverage + '%';
        document.getElementById('progressLabel').textContent = Math.round(coverage) + '%';
    }

    simulationComplete(result) {
        console.log('✅ Simulation complete:', result);

        // Enable reset button
        document.getElementById('resetBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('startBtn').disabled = false;

        // Show summary in dashboard
        this.showSimulationSummary(result);

        // Show popup with stats
        this.showCompletionPopup(result);
    }

    showCompletionPopup(result) {
        // Create popup overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;

        // Create popup content
        const popup = document.createElement('div');
        popup.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        `;

        const isPerfect = result.completionReason === 'PERFECT_COVERAGE';
        const titleColor = isPerfect ? '#4caf50' : '#ff7043';
        const titleEmoji = isPerfect ? '🎉' : '✅';

        popup.innerHTML = `
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="font-size: 48px; margin-bottom: 10px;">${titleEmoji}</div>
                <h2 style="margin: 0; color: ${titleColor}; font-size: 24px;">${result.statusTitle}</h2>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">${result.status}</div>
            </div>

            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                    <div>
                        <div style="color: #999; font-size: 12px; font-weight: 600; margin-bottom: 5px;">ALGORITHM</div>
                        <div style="font-weight: 600; font-size: 16px;">${result.algorithmName}</div>
                    </div>
                    <div>
                        <div style="color: #999; font-size: 12px; font-weight: 600; margin-bottom: 5px;">RATING</div>
                        <div style="font-weight: 600; font-size: 16px; color: #ff7043;">${result.performanceRating}</div>
                    </div>
                    <div>
                        <div style="color: #999; font-size: 12px; font-weight: 600; margin-bottom: 5px;">COVERAGE</div>
                        <div style="font-weight: 600; font-size: 16px; color: #4caf50;">${result.coveragePercent.toFixed(1)}%</div>
                    </div>
                    <div>
                        <div style="color: #999; font-size: 12px; font-weight: 600; margin-bottom: 5px;">TIME</div>
                        <div style="font-weight: 600; font-size: 16px;">${result.elapsedSeconds.toFixed(1)}s</div>
                    </div>
                </div>
            </div>

            <div style="font-size: 13px; line-height: 1.8; color: #333;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #666;">Steps:</span>
                    <strong>${result.steps}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #666;">Revisits:</span>
                    <strong>${result.revisits} (${result.revisitPercentage.toFixed(1)}%)</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #666;">Turns:</span>
                    <strong>${result.turns}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #666;">Speed:</span>
                    <strong>${result.avgSpeed} steps/sec</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #666;">Area Explored:</span>
                    <strong>${result.areaExplored}/${result.accessibleCells} (${result.areaExploredPercent.toFixed(1)}%)</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #666;">Travel Distance:</span>
                    <strong>${(result.travelDistanceCm / 100).toFixed(1)}m</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span style="color: #666;">Cleaning Time:</span>
                    <strong>${result.cleaningTimeSec.toFixed(1)}s</strong>
                </div>
            </div>

            <button id="closePopupBtn" style="
                width: 100%;
                margin-top: 25px;
                padding: 12px;
                background: #ff7043;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
            " onmouseover="this.style.background='#e64a19'" onmouseout="this.style.background='#ff7043'">
                Close
            </button>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Close popup handler
        document.getElementById('closePopupBtn').addEventListener('click', () => {
            overlay.remove();
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    showSimulationSummary(result) {
        const summaryHTML = `
            <div style="background: #f9f9f9; padding: 25px; border-radius: 8px;">
                <!-- Status Badge -->
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 24px;">${result.status}</h2>
                    <div style="font-size: 18px; font-weight: 600; color: #ff7043; margin-top: 5px;">Rating: ${result.performanceRating}</div>
                </div>

                <!-- Key Metrics Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: white; padding: 12px; border-radius: 4px; border-left: 4px solid #ff7043;">
                        <div style="color: #666; font-size: 12px; font-weight: 600;">COVERAGE</div>
                        <div style="font-size: 24px; font-weight: bold; color: #ff7043;">${result.coveragePercent.toFixed(1)}%</div>
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 4px; border-left: 4px solid #4caf50;">
                        <div style="color: #666; font-size: 12px; font-weight: 600;">EFFICIENCY</div>
                        <div style="font-size: 24px; font-weight: bold; color: #4caf50;">${result.efficiencyScore}</div>
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 4px; border-left: 4px solid #2196f3;">
                        <div style="color: #666; font-size: 12px; font-weight: 600;">TIME</div>
                        <div style="font-size: 24px; font-weight: bold; color: #2196f3;">${result.elapsedSeconds.toFixed(1)}s</div>
                    </div>
                </div>

                <!-- Detailed Metrics -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; font-size: 13px;">
                    <div style="background: white; padding: 12px; border-radius: 4px;">
                        <strong>Steps:</strong> ${result.steps}
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 4px;">
                        <strong>Revisits:</strong> ${result.revisits} (${result.revisitPercentage.toFixed(1)}%)
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 4px;">
                        <strong>Turns:</strong> ${result.turns}
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 4px;">
                        <strong>Area Explored:</strong> ${result.areaExplored}/${result.accessibleCells} (${result.areaExploredPercent.toFixed(1)}%)
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 4px;">
                        <strong>Unreachable Cells:</strong> ${result.unreachableCells}
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 4px;">
                        <strong>Speed:</strong> ${result.avgSpeed} steps/sec
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 4px;">
                        <strong>Travel Distance:</strong> ${(result.travelDistanceCm / 100).toFixed(0)}m
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 4px;">
                        <strong>Cleaning Time:</strong> ${result.cleaningTimeSec.toFixed(1)}s
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 4px;">
                        <strong>Overlap Ratio:</strong> ${(result.overlapRatio * 100).toFixed(2)}%
                    </div>
                </div>
            </div>
        `;
        document.getElementById('dashboardContent').innerHTML = summaryHTML;
    }

    resetMetrics() {
        document.getElementById('metricStep').textContent = '0';
        document.getElementById('metricCoord').textContent = '(0, 0)';
        document.getElementById('metricCoverage').textContent = '0.0%';
        document.getElementById('metricDir').textContent = '-';
        document.getElementById('metricRevisits').textContent = '0';
        document.getElementById('metricTurns').textContent = '0';
        document.getElementById('metricTime').textContent = '0.0s';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressLabel').textContent = '0%';
        document.getElementById('dashboardContent').innerHTML = 'Load a simulation to see metrics';
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RobotVacuumSimulator();
    console.log('🤖 Robot Vacuum Simulator initialized');
});
