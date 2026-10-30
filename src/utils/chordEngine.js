import { getLabelSchemaForEvent } from './eventAnalysisUtils.js';

/**
 * Pure state machine engine for single-pass compound chord tagging.
 * Decoupled from DOM and clock source (accepts live Date.now() or video.currentTime).
 */
export class ChordEngine {
    constructor({
        decayDuration = 2000,
        onChordStart = () => {},
        onChordTick = () => {},
        onChordResolved = () => {},
        onChordCancelled = () => {}
    } = {}) {
        this.decayDuration = decayDuration;
        this.onChordStart = onChordStart;
        this.onChordTick = onChordTick;
        this.onChordResolved = onChordResolved;
        this.onChordCancelled = onChordCancelled;
        this.activeChord = null;
        this.timerId = null;
        this.tickIntervalId = null;
    }

    /**
     * Update the decay window duration in milliseconds.
     * @param {number} ms 
     */
    setDecayDuration(ms) {
        this.decayDuration = Math.max(500, ms);
    }

    /**
     * Check if a chord is currently active and listening for modifier input.
     * @returns {boolean}
     */
    isListening() {
        return this.activeChord !== null;
    }

    /**
     * Returns the active chord state object or null.
     * @returns {Object|null}
     */
    getActiveChord() {
        return this.activeChord;
    }

    /**
     * Starts listening for modifier choices on a logged event.
     * If an existing chord is pending, it auto-commits the previous one as base.
     * @param {Object} event - The logged event instance
     * @param {Object} [customSchema] - Optional explicit schema override
     * @returns {Object|null} The active chord object or null if event has no modifier schema
     */
    startChord(event, customSchema = null) {
        if (!event) return null;

        // Auto-commit any currently pending chord as base
        if (this.activeChord) {
            this.resolve(null, { autoCommitted: true });
        }

        const rawCode = event.eventCode || event.code || event.event;
        const schema = customSchema || getLabelSchemaForEvent(rawCode);
        if (!schema || !Array.isArray(schema.options) || schema.options.length === 0) {
            return null;
        }

        this.activeChord = {
            event,
            schema,
            startTime: Date.now(),
            duration: this.decayDuration
        };

        this.onChordStart(this.activeChord);
        this._startTicker();

        this.timerId = setTimeout(() => {
            this.resolve(null, { timedOut: true });
        }, this.decayDuration);

        return this.activeChord;
    }

    /**
     * Select a modifier option by hotkey (e.g. '1', '2') or label text (e.g. 'Left').
     * @param {string} keyOrText 
     * @returns {boolean} True if matched and resolved
     */
    selectOption(keyOrText) {
        if (!this.activeChord) return false;
        const schema = this.activeChord.schema;
        const search = String(keyOrText).trim().toLowerCase();

        const match = schema.options.find(
            opt => String(opt.key).toLowerCase() === search || opt.text.toLowerCase() === search
        );

        if (!match) return false;

        this.resolve({ group: schema.group, text: match.text });
        return true;
    }

    /**
     * Resolves the current chord, attaching label if present, and clears timers.
     * @param {Object|null} label - { group, text } or null
     * @param {Object} [meta] - { timedOut, autoCommitted }
     * @returns {Object|null}
     */
    resolve(label = null, meta = {}) {
        if (!this.activeChord) return null;
        this._clearTimers();

        const resolved = {
            event: this.activeChord.event,
            label: label ? { group: label.group, text: label.text } : null,
            ...meta
        };

        this.activeChord = null;
        this.onChordResolved(resolved);
        return resolved;
    }

    /**
     * Cancel the active chord without resolving/modifying the base event.
     */
    cancel() {
        if (!this.activeChord) return;
        this._clearTimers();
        const cancelled = this.activeChord;
        this.activeChord = null;
        this.onChordCancelled(cancelled);
    }

    _clearTimers() {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        if (this.tickIntervalId) {
            clearInterval(this.tickIntervalId);
            this.tickIntervalId = null;
        }
    }

    _startTicker() {
        this.tickIntervalId = setInterval(() => {
            if (!this.activeChord) {
                this._clearTimers();
                return;
            }
            const elapsed = Date.now() - this.activeChord.startTime;
            const remaining = Math.max(0, this.activeChord.duration - elapsed);
            const progress = Math.min(1, elapsed / this.activeChord.duration);
            this.onChordTick({ elapsed, remaining, progress });
        }, 50);
    }
}
