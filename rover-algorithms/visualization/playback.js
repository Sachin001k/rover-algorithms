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
        this.speedStepsPerSec = 30;
        this.animationFrame = null;
        this.lastTickTime = 0;
        this.onFrame = null;  // callback(stepIndex, newCells, roverX, roverY, dirCode)
    }

    play() {
        if (this.state === 'PLAYING') return;
        this.state = 'PLAYING';
        this.lastTickTime = Date.now();
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
        this.cleanedSet.clear();
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

        const now = Date.now();
        const deltaMs = now - this.lastTickTime;
        this.lastTickTime = now;

        // Calculate how many steps to advance this frame
        const stepsPerFrame = Math.max(1, Math.round((this.speedStepsPerSec / 60) * (deltaMs / 16)));

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

    updateCleanedSetToIndex() {
        // Rebuild cleanedSet up to currentStepIndex
        this.cleanedSet.clear();
        for (let i = 0; i < this.currentStepIndex; i++) {
            const step = this.trajectory[i];
            const key = step[0] + ',' + step[1];
            this.cleanedSet.add(key);
        }
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

        // Collect all cleaned cells up to current index
        const newCells = Array.from(this.cleanedSet);

        this.onFrame(this.currentStepIndex, newCells, roverX, roverY, roverDir);
    }

    isAtEnd() {
        return this.currentStepIndex >= this.trajectory.length;
    }

    getProgress() {
        return this.trajectory.length > 0 ? this.currentStepIndex / this.trajectory.length : 0;
    }
};
