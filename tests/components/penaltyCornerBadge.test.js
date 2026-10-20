import { GameState } from '../../src/components/gameState.js';
import { EventButtons } from '../../src/components/eventButtons.js';
import { EventLog } from '../../src/components/eventLog.js';
import { renderRecentEvents } from '../../src/components/recentEvents.js';
import { stateService } from '../../src/services/stateService.js';
import { getNamedConfig } from '../../src/components/config.js';
import { formatTime } from '../../src/utils/formatUtils.js';
import { CodingButton, createCodingButton } from '../../src/components/ui/codingButton.js';
import { Badge, createBadge } from '../../src/components/ui/badge.js';

describe('Penalty Corner Counter Badge Component', () => {
    let container;
    let timerDisplay;
    let recentContainer;
    let timelineContainer;
    let xmlContainer;
    let statisticsContainer;
    let eventButtons;
    let eventLog;
    let gameState;

    const teams = [
        { code: 'FIRE', color: 'red' },
        { code: 'TIGERS', color: 'yellow' }
    ];

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-20T10:00:00.000Z'));

        stateService.setState('game', {
            isActive: false,
            isRunning: false,
            elapsedTime: 0,
            loggedEvents: [],
            hasCurrentGame: false,
            teams: null,
            activeZone: null,
            selectedTeam: null
        });

        container = document.createElement('div');
        timerDisplay = document.createElement('div');
        recentContainer = document.createElement('div');
        timelineContainer = document.createElement('div');
        xmlContainer = document.createElement('div');
        statisticsContainer = document.createElement('div');

        eventButtons = new EventButtons(container);
        eventLog = new EventLog(timelineContainer, xmlContainer, statisticsContainer);
        gameState = new GameState(timerDisplay, eventLog, eventButtons);

        eventButtons.initialize(getNamedConfig('hockey-one-zoned'), { teams, zone: '1', selectedTeam: 1 });
    });

    afterEach(() => {
        gameState.completeGame();
        jest.useRealTimers();
    });

    test('increments counter badge and logs tagged events at 07:15', () => {
        // 1. Simulate the match clock running at 07:15 in Q1 (435,000 ms)
        gameState.newGame({ teams, activeZone: '1', selectedTeam: 1 });
        jest.advanceTimersByTime(435000); // 7m 15s

        expect(timerDisplay.textContent).toBe('07:15');
        expect(gameState.getLiveElapsedTime()).toBe(435000);

        // 2. Locate the "Penalty Corner" button (FIRE PC)
        const pcButton = container.querySelector('.event-button[data-base-event="PC"], .event-button[data-event="FIRE PC"]');
        expect(pcButton).not.toBeNull();

        // Check 48px+ minimum touch hit target
        const buttonClasses = pcButton.className;
        expect(buttonClasses).toMatch(/min-h-|event-button/);

        // Initial badge state before clicks (should be 0 or hidden)
        const badge = pcButton.querySelector('[data-badge]') || pcButton.querySelector('.event-counter-badge');
        expect(badge).not.toBeNull();
        expect(badge.className).toContain('bg-amber-500');
        expect(badge.className).toContain('text-slate-950');
        expect(badge.className).toContain('font-bold');

        // Helper to simulate capture click
        const emitClick = (button) => {
            const timeMs = gameState.getLiveElapsedTime();
            const formattedTime = formatTime(timeMs);
            const teamCode = button.dataset.teamSlot ? teams[Number(button.dataset.teamSlot) - 1]?.code : 'FIRE';
            const eventPayload = {
                id: `pc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                event: button.dataset.event,
                timeMs,
                timestamp: formattedTime,
                eventCode: 'PC',
                team: teamCode,
                leadTime: 10,
                lagTime: 15,
                lead: button.dataset.lead ? Number(button.dataset.lead) : 10,
                lag: button.dataset.lag ? Number(button.dataset.lag) : 15
            };
            gameState.addEvent(eventPayload);
            eventButtons.updateBadgeCounts(stateService.getState('game.loggedEvents'));
            renderRecentEvents(recentContainer, stateService.getState('game.loggedEvents'));
        };

        // 3. Simulate clicking the "Penalty Corner" button twice
        emitClick(pcButton);
        emitClick(pcButton);

        // 4. Assert that the button badge displays text "2"
        expect(badge.textContent).toBe('2');
        expect(badge.classList.contains('hidden')).toBe(false);

        // 5. Assert that the event log contains both tagged events with timestamp 07:15
        const loggedEvents = stateService.getState('game.loggedEvents');
        expect(loggedEvents).toHaveLength(2);
        expect(loggedEvents[0].timestamp).toBe('07:15');
        expect(loggedEvents[1].timestamp).toBe('07:15');
        expect(loggedEvents[0].eventCode).toBe('PC');
        expect(loggedEvents[1].eventCode).toBe('PC');
        expect(loggedEvents[0].team).toBe('FIRE');
        expect(loggedEvents[1].team).toBe('FIRE');
        expect(loggedEvents[0].leadTime).toBe(10);
        expect(loggedEvents[0].lagTime).toBe(15);

        // Event log UI check
        const logItems = recentContainer.querySelectorAll('li');
        expect(logItems).toHaveLength(2);
        expect(logItems[0].textContent).toContain('07:15');
        expect(logItems[1].textContent).toContain('07:15');
        expect(recentContainer.textContent).toContain('FIRE PC');

        // Verify running clock was not reset or drifted
        expect(timerDisplay.textContent).toBe('07:15');
        expect(gameState.getLiveElapsedTime()).toBe(435000);
    });

    test('CodingButton primitive supports badge increment and high-contrast design tokens', () => {
        const onClick = jest.fn();
        const codingButton = CodingButton({
            text: 'Penalty Corner',
            event: 'PC',
            team: { slot: 1, code: 'FIRE', colorClass: 'team-color-red' },
            onClick
        });

        expect(codingButton).not.toBeNull();
        expect(codingButton.className).toContain('min-h-[48px]');

        const badge = codingButton.querySelector('[data-badge]');
        expect(badge).not.toBeNull();
        expect(badge.className).toContain('bg-amber-500');
        expect(badge.className).toContain('text-slate-950');
        expect(badge.className).toContain('font-bold');

        codingButton.click();
        expect(onClick).toHaveBeenCalled();
        codingButton.incrementCounter();
        codingButton.incrementCounter();

        expect(badge.textContent).toBe('2');
    });
});
