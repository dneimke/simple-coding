import { formatTime } from '../utils/formatUtils.js';
import { logger } from '../utils/formatUtils.js';

export class GameState {
    constructor(timerDisplay, eventLog, eventButtons) {
        this.eventButtons = eventButtons;
        this.eventLog = eventLog;
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
        this.clearState();
        Object.assign(this, newState);
        this.eventLog.render(this.loggedEvents);
        this.eventButtons.setState(this);
    }

    addEvent(event) {
        if (!this.isActive || !this.isRunning) {
            logger.warn("Timer not started. Event not logged.");
            return;
        }
        this.loggedEvents.push(event);
        this.eventLog.render(this.loggedEvents);
    }

    newGame() {
        this.clearState();
        this.setGameState({
            hasCurrentGame: true,
            isActive: true,
        });

        this.start();
    }

    pauseResume() {
        if (this.isRunning) {
            this.pause();
        } else {
            this.start();
        }
    }

    completeGame() {
        this.pause();
        this.clearState();
    }

    /// INTERNAL USE ONLY ///
    clearState() {
        this.pause();
        Object.assign(this, {
            loggedEvents: [],
            isRunning: false,
            elapsedTime: 0,
            startTime: 0,
            hasCurrentGame: false,
            isActive: false,
        });
        this.timerDisplay.textContent = '00:00';

    }

    pause() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.isRunning = false;
        const currentTime = Date.now();
        this.elapsedTime += (currentTime - this.startTime);
        this.eventButtons.setState(this);
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
        this.eventLog.render(this.loggedEvents);
        this.eventButtons.setState(this);

    }
}