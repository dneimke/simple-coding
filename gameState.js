import { formatTime, logger } from './utils.js';

export class GameState {
    constructor(timerDisplay) {
        this.timerDisplay = timerDisplay;
        this.loggedEvents = [];
        this.isRunning = false;
        this.elapsedTime = 0;
        this.startTime = 0;
        this.timerInterval = null;
        this.hasCurrentGame = false;
        this.isActive = false;
    }

    setGameState(newState) {
        Object.assign(this, newState);
    }

    addEvent(event) {
        if (!this.isActive || !this.isRunning) {
            logger.warn("Timer not started. Event not logged.");
            return;
        }
        this.loggedEvents.push(event);
    }

    clearState() {
        this.pause();
        this.timerDisplay.textContent = '00:00';
        this.setGameState({
            loggedEvents: [],
            isRunning: false,
            elapsedTime: 0,
            startTime: 0,
            hasCurrentGame: false,
            isActive: false,
        });
    }

    pause() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.isRunning = false;
        const currentTime = Date.now();
        this.elapsedTime += (currentTime - this.startTime);
    }

    start() {
        if (this.timerInterval) return;
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const currentTime = Date.now();
            const currentElapsedTime = this.isRunning
                ? this.elapsedTime + (currentTime - this.startTime)
                : this.elapsedTime;
            this.timerDisplay.textContent = formatTime(currentElapsedTime);
        }, 1000);
        this.isRunning = true;
    }
}