import { formatTime } from '../utils/formatUtils.js';
import { logger } from '../utils/formatUtils.js';
import { stateService } from '../services/stateService.js';

export class GameState {

    constructor(timerDisplay, eventLog, eventButtons) {
        this.eventButtons = eventButtons;
        this.eventLog = eventLog;
        this.timerDisplay = timerDisplay;
        this.startTime = 0;
        this.timerInterval = null;

        // Subscribe to state changes
        stateService.subscribe('game', this._handleStateChange.bind(this));

        // Initialize UI with current state
        this._updateUI(stateService.getState('game'));
    }

    /**
     * Handle state changes from stateService
     * @param {Object} gameState - New game state
     * @private
     */
    _handleStateChange(gameState) {
        this._updateUI(gameState);
    }

    /**
     * Update UI components based on state
     * @param {Object} gameState - Game state
     * @private
     */
    _updateUI(gameState) {
        // Update event log if available
        if (gameState.loggedEvents && this.eventLog) {
            this.eventLog.render(gameState.loggedEvents);
        }

        // Update event buttons if available
        if (this.eventButtons) {
            this.eventButtons.setState({
                isActive: gameState.isActive,
                isRunning: gameState.isRunning
            });
        }
    }

    setGameState(newState) {
        this._stopTimerUpdate();
        stateService.setState('game', newState, true);

        // Set up timer if game is running
        if (newState.isRunning) {
            this.startTime = Date.now();
            this._startTimerUpdate();
        }
    }

    addEvent(event) {
        const gameState = stateService.getState('game');

        if (!gameState.isActive || !gameState.isRunning) {
            logger.warn("Timer not started. Event not logged.");
            return;
        }

        const events = [...gameState.loggedEvents, event];
        stateService.setState('game.loggedEvents', events);
    }

    newGame() {
        this._stopTimerUpdate();

        stateService.setState('game', {
            hasCurrentGame: true,
            isActive: true,
            isRunning: true,
            elapsedTime: 0,
            loggedEvents: []
        });

        this.startTime = Date.now();
        this._startTimerUpdate();
    }

    pauseResume() {
        const gameState = stateService.getState('game');

        if (gameState.isRunning) {
            // Pause
            const currentTime = Date.now();
            const elapsedTime = gameState.elapsedTime + (currentTime - this.startTime);

            stateService.setState('game', {
                isRunning: false,
                elapsedTime
            }, true);

            this._stopTimerUpdate();
        } else {
            // Resume
            stateService.setState('game.isRunning', true);
            this.startTime = Date.now();
            this._startTimerUpdate();
        }
    }

    completeGame() {
        this._stopTimerUpdate();

        stateService.setState('game', {
            isActive: false,
            isRunning: false,
            hasCurrentGame: false
        }, true);

        if (this.timerDisplay) {
            this.timerDisplay.textContent = '00:00';
        }
    }

    /**
     * Start timer update interval
     * @private
     */
    _startTimerUpdate() {
        if (this.timerInterval) return;

        this.timerInterval = setInterval(() => {
            const gameState = stateService.getState('game');
            if (!gameState.isRunning) return;

            if (this.timerDisplay) {
                const currentTime = Date.now();
                const currentElapsedTime = gameState.elapsedTime + (currentTime - this.startTime);
                this.timerDisplay.textContent = formatTime(currentElapsedTime);
            }
        }, 1000);
    }

    /**
     * Stop timer update interval
     * @private
     */
    _stopTimerUpdate() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}