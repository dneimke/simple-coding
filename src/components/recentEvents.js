import { formatTime } from '../utils/formatUtils.js';

/**
 * Render the most recent events, newest first, each with a Delete button
 * @param {HTMLElement} container - Element to render into
 * @param {Array<{event: string, timeMs: number}>} events - Logged events in capture order
 * @param {Object} [options]
 * @param {number} [options.limit=10] - Maximum number of rows
 */
export function renderRecentEvents(container, events, { limit = 10 } = {}) {
    container.innerHTML = '';

    if (!events || events.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-gray-500 text-center';
        empty.textContent = 'No events recorded yet.';
        container.appendChild(empty);
        return;
    }

    const list = document.createElement('ul');
    list.className = 'recent-events divide-y divide-gray-200 bg-white rounded border border-gray-200';

    const firstIndex = Math.max(0, events.length - limit);
    for (let index = events.length - 1; index >= firstIndex; index--) {
        const event = events[index];

        const row = document.createElement('li');
        row.className = 'flex items-center gap-3 px-3 py-2';

        const time = document.createElement('span');
        time.className = 'font-mono text-sm text-gray-500 w-14 shrink-0';
        time.textContent = formatTime(event.timeMs);

        const name = document.createElement('span');
        name.className = 'flex-1 font-semibold text-gray-900 truncate';
        name.textContent = event.event;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'shrink-0 px-3 py-1 text-sm font-semibold text-red-700 border border-red-200 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500';
        remove.dataset.deleteIndex = String(index);
        remove.setAttribute('aria-label', `Delete ${event.event} at ${formatTime(event.timeMs)}`);
        remove.textContent = 'Delete';

        row.append(time, name, remove);
        list.appendChild(row);
    }
    container.appendChild(list);

    if (events.length > limit) {
        const note = document.createElement('p');
        note.className = 'mt-2 text-xs text-gray-500 text-center';
        note.textContent = `Showing the last ${limit} of ${events.length} events.`;
        container.appendChild(note);
    }
}
