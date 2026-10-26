import {
    LABEL_SCHEMAS,
    getLabelSchemaForEvent,
    isCounterAttack,
    getDerivedLabels,
    formatLabelText
} from '../../src/utils/eventAnalysisUtils.js';

describe('eventAnalysisUtils', () => {
    describe('LABEL_SCHEMAS', () => {
        test('provides standard schemas for circle entries, penalty corners, and turnovers', () => {
            expect(LABEL_SCHEMAS.channel).toBeDefined();
            expect(LABEL_SCHEMAS.channel.group).toBe('Channel');
            expect(LABEL_SCHEMAS.channel.options.map(o => o.text)).toEqual(['Left', 'Center', 'Right']);

            expect(LABEL_SCHEMAS.penaltyCorner).toBeDefined();
            expect(LABEL_SCHEMAS.penaltyCorner.group).toBe('Execution');
            expect(LABEL_SCHEMAS.penaltyCorner.options.map(o => o.text)).toEqual(['Direct', 'Slip', 'Broken']);

            expect(LABEL_SCHEMAS.turnover).toBeDefined();
            expect(LABEL_SCHEMAS.turnover.group).toBe('Type');
            expect(LABEL_SCHEMAS.turnover.options.map(o => o.text)).toEqual(['Tackle', 'Intercept', 'Unforced']);
        });
    });

    describe('getLabelSchemaForEvent', () => {
        test('matches circle entry codes with or without team prefix', () => {
            expect(getLabelSchemaForEvent('CE')?.group).toBe('Channel');
            expect(getLabelSchemaForEvent('FIRE CE')?.group).toBe('Channel');
            expect(getLabelSchemaForEvent('A25E')?.group).toBe('Channel');
            expect(getLabelSchemaForEvent('Circle Entry')?.group).toBe('Channel');
        });

        test('matches penalty corner codes', () => {
            expect(getLabelSchemaForEvent('PC')?.group).toBe('Execution');
            expect(getLabelSchemaForEvent('TIGERS PC')?.group).toBe('Execution');
            expect(getLabelSchemaForEvent('Penalty Corner')?.group).toBe('Execution');
        });

        test('matches turnover and ball won codes', () => {
            expect(getLabelSchemaForEvent('BW 1')?.group).toBe('Type');
            expect(getLabelSchemaForEvent('FIRE BW')?.group).toBe('Type');
            expect(getLabelSchemaForEvent('BL')?.group).toBe('Type');
            expect(getLabelSchemaForEvent('Turnover')?.group).toBe('Type');
        });

        test('returns null for codes without built-in schemas', () => {
            expect(getLabelSchemaForEvent('START')).toBeNull();
            expect(getLabelSchemaForEvent('UMP')).toBeNull();
            expect(getLabelSchemaForEvent('GREEN')).toBeNull();
        });
    });

    describe('isCounterAttack', () => {
        const events = [
            { id: '1', event: 'FIRE BW 1', team: 'FIRE', timeMs: 50000 },
            { id: '2', event: 'FIRE CE', team: 'FIRE', timeMs: 56000 }, // 6s after BW -> Counter
            { id: '3', event: 'TIGERS BW 4', team: 'TIGERS', timeMs: 70000 },
            { id: '4', event: 'FIRE CE', team: 'FIRE', timeMs: 75000 }, // 5s after TIGERS BW (not FIRE BW) -> not counter for FIRE
            { id: '5', event: 'FIRE BW 2', team: 'FIRE', timeMs: 100000 },
            { id: '6', event: 'FIRE CE', team: 'FIRE', timeMs: 118000 }  // 18s after BW -> settled (> 10s window)
        ];

        test('detects counter-attack when same-team BW occurs within 10 seconds before CE', () => {
            expect(isCounterAttack(events[1], events)).toBe(true);
        });

        test('returns false when preceding BW belongs to opponent team', () => {
            expect(isCounterAttack(events[3], events)).toBe(false);
        });

        test('returns false when preceding BW occurred outside time window', () => {
            expect(isCounterAttack(events[5], events, 10)).toBe(false);
            expect(isCounterAttack(events[5], events, 20)).toBe(true);
        });
    });

    describe('getDerivedLabels', () => {
        test('derives Counter or Build-Up origin for circle entries and attacking events', () => {
            const events = [
                { id: '1', event: 'FIRE BW 1', team: 'FIRE', timeMs: 50000 },
                { id: '2', event: 'FIRE CE', team: 'FIRE', timeMs: 56000 },
                { id: '3', event: 'FIRE CE', team: 'FIRE', timeMs: 150000 }
            ];

            const derivedCounter = getDerivedLabels(events[1], events);
            expect(derivedCounter).toEqual([{ group: 'Origin', text: 'Counter' }]);

            const derivedSettled = getDerivedLabels(events[2], events);
            expect(derivedSettled).toEqual([{ group: 'Origin', text: 'Build-Up' }]);
        });

        test('returns empty array for non-attacking events', () => {
            const events = [{ id: '1', event: 'FIRE BW 1', team: 'FIRE', timeMs: 50000 }];
            expect(getDerivedLabels(events[0], events)).toEqual([]);
        });
    });

    describe('formatLabelText', () => {
        test('formats single label or list of labels cleanly', () => {
            expect(formatLabelText({ group: 'Channel', text: 'Left' })).toBe('Left');
            expect(formatLabelText([{ group: 'Channel', text: 'Left' }, { group: 'Origin', text: 'Counter' }])).toBe('Left · Counter');
            expect(formatLabelText(null)).toBe('');
        });
    });
});
