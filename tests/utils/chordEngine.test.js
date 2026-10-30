import { ChordEngine } from '../../src/utils/chordEngine.js';

describe('ChordEngine', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('starts chord for compound event and triggers onChordStart', () => {
        const onStart = jest.fn();
        const engine = new ChordEngine({ decayDuration: 2000, onChordStart: onStart });

        const event = { id: 'e1', event: 'FIRE CE', eventCode: 'CE', timeMs: 14000 };
        const chord = engine.startChord(event);

        expect(chord).toBeDefined();
        expect(chord.event).toBe(event);
        expect(chord.schema.group).toBe('Channel');
        expect(engine.isListening()).toBe(true);
        expect(onStart).toHaveBeenCalledWith(chord);
    });

    test('returns null for non-compound event and does not start listening', () => {
        const engine = new ChordEngine();
        const event = { id: 'e2', event: 'START', eventCode: 'START', timeMs: 0 };
        const chord = engine.startChord(event);

        expect(chord).toBeNull();
        expect(engine.isListening()).toBe(false);
    });

    test('attaches label when valid hotkey number is selected within decay window', () => {
        const onResolved = jest.fn();
        const engine = new ChordEngine({ decayDuration: 2000, onChordResolved: onResolved });

        const event = { id: 'e1', event: 'FIRE CE', eventCode: 'CE', timeMs: 14000 };
        engine.startChord(event);

        const success = engine.selectOption('1'); // '1' is Left for Channel
        expect(success).toBe(true);
        expect(engine.isListening()).toBe(false);
        expect(onResolved).toHaveBeenCalledWith({
            event,
            label: { group: 'Channel', text: 'Left' }
        });
    });

    test('attaches label when valid text is selected', () => {
        const onResolved = jest.fn();
        const engine = new ChordEngine({ decayDuration: 2000, onChordResolved: onResolved });

        const event = { id: 's1', event: 'FIRE SHOT', eventCode: 'SHOT', timeMs: 20000 };
        engine.startChord(event);

        const success = engine.selectOption('Goal');
        expect(success).toBe(true);
        expect(onResolved).toHaveBeenCalledWith({
            event,
            label: { group: 'Outcome', text: 'Goal' }
        });
    });

    test('auto-resolves as base event without label when decay timeout expires', () => {
        const onResolved = jest.fn();
        const engine = new ChordEngine({ decayDuration: 1500, onChordResolved: onResolved });

        const event = { id: 'e1', event: 'FIRE CE', eventCode: 'CE', timeMs: 14000 };
        engine.startChord(event);

        expect(engine.isListening()).toBe(true);

        // Fast forward 1500ms
        jest.advanceTimersByTime(1500);

        expect(engine.isListening()).toBe(false);
        expect(onResolved).toHaveBeenCalledWith({
            event,
            label: null,
            timedOut: true
        });
    });

    test('auto-commits pending chord as base event when a second chord starts', () => {
        const onResolved = jest.fn();
        const onStart = jest.fn();
        const engine = new ChordEngine({
            decayDuration: 2000,
            onChordStart: onStart,
            onChordResolved: onResolved
        });

        const ev1 = { id: 'e1', event: 'FIRE CE', eventCode: 'CE', timeMs: 14000 };
        const ev2 = { id: 'e2', event: 'FIRE SHOT', eventCode: 'SHOT', timeMs: 15000 };

        engine.startChord(ev1);
        expect(engine.getActiveChord().event).toBe(ev1);

        // Advance 500ms and trigger second event
        jest.advanceTimersByTime(500);
        engine.startChord(ev2);

        // First chord was auto-committed as base
        expect(onResolved).toHaveBeenCalledWith({
            event: ev1,
            label: null,
            autoCommitted: true
        });

        // Second chord is now active
        expect(engine.isListening()).toBe(true);
        expect(engine.getActiveChord().event).toBe(ev2);
    });

    test('cancel clears active chord without attaching labels', () => {
        const onCancelled = jest.fn();
        const onResolved = jest.fn();
        const engine = new ChordEngine({
            decayDuration: 2000,
            onChordCancelled: onCancelled,
            onChordResolved: onResolved
        });

        const event = { id: 'e1', event: 'FIRE CE', eventCode: 'CE', timeMs: 14000 };
        engine.startChord(event);

        engine.cancel();

        expect(engine.isListening()).toBe(false);
        expect(onCancelled).toHaveBeenCalled();
        expect(onResolved).not.toHaveBeenCalled();
    });

    test('emits ticker progress during countdown', () => {
        const onTick = jest.fn();
        const engine = new ChordEngine({ decayDuration: 1000, onChordTick: onTick });

        const event = { id: 'e1', event: 'FIRE CE', eventCode: 'CE', timeMs: 14000 };
        engine.startChord(event);

        jest.advanceTimersByTime(200);

        expect(onTick).toHaveBeenCalled();
        const lastCall = onTick.mock.calls[onTick.mock.calls.length - 1][0];
        expect(lastCall.remaining).toBeLessThanOrEqual(1000);
        expect(lastCall.progress).toBeGreaterThan(0);
    });
});
