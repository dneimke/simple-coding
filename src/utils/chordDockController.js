/**
 * Connects a ChordEngine state machine to a transient thumb dock UI.
 * Standardizes modifier pill rendering, progress ticking, and resolution dispatch.
 * Eliminates duplication across Live Capture and Video Coding (Friction 2).
 */

import { ChordEngine } from './chordEngine.js';

export function bindChordDock({
    dockElement,
    badgeElement,
    promptElement,
    countdownElement,
    progressBarElement,
    pillsContainer,
    decayDuration = 2000,
    onResolved = () => {},
    onCancelled = () => {},
    pillClass = 'chord-action-pill',
    keyClass = 'chord-pill-key'
}) {
    if (!dockElement) return null;

    let engine = null;

    engine = new ChordEngine({
        decayDuration,
        onChordStart: (chord) => {
            if (badgeElement) badgeElement.textContent = chord.event.event || chord.event.eventCode || 'Tag';
            if (promptElement) promptElement.textContent = chord.schema.prompt || 'Select modifier';
            if (countdownElement) countdownElement.textContent = `${(chord.duration / 1000).toFixed(1)}s`;
            if (progressBarElement) progressBarElement.style.width = '100%';

            if (pillsContainer) {
                pillsContainer.innerHTML = chord.schema.options.map(opt => `
                    <button type="button" class="${pillClass}" data-chord-key="${opt.key}">
                        <span>${opt.text}</span>
                        <span class="${keyClass}">[${opt.key}]</span>
                    </button>
                `).join('');
            }

            dockElement.classList.remove('hidden');
        },
        onChordTick: ({ remaining, progress }) => {
            if (countdownElement) countdownElement.textContent = `${(remaining / 1000).toFixed(1)}s`;
            if (progressBarElement) progressBarElement.style.width = `${Math.max(0, (1 - progress) * 100)}%`;
        },
        onChordResolved: ({ event, label }) => {
            dockElement.classList.add('hidden');
            onResolved({ event, label });
        },
        onChordCancelled: () => {
            dockElement.classList.add('hidden');
            onCancelled();
        }
    });

    if (pillsContainer) {
        pillsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-chord-key]');
            if (!btn || !engine) return;
            engine.selectOption(btn.dataset.chordKey);
        });
    }

    return engine;
}
