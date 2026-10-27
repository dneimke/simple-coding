import {
    LABEL_SCHEMAS,
    getLabelSchemaForEvent,
    isCounterAttack,
    getDerivedLabels,
    formatLabelText,
    getFriendlyEventName,
    getSweepScopeOptions,
    getSweepLeadSeconds,
    getSweepSeekSeconds
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

    describe('LABEL_SCHEMAS prompt definitions', () => {
        test('each schema defines a user-friendly prompt question', () => {
            expect(LABEL_SCHEMAS.channel.prompt).toBe('Which channel did they enter?');
            expect(LABEL_SCHEMAS.penaltyCorner.prompt).toBe('How was the penalty corner executed?');
            expect(LABEL_SCHEMAS.turnover.prompt).toBe('How was the ball won?');
        });
    });

    describe('getFriendlyEventName', () => {
        test('resolves standard hockey acronyms into plain-English names', () => {
            expect(getFriendlyEventName('PRIDE CE')).toBe('Circle Entry');
            expect(getFriendlyEventName('THUNDER A25E')).toBe('Attacking 25m Entry');
            expect(getFriendlyEventName('PRIDE BW')).toBe('Ball Won');
            expect(getFriendlyEventName('FIRE PC')).toBe('Penalty Corner');
            expect(getFriendlyEventName('PRIDE GOAL')).toBe('Goal');
            expect(getFriendlyEventName('Custom Event')).toBe('Custom Event');
        });
    });

    describe('getSweepScopeOptions', () => {
        const sampleMatchEvents = [
            { id: '1', event: 'PRIDE CE', team: 'PRIDE', timeMs: 10000 },
            { id: '2', event: 'PRIDE CE', team: 'PRIDE', timeMs: 20000, labels: [{ group: 'Channel', text: 'Left' }] },
            { id: '3', event: 'PRIDE CE', team: 'PRIDE', timeMs: 30000 },
            { id: '4', event: 'PRIDE A25E', team: 'PRIDE', timeMs: 40000 },
            { id: '5', event: 'THUNDER CE', team: 'THUNDER', timeMs: 50000 },
            { id: '6', event: 'THUNDER BW', team: 'THUNDER', timeMs: 60000 },
            { id: '7', event: 'PRIDE GOAL', team: 'PRIDE', timeMs: 70000 }
        ];

        test('generates grouped scope presets for team categories and all match events', () => {
            const options = getSweepScopeOptions(sampleMatchEvents);
            expect(options.length).toBeGreaterThanOrEqual(2);

            const prideCeOption = options.find(o => o.team === 'PRIDE' && o.type === 'CE');
            expect(prideCeOption).toBeDefined();
            expect(prideCeOption.count).toBe(2);
            expect(prideCeOption.label).toContain('Circle Entries');
            expect(prideCeOption.estTime).toBeDefined();

            const allOption = options.find(o => o.id === 'all');
            expect(allOption).toBeDefined();
            expect(allOption.count).toBe(5);
            expect(allOption.label).toContain('All Match Events');
        });
    });

    describe('getSweepLeadSeconds and getSweepSeekSeconds', () => {
        test('defaults to 8 seconds pre-roll when no lead is defined on event', () => {
            const event = { timeMs: 45000, event: 'FIRE CE' };
            expect(getSweepLeadSeconds(event)).toBe(8);
            expect(getSweepSeekSeconds(event)).toBe(37);
        });

        test('enforces an 8-second minimum floor even if event lead is lower', () => {
            const event = { timeMs: 30000, event: 'FIRE CE', lead: 3 };
            expect(getSweepLeadSeconds(event)).toBe(8);
            expect(getSweepSeekSeconds(event)).toBe(22);
        });

        test('respects custom lead time when greater than 8 seconds', () => {
            const eventWithLead = { timeMs: 60000, event: 'FIRE SHOT', lead: 12 };
            expect(getSweepLeadSeconds(eventWithLead)).toBe(12);
            expect(getSweepSeekSeconds(eventWithLead)).toBe(48);

            const eventWithLeadTime = { timeMs: 60000, event: 'FIRE PC', leadTime: 15 };
            expect(getSweepLeadSeconds(eventWithLeadTime)).toBe(15);
            expect(getSweepSeekSeconds(eventWithLeadTime)).toBe(45);
        });

        test('safely clamps seek time to zero for events near the start of the match', () => {
            const earlyEvent = { timeMs: 4000, event: 'FIRE START', lead: 10 };
            expect(getSweepLeadSeconds(earlyEvent)).toBe(10);
            expect(getSweepSeekSeconds(earlyEvent)).toBe(0);
        });

        test('handles null, undefined, or invalid inputs gracefully', () => {
            expect(getSweepLeadSeconds(null)).toBe(8);
            expect(getSweepSeekSeconds(null)).toBe(0);
            expect(getSweepLeadSeconds({ lead: 'invalid' })).toBe(8);
            expect(getSweepSeekSeconds({ timeMs: 'invalid' })).toBe(0);
        });
    });
});
