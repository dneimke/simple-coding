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

        stateService.subscribe('game', this._handleStateChange.bind(this));

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

        if (this.eventButtons) {
            this.eventButtons.setState({
                isActive: gameState.isActive,
                isRunning: gameState.isRunning,
                loggedEvents: gameState.loggedEvents
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

    /**
     * Restore a capture in progress. A clock that was running keeps counting from
     * runningSince, so time spent offline or reloading is included.
     * @param {Object} session
     * @param {Array} session.events - Events logged so far
     * @param {number} session.elapsedTime - Clock banked before the current run (ms)
     * @param {number|null} session.runningSince - Epoch ms the clock last started, or null when paused
     * @param {Array<{code: string, color: string}>|null} [session.teams] - Team 1 and Team 2 for team boards
     * @param {string|null} [session.activeZone] - Sticky zone from Team 1's perspective
     * @param {number|null} [session.selectedTeam] - Team slot picked for shared team buttons
     */
    restoreSession({ events, elapsedTime, runningSince, teams = null, activeZone = null, selectedTeam = null }) {
        this._stopTimerUpdate();

        const isRunning = typeof runningSince === 'number';
        this.startTime = isRunning ? runningSince : 0;

        stateService.setState('game', {
            hasCurrentGame: true,
            isActive: true,
            isRunning,
            elapsedTime,
            loggedEvents: events,
            teams,
            activeZone,
            selectedTeam
        });

        if (isRunning) {
            this._startTimerUpdate();
        }
        this._paintTimer();
    }

    /**
     * Elapsed match time including the current run
     * @returns {number} Elapsed time in ms
     */
    getLiveElapsedTime() {
        const gameState = stateService.getState('game');
        if (!gameState.isRunning) return gameState.elapsedTime;
        return gameState.elapsedTime + Math.max(0, Date.now() - this.startTime);
    }

    /**
     * Snapshot of the capture in progress for the draft store
     * @returns {{events: Array, elapsedTime: number, runningSince: number|null, teams: Array|null, activeZone: string|null, selectedTeam: number|null}}
     */
    getDraftSnapshot() {
        const gameState = stateService.getState('game');
        return {
            events: gameState.loggedEvents,
            elapsedTime: gameState.elapsedTime,
            runningSince: gameState.isRunning ? this.startTime : null,
            teams: gameState.teams ?? null,
            activeZone: gameState.activeZone ?? null,
            selectedTeam: gameState.selectedTeam ?? null
        };
    }

    /**
     * Set the sticky zone (from Team 1's perspective) used by zoned buttons
     * @param {string} zone
     */
    setActiveZone(zone) {
        stateService.setState('game.activeZone', zone);
    }

    /**
     * Set the team slot (1 or 2) that shared team buttons log for
     * @param {number} slot
     */
    setSelectedTeam(slot) {
        stateService.setState('game.selectedTeam', slot);
    }

    /**
     * @returns {boolean} True if the event was logged
     */
    addEvent(event) {
        const gameState = stateService.getState('game');

        if (!gameState.isActive || !gameState.isRunning) {
            logger.warn("Timer not started. Event not logged.");
            return false;
        }

        const events = [...gameState.loggedEvents, event];
        stateService.setState('game.loggedEvents', events);
        return true;
    }

    /**
     * Remove a logged event from the capture in progress (running or paused)
     * @param {number} index - Position in loggedEvents
     * @returns {Object|null} The removed event, or null if nothing was removed
     */
    removeEvent(index) {
        const gameState = stateService.getState('game');
        const events = gameState.loggedEvents || [];
        if (!gameState.hasCurrentGame || !Number.isInteger(index) || index < 0 || index >= events.length) {
            return null;
        }

        const removed = events[index];
        stateService.setState('game.loggedEvents', events.filter((_, i) => i !== index));
        return removed;
    }

    /**
     * Remove the most recently logged event
     * @returns {Object|null} The removed event, or null if there were none
     */
    removeLastEvent() {
        const events = stateService.getState('game.loggedEvents') || [];
        return this.removeEvent(events.length - 1);
    }

    /**
     * @param {Object} [options]
     * @param {Array<{code: string, color: string}>|null} [options.teams] - Team 1 and Team 2 for team boards
     * @param {string|null} [options.activeZone] - Starting sticky zone
     * @param {number|null} [options.selectedTeam] - Starting team slot for shared team buttons
     */
    newGame({ teams = null, activeZone = null, selectedTeam = null } = {}) {
        this._stopTimerUpdate();

        stateService.setState('game', {
            hasCurrentGame: true,
            isActive: true,
            isRunning: true,
            elapsedTime: 0,
            loggedEvents: [],
            teams,
            activeZone,
            selectedTeam
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
            hasCurrentGame: false,
            loggedEvents: [],
            teams: null,
            activeZone: null,
            selectedTeam: null
        }, true);

        this.resetTimer();
    }

    resetTimer() {
        this._stopTimerUpdate();

        if (this.timerDisplay) {
            this.timerDisplay.textContent = '00:00';
            stateService.setState('game', { elapsedTime: 0 }, true);
        }
    }

    /**
     * Start timer update interval
     * @private
     */
    _startTimerUpdate() {
        if (this.timerInterval) return;

        this.timerInterval = setInterval(() => {
            if (!stateService.getState('game.isRunning')) return;
            this._paintTimer();
        }, 1000);
    }

    /**
     * Show the live elapsed time on the timer display
     * @private
     */
    _paintTimer() {
        if (this.timerDisplay) {
            this.timerDisplay.textContent = formatTime(this.getLiveElapsedTime());
        }
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