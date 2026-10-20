/**
 * Coding Button UI component
 * @module components/ui/codingButton
 */
import { createBadge } from './badge.js';

/**
 * Creates a coding button element with support for event metadata,
 * touch hit target (>=48px), and dynamic event counter badges.
 *
 * @param {Object} options
 * @param {string} [options.text='']
 * @param {string} [options.event='']
 * @param {string} [options.color='']
 * @param {{slot: number, code: string, colorClass?: string}|null} [options.team=null]
 * @param {boolean} [options.teamColored=false]
 * @param {boolean} [options.zoned=false]
 * @param {number} [options.lead=10]
 * @param {number} [options.lag=15]
 * @param {boolean} [options.showCounter=false]
 * @param {number} [options.initialCount=0]
 * @param {Function} [options.onClick=null]
 * @param {string} [options.className='']
 * @returns {HTMLButtonElement}
 */
export function createCodingButton({
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
} = {}) {
    const button = document.createElement('button');
    const colorClass = color || team?.colorClass || 'btn-blue';
    button.className = `event-button relative ${colorClass} rounded text-center min-h-[48px] min-w-[48px] ${className}`.trim();

    const fullEvent = team ? `${team.code} ${event}` : event;
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

    const isPenaltyCorner =
        event === 'PC' ||
        text === 'Penalty Corner' ||
        text === 'PC' ||
        (typeof fullEvent === 'string' && fullEvent.endsWith('PC'));

    const label = document.createElement('span');
    label.className = 'button-label pointer-events-none';
    label.textContent = text || event;
    button.appendChild(label);

    let badge = null;
    if (showCounter || isPenaltyCorner) {
        button.dataset.hasCounter = 'true';
        badge = createBadge({
            count: initialCount,
            hidden: initialCount === 0,
            className: 'ml-1.5 pointer-events-none'
        });
        button.appendChild(badge);
    }

    button.getBadge = () => badge;
    button.getCounter = () => (badge ? Number(badge.textContent) : 0);
    button.setCounter = (val) => {
        if (badge) badge.setCount(val);
    };
    button.incrementCounter = () => {
        if (badge) {
            const next = Number(badge.textContent || 0) + 1;
            badge.setCount(next);
            return next;
        }
        return 0;
    };

    if (onClick) {
        button.addEventListener('click', (e) => {
            onClick(e, button);
        });
    }

    return button;
}

export const CodingButton = createCodingButton;
