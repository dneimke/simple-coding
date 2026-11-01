import { bindChordDock } from '../../src/utils/chordDockController.js';

describe('bindChordDock', () => {
    let elements;

    beforeEach(() => {
        jest.useFakeTimers();
        document.body.innerHTML = `
            <div id="dock" class="hidden">
                <span id="badge"></span>
                <span id="prompt"></span>
                <span id="countdown"></span>
                <div id="progress" style="width: 0%"></div>
                <div id="pills"></div>
            </div>
        `;

        elements = {
            dockElement: document.getElementById('dock'),
            badgeElement: document.getElementById('badge'),
            promptElement: document.getElementById('prompt'),
            countdownElement: document.getElementById('countdown'),
            progressBarElement: document.getElementById('progress'),
            pillsContainer: document.getElementById('pills')
        };
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('returns null if dockElement is missing', () => {
        const engine = bindChordDock({ dockElement: null });
        expect(engine).toBeNull();
    });

    test('initializes and reveals dock on startChord', () => {
        const onResolved = jest.fn();
        const engine = bindChordDock({
            ...elements,
            decayDuration: 1500,
            onResolved
        });

        expect(elements.dockElement.classList.contains('hidden')).toBe(true);

        const event = { event: 'Circle Entry' };
        engine.startChord(event);

        expect(elements.dockElement.classList.contains('hidden')).toBe(false);
        expect(elements.badgeElement.textContent).toBe('Circle Entry');
        expect(elements.promptElement.textContent).toContain('channel');
        expect(elements.pillsContainer.children.length).toBe(3);

        // Click a modifier option pill
        const rightPill = elements.pillsContainer.querySelector('[data-chord-key="3"]');
        expect(rightPill).not.toBeNull();
        rightPill.click();

        expect(elements.dockElement.classList.contains('hidden')).toBe(true);
        expect(onResolved).toHaveBeenCalledWith({
            event,
            label: { group: 'Channel', text: 'Right' }
        });
    });

    test('auto-resolves and hides dock when chord times out', () => {
        const onResolved = jest.fn();
        const engine = bindChordDock({
            ...elements,
            decayDuration: 1000,
            onResolved
        });

        const event = { event: 'Circle Entry' };
        engine.startChord(event);
        expect(elements.dockElement.classList.contains('hidden')).toBe(false);

        jest.advanceTimersByTime(1100);

        expect(elements.dockElement.classList.contains('hidden')).toBe(true);
        expect(onResolved).toHaveBeenCalledWith({
            event,
            label: null
        });
    });

    test('hides dock and calls onCancelled on explicit cancel', () => {
        const onCancelled = jest.fn();
        const engine = bindChordDock({
            ...elements,
            decayDuration: 1000,
            onCancelled
        });

        engine.startChord({ event: 'Circle Entry' });
        expect(elements.dockElement.classList.contains('hidden')).toBe(false);

        engine.cancel();

        expect(elements.dockElement.classList.contains('hidden')).toBe(true);
        expect(onCancelled).toHaveBeenCalled();
    });
});
