import { getSweepScopeOptions, getFriendlyEventName, LABEL_SCHEMAS } from '../../src/utils/eventAnalysisUtils.js';

describe('Sweep Dock and Scope Picker Engine', () => {
    let mockEvents;

    beforeEach(() => {
        mockEvents = [
            { id: 'ev-1', event: 'PRIDE CE', team: 'PRIDE', timeMs: 15000 },
            { id: 'ev-2', event: 'PRIDE CE', team: 'PRIDE', timeMs: 30000, labels: [{ group: 'Channel', text: 'Center' }] },
            { id: 'ev-3', event: 'PRIDE A25E', team: 'PRIDE', timeMs: 45000 },
            { id: 'ev-4', event: 'THUNDER BW', team: 'THUNDER', timeMs: 60000 },
            { id: 'ev-5', event: 'PRIDE GOAL', team: 'PRIDE', timeMs: 80000 } // no schema
        ];
    });

    test('getSweepScopeOptions provides 1-tap presets for high-value categories', () => {
        const options = getSweepScopeOptions(mockEvents);

        // Pride CE (1 unlabelled: ev-1, since ev-2 is already labelled)
        const prideCe = options.find(o => o.team === 'PRIDE' && o.type === 'CE');
        expect(prideCe).toBeDefined();
        expect(prideCe.count).toBe(1);
        expect(prideCe.estTime).toBeDefined();

        // Pride A25E
        const prideA25e = options.find(o => o.team === 'PRIDE' && o.type === 'A25E');
        expect(prideA25e).toBeDefined();
        expect(prideA25e.count).toBe(1);

        // Thunder BW
        const thunderBw = options.find(o => o.team === 'THUNDER' && o.type === 'BW');
        expect(thunderBw).toBeDefined();
        expect(thunderBw.count).toBe(1);

        // All Match Events (3 unlabelled: ev-1, ev-3, ev-4)
        const all = options.find(o => o.id === 'all');
        expect(all).toBeDefined();
        expect(all.count).toBe(3);
    });

    test('getFriendlyEventName transforms codes to plain English', () => {
        expect(getFriendlyEventName('PRIDE CE')).toBe('Circle Entry');
        expect(getFriendlyEventName('THUNDER A25E')).toBe('Attacking 25m Entry');
        expect(getFriendlyEventName('THUNDER BW')).toBe('Ball Won');
        expect(getFriendlyEventName('PRIDE APC')).toBe('Penalty Corner');
    });

    test('LABEL_SCHEMAS contains prompt questions and options for 1-tap cards', () => {
        expect(LABEL_SCHEMAS.channel.prompt).toBe('Which channel did they enter?');
        expect(LABEL_SCHEMAS.channel.options).toHaveLength(3);
        expect(LABEL_SCHEMAS.channel.options[0]).toEqual({ key: '1', text: 'Left', short: 'L' });

        expect(LABEL_SCHEMAS.turnover.prompt).toBe('How was the ball won?');
        expect(LABEL_SCHEMAS.turnover.options[0]).toEqual({ key: '1', text: 'Tackle', short: 'Tackle' });
    });
});
