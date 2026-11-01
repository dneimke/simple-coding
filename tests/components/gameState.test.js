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

    test('newGame arms the game at 00:00 with isRunning false by default', () => {
        gameState.newGame();

        expect(stateService.getState('game.hasCurrentGame')).toBe(true);
        expect(stateService.getState('game.isRunning')).toBe(false);
        expect(gameState.getLiveElapsedTime()).toBe(0);
        expect(timerDisplay.textContent).toBe('00:00');
    });

    test('startClock starts an armed game and advances timer', () => {
        gameState.newGame();
        gameState.startClock();

        expect(stateService.getState('game.isRunning')).toBe(true);
        jest.advanceTimersByTime(15000);
        expect(gameState.getLiveElapsedTime()).toBe(15000);
        expect(timerDisplay.textContent).toBe('00:15');
    });

    test('getLiveElapsedTime includes the current run while running', () => {
        gameState.newGame({ autoStart: true });
        jest.advanceTimersByTime(90000);

        expect(gameState.getLiveElapsedTime()).toBe(90000);
    });

    test('getLiveElapsedTime returns the banked time while paused', () => {
        gameState.newGame({ autoStart: true });
        jest.advanceTimersByTime(60000);
        gameState.pauseResume();
        jest.advanceTimersByTime(30000);

        expect(gameState.getLiveElapsedTime()).toBe(60000);
    });

    test('getDraftSnapshot records runningSince only while running', () => {
        gameState.newGame({ autoStart: true });
        const startedAt = Date.now();
        expect(gameState.getDraftSnapshot()).toEqual({
            events: [], elapsedTime: 0, runningSince: startedAt, teams: null, activeZone: null, selectedTeam: null
        });

        jest.advanceTimersByTime(10000);
        gameState.pauseResume();
        expect(gameState.getDraftSnapshot()).toEqual({
            events: [], elapsedTime: 10000, runningSince: null, teams: null, activeZone: null, selectedTeam: null
        });
    });

    test('newGame keeps teams and zone, and setActiveZone updates the snapshot', () => {
        const teams = [{ code: 'FIRE', color: 'red' }, { code: 'TIGERS', color: 'yellow' }];
        gameState.newGame({ teams, activeZone: '1', selectedTeam: 1 });
        gameState.setActiveZone('3');
        gameState.setSelectedTeam(2);

        expect(gameState.getDraftSnapshot()).toEqual(expect.objectContaining({ teams, activeZone: '3', selectedTeam: 2 }));
    });

    test('restoreSession round-trips teams, zone and selected team', () => {
        const teams = [{ code: 'MELB', color: 'navy' }, { code: 'PERTH', color: 'orange' }];
        gameState.restoreSession({ events: [], elapsedTime: 0, runningSince: null, teams, activeZone: '4', selectedTeam: 2 });

        expect(stateService.getState('game.teams')).toEqual(teams);
        expect(gameState.getDraftSnapshot()).toEqual(expect.objectContaining({ teams, activeZone: '4', selectedTeam: 2 }));
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

        // While armed at 00:00 (not running), events are not logged
        gameState.newGame();
        expect(gameState.addEvent({ event: 'GOAL', timeMs: 0 })).toBe(false);

        // Once started, events are logged
        gameState.startClock();
        expect(gameState.addEvent({ event: 'GOAL', timeMs: 0 })).toBe(true);
        expect(stateService.getState('game.loggedEvents')).toHaveLength(1);
    });

    test('removeEvent removes the event at an index and returns it', () => {
        gameState.newGame({ autoStart: true });
        ['A', 'B', 'C'].forEach(event => gameState.addEvent({ event, timeMs: 0 }));

        expect(gameState.removeEvent(1)).toEqual({ event: 'B', timeMs: 0 });
        expect(stateService.getState('game.loggedEvents').map(e => e.event)).toEqual(['A', 'C']);
    });

    test('removeLastEvent removes the newest event, including while paused', () => {
        gameState.newGame({ autoStart: true });
        gameState.addEvent({ event: 'A', timeMs: 0 });
        gameState.addEvent({ event: 'B', timeMs: 1000 });
        gameState.pauseResume();

        expect(gameState.removeLastEvent()).toEqual({ event: 'B', timeMs: 1000 });
        expect(stateService.getState('game.loggedEvents').map(e => e.event)).toEqual(['A']);
    });

    test('removeEvent and removeLastEvent return null when nothing can be removed', () => {
        expect(gameState.removeLastEvent()).toBeNull();

        gameState.newGame({ autoStart: true });
        expect(gameState.removeLastEvent()).toBeNull();
        gameState.addEvent({ event: 'A', timeMs: 0 });
        expect(gameState.removeEvent(5)).toBeNull();
        expect(gameState.removeEvent(-1)).toBeNull();
        expect(gameState.removeEvent('0')).toBeNull();
        expect(stateService.getState('game.loggedEvents')).toHaveLength(1);
    });

    test('completeGame clears logged events', () => {
        gameState.newGame({ autoStart: true });
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

    test('updateLastEvent updates the newest event with partial fields like labels', () => {
        gameState.newGame({ autoStart: true });
        gameState.addEvent({ event: 'FIRE CE', timeMs: 5000 });

        const updated = gameState.updateLastEvent({ labels: [{ group: 'Channel', text: 'Left' }] });
        expect(updated).toEqual({
            event: 'FIRE CE',
            timeMs: 5000,
            labels: [{ group: 'Channel', text: 'Left' }]
        });
        expect(stateService.getState('game.loggedEvents')[0].labels).toEqual([{ group: 'Channel', text: 'Left' }]);
    });

    test('updateLastEvent returns null when no current game or no events', () => {
        expect(gameState.updateLastEvent({ labels: [] })).toBeNull();
        gameState.newGame({ autoStart: true });
        expect(gameState.updateLastEvent({ labels: [] })).toBeNull();
    });
});
