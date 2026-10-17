import { GameState } from '../../src/components/gameState.js';
import { stateService } from '../../src/services/stateService.js';

const resetGameState = () => {
    stateService.setState('game', {
        isActive: false,
        isRunning: false,
        elapsedTime: 0,
        loggedEvents: [],
        hasCurrentGame: false
    });
};

describe('GameState capture clock', () => {
    let gameState;
    let timerDisplay;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-17T10:00:00Z'));
        resetGameState();
        timerDisplay = document.createElement('div');
        gameState = new GameState(timerDisplay, null, null);
    });

    afterEach(() => {
        gameState.completeGame();
        jest.useRealTimers();
    });

    test('getLiveElapsedTime includes the current run while running', () => {
        gameState.newGame();
        jest.advanceTimersByTime(90000);

        expect(gameState.getLiveElapsedTime()).toBe(90000);
    });

    test('getLiveElapsedTime returns the banked time while paused', () => {
        gameState.newGame();
        jest.advanceTimersByTime(60000);
        gameState.pauseResume();
        jest.advanceTimersByTime(30000);

        expect(gameState.getLiveElapsedTime()).toBe(60000);
    });

    test('getDraftSnapshot records runningSince only while running', () => {
        gameState.newGame();
        const startedAt = Date.now();
        expect(gameState.getDraftSnapshot()).toEqual({
            events: [], elapsedTime: 0, runningSince: startedAt, teams: null, activeZone: null
        });

        jest.advanceTimersByTime(10000);
        gameState.pauseResume();
        expect(gameState.getDraftSnapshot()).toEqual({
            events: [], elapsedTime: 10000, runningSince: null, teams: null, activeZone: null
        });
    });

    test('newGame keeps teams and zone, and setActiveZone updates the snapshot', () => {
        const teams = [{ code: 'FIRE', color: 'red' }, { code: 'TIGERS', color: 'yellow' }];
        gameState.newGame({ teams, activeZone: '1' });
        gameState.setActiveZone('3');

        expect(gameState.getDraftSnapshot()).toEqual(expect.objectContaining({ teams, activeZone: '3' }));
    });

    test('restoreSession round-trips teams and zone', () => {
        const teams = [{ code: 'MELB', color: 'navy' }, { code: 'PERTH', color: 'orange' }];
        gameState.restoreSession({ events: [], elapsedTime: 0, runningSince: null, teams, activeZone: '4' });

        expect(stateService.getState('game.teams')).toEqual(teams);
        expect(gameState.getDraftSnapshot()).toEqual(expect.objectContaining({ teams, activeZone: '4' }));
    });

    test('restoreSession from an old draft leaves teams and zone empty', () => {
        gameState.restoreSession({ events: [], elapsedTime: 0, runningSince: null });

        expect(stateService.getState('game.teams')).toBeNull();
        expect(stateService.getState('game.activeZone')).toBeNull();
    });

    test('restoreSession with runningSince counts the outage and keeps the clock running', () => {
        const events = [{ event: 'GOAL', timeMs: 1000 }];
        const runningSince = Date.now() - 180000;

        gameState.restoreSession({ events, elapsedTime: 600000, runningSince });

        const state = stateService.getState('game');
        expect(state).toEqual(expect.objectContaining({
            hasCurrentGame: true,
            isActive: true,
            isRunning: true,
            loggedEvents: events
        }));
        expect(gameState.getLiveElapsedTime()).toBe(780000);
        expect(timerDisplay.textContent).toBe('13:00');

        jest.advanceTimersByTime(5000);
        expect(timerDisplay.textContent).toBe('13:05');
    });

    test('restoreSession without runningSince stays paused on the banked time', () => {
        gameState.restoreSession({ events: [], elapsedTime: 1930000, runningSince: null });

        expect(stateService.getState('game.isRunning')).toBe(false);
        expect(timerDisplay.textContent).toBe('32:10');

        jest.advanceTimersByTime(60000);
        expect(gameState.getLiveElapsedTime()).toBe(1930000);
        expect(timerDisplay.textContent).toBe('32:10');
    });

    test('addEvent reports whether the event was logged', () => {
        expect(gameState.addEvent({ event: 'GOAL', timeMs: 0 })).toBe(false);

        gameState.newGame();
        expect(gameState.addEvent({ event: 'GOAL', timeMs: 0 })).toBe(true);
        expect(stateService.getState('game.loggedEvents')).toHaveLength(1);
    });

    test('completeGame clears logged events', () => {
        gameState.newGame();
        gameState.addEvent({ event: 'GOAL', timeMs: 0 });
        gameState.completeGame();

        expect(stateService.getState('game.loggedEvents')).toEqual([]);
        expect(stateService.getState('game.hasCurrentGame')).toBe(false);
    });

    test('completeGame clears teams and zone', () => {
        gameState.newGame({ teams: [{ code: 'A', color: 'red' }, { code: 'B', color: 'navy' }], activeZone: '2' });
        gameState.completeGame();

        expect(stateService.getState('game.teams')).toBeNull();
        expect(stateService.getState('game.activeZone')).toBeNull();
    });
});
