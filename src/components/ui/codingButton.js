/**
 * Coding Button UI component
 * @module components/ui/codingButton
 */
import { createBadge } from './badge.js';

const PC_TEXTS = new Set(['PC', 'Penalty Corner']);

/**
 * Checks whether an event button represents a Penalty Corner.
 *
 * @param {string} event
 * @param {string} text
 * @param {string} fullEvent
 * @returns {boolean}
 */
function isPenaltyCornerButton(event, text, fullEvent) {
    if (PC_TEXTS.has(event) || PC_TEXTS.has(text)) return true;
    return typeof fullEvent === 'string' && fullEvent.endsWith('PC');
}

/**
 * Assigns tracking and metadata dataset attributes to the button.
 */
function assignCodingButtonDatasets(button, { fullEvent, event, team, teamColored, color, zoned, lead, lag }) {
    if (fullEvent) button.dataset.event = fullEvent;
    if (event) button.dataset.baseEvent = event;
    if (team) {
        button.dataset.teamSlot = String(team.slot);
        const shouldBeTeamColored = teamColored !== undefined ? teamColored : !color;
        if (shouldBeTeamColored) button.dataset.teamColored = 'true';
    }
    if (zoned) button.dataset.zoned = 'true';
    if (lead !== undefined) button.dataset.lead = String(lead);
    if (lag !== undefined) button.dataset.lag = String(lag);
}

/**
 * Attaches dynamic event counter badge and mutation helpers.
 */
function attachButtonCounterBadge(button, showCounter, initialCount) {
    if (!showCounter) {
        button.getBadge = () => null;
        button.getCounter = () => 0;
        button.setCounter = () => {};
        button.incrementCounter = () => 0;
        return;
    }

    button.dataset.hasCounter = 'true';
    const badge = createBadge({
        count: initialCount,
        hidden: initialCount === 0,
        className: 'ml-1.5 pointer-events-none'
    });
    button.appendChild(badge);

    button.getBadge = () => badge;
    button.getCounter = () => Number(badge.textContent || 0);
    button.setCounter = (val) => badge.setCount(val);
    button.incrementCounter = () => {
        const next = Number(badge.textContent || 0) + 1;
        badge.setCount(next);
        return next;
    };
}

/**
 * Creates a coding button element with support for event metadata,
 * touch hit target (>=48px), and dynamic event counter badges.
 *
 * @param {Object} [options={}]
 * @returns {HTMLButtonElement}
 */
export function createCodingButton(options = {}) {
    const {
        text = '',
        event = '',
        color = '',
        team = null,
        teamColored = undefined,
        zoned = false,
        lead = undefined,
        lag = undefined,
        showCounter = false,
        initialCount = 0,
        onClick = null,
        className = ''
    } = options;

    const button = document.createElement('button');
    const colorClass = color || team?.colorClass || 'btn-blue';
    button.className = `event-button relative ${colorClass} rounded text-center min-h-[48px] min-w-[48px] ${className}`.trim();

    const fullEvent = team ? `${team.code} ${event}` : event;
    assignCodingButtonDatasets(button, { fullEvent, event, team, teamColored, color, zoned, lead, lag });

    const label = document.createElement('span');
    label.className = 'button-label pointer-events-none';
    label.textContent = text || event;
    button.appendChild(label);

    const hasCounter = showCounter || isPenaltyCornerButton(event, text, fullEvent);
    attachButtonCounterBadge(button, hasCounter, initialCount);

    if (onClick) {
        button.addEventListener('click', (e) => onClick(e, button));
    }

    return button;
}

export const CodingButton = createCodingButton;
