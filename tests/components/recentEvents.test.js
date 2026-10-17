import { renderRecentEvents } from '../../src/components/recentEvents.js';

const makeEvents = (count) => Array.from({ length: count }, (_, i) => ({ event: `E${i}`, timeMs: i * 1000 }));

describe('renderRecentEvents', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
    });

    test('shows an empty state when there are no events', () => {
        renderRecentEvents(container, []);
        expect(container.textContent).toBe('No events recorded yet.');
        expect(container.querySelector('[data-delete-index]')).toBeNull();
    });

    test('lists events newest first with their time', () => {
        renderRecentEvents(container, makeEvents(3));

        const rows = [...container.querySelectorAll('li')];
        expect(rows.map(row => row.querySelector('.font-semibold').textContent)).toEqual(['E2', 'E1', 'E0']);
        expect(rows[0].textContent).toContain('00:02');
    });

    test('shows at most 10 rows by default, with delete indexes into the full list', () => {
        renderRecentEvents(container, makeEvents(14));

        const buttons = [...container.querySelectorAll('[data-delete-index]')];
        expect(buttons).toHaveLength(10);
        expect(buttons.map(button => button.dataset.deleteIndex)).toEqual(
            ['13', '12', '11', '10', '9', '8', '7', '6', '5', '4']
        );
        expect(container.textContent).toContain('Showing the last 10 of 14 events.');
    });

    test('respects a custom limit', () => {
        renderRecentEvents(container, makeEvents(5), { limit: 2 });
        expect(container.querySelectorAll('li')).toHaveLength(2);
    });
});
