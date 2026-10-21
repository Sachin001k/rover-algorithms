// Playback controller: state machine for animation
// States: STOPPED, PAUSED, PLAYING
// Handles seeking, speed control, and efficient rendering with batched steps

window.RVSim = window.RVSim || {};

window.RVSim.Playback = class {
    constructor(trajectory, room) {
        this.trajectory = trajectory;
        this.room = room;
        this.state = 'STOPPED';
        this.currentStepIndex = 0;
        this.cleanedSet = new Set();
        this.builtIndex = 0;       // cleanedSet reflects trajectory[0 .. builtIndex-1]
        this.pendingCells = [];    // cells added since the last emitted frame
        this.needsFullRedraw = true;
        this.speedStepsPerSec = 30;
        this.stepBudget = 0;       // fractional steps carried between frames
        this.animationFrame = null;
        this.lastTickTime = 0;
        // callback(stepIndex, cells, roverX, roverY, dirCode, fullRedraw):
        // fullRedraw=true  -> cells is every cleaned cell (repaint from scratch)
        // fullRedraw=false -> cells is only what changed since the last frame
        this.onFrame = null;
        this.rebuildCleanedSet();
    }

    play() {
        if (this.state === 'PLAYING') return;
        if (this.isAtEnd()) this.seek(0);  // Play at the end replays
        this.state = 'PLAYING';
        this.lastTickTime = performance.now();
        this.stepBudget = 0;
        this.tick();
    }

    pause() {
        this.state = 'PAUSED';
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    stop() {
        this.state = 'STOPPED';
        this.currentStepIndex = 0;
        this.rebuildCleanedSet();
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.emitFrame();
    }

    stepForward() {
        if (this.currentStepIndex < this.trajectory.length) {
            this.currentStepIndex++;
            this.updateCleanedSetToIndex();
            this.emitFrame();
        }
    }

    stepBackward() {
        if (this.currentStepIndex > 0) {
            this.currentStepIndex--;
            this.updateCleanedSetToIndex();
            this.emitFrame();
        }
    }

    seek(stepIndex) {
        this.currentStepIndex = Math.max(0, Math.min(stepIndex, this.trajectory.length));
        this.updateCleanedSetToIndex();
        this.emitFrame();
    }

    setSpeed(stepsPerSec) {
        this.speedStepsPerSec = Math.max(1, stepsPerSec);
    }

    tick() {
        if (this.state !== 'PLAYING') return;

        const now = performance.now();
        const deltaMs = Math.max(0, Math.min(now - this.lastTickTime, 100));
        this.lastTickTime = now;

        // Fractional accumulator: the old max(1, round(...)) played every
        // speed below ~90 steps/sec at the display frame rate.
        this.stepBudget += this.speedStepsPerSec * deltaMs / 1000;
        const stepsPerFrame = Math.floor(this.stepBudget);
        this.stepBudget -= stepsPerFrame;

        for (let i = 0; i < stepsPerFrame; i++) {
            if (this.currentStepIndex < this.trajectory.length) {
                this.currentStepIndex++;
            } else {
                this.pause();
                break;
            }
        }

        this.updateCleanedSetToIndex();
        this.emitFrame();

        if (this.state === 'PLAYING') {
            this.animationFrame = requestAnimationFrame(() => this.tick());
        }
    }

    // The start cell is cleaned before step 1 and is not in the trajectory.
    rebuildCleanedSet() {
        this.cleanedSet.clear();
        this.cleanedSet.add(this.room.startX + ',' + this.room.startY);
        this.builtIndex = 0;
        this.pendingCells = [];
        this.needsFullRedraw = true;
    }

    // Forward moves only add the new entries (O(steps advanced)); moving
    // backwards rebuilds from the start. Rebuilding on every frame made
    // long (100k+ step) trajectories unplayable.
    updateCleanedSetToIndex() {
        if (this.currentStepIndex < this.builtIndex) this.rebuildCleanedSet();
        for (let i = this.builtIndex; i < this.currentStepIndex; i++) {
            const step = this.trajectory[i];
            const key = step[0] + ',' + step[1];
            if (!this.cleanedSet.has(key)) {
                this.cleanedSet.add(key);
                this.pendingCells.push(key);
            }
        }
        this.builtIndex = this.currentStepIndex;
    }

    emitFrame() {
        if (!this.onFrame) return;

        let roverX = this.room.startX;
        let roverY = this.room.startY;
        let roverDir = 0;  // NONE

        if (this.currentStepIndex > 0) {
            const step = this.trajectory[this.currentStepIndex - 1];
            roverX = step[0];
            roverY = step[1];
            roverDir = step[2];
        }

        this.updateCleanedSetToIndex();
        const full = this.needsFullRedraw;
        const cells = full ? Array.from(this.cleanedSet) : this.pendingCells;
        this.pendingCells = [];
        this.needsFullRedraw = false;

        this.onFrame(this.currentStepIndex, cells, roverX, roverY, roverDir, full);
    }

    isAtEnd() {
        return this.currentStepIndex >= this.trajectory.length;
    }

    getProgress() {
        return this.trajectory.length > 0 ? this.currentStepIndex / this.trajectory.length : 0;
    }
};
