import { EventButtons } from '../../src/components/eventButtons.js';
import { getNamedConfig } from '../../src/components/config.js';

const teams = [{ code: 'FIRE', color: 'red' }, { code: 'TIGERS', color: 'yellow' }];

describe('EventButtons', () => {
    let container;
    let eventButtons;

    beforeEach(() => {
        localStorage.clear();
        container = document.createElement('div');
        eventButtons = new EventButtons(container);
    });

    test('renders flat boards as before', () => {
        eventButtons.initialize(getNamedConfig('hockey-one'));

        expect(container.querySelector('.zone-bar')).toBeNull();
        expect(container.querySelector('[data-event="FIRE GOAL"]')).not.toBeNull();
        expect(container.querySelector('[data-team-slot]')).toBeNull();
    });

    describe('hockey-one-zoned', () => {
        beforeEach(() => {
            eventButtons.initialize(getNamedConfig('hockey-one-zoned'), { teams, zone: '2' });
        });

        test('renders a zone bar from Team 1 perspective with Team 2 mirrored', () => {
            expect(container.querySelector('[data-zone-banner]').textContent).toBe('FIRE ZONE 2 · TIGERS ZONE 3');
            expect(container.querySelector('.zone-caption').textContent)
                .toBe("Zones from FIRE's perspective, TIGERS zones are mirrored");

            const zoneButtons = [...container.querySelectorAll('.zone-button')];
            expect(zoneButtons.map(button => button.dataset.zone)).toEqual(['1', '2', '3', '4']);
            expect(zoneButtons[0].textContent).toBe('ZONE 1TIGERS 4');
            expect(container.querySelector('.zone-button.is-active').dataset.zone).toBe('2');
        });

        test('zone buttons are not event buttons', () => {
            container.querySelectorAll('.zone-button').forEach(button => {
                expect(button.dataset.event).toBeUndefined();
                expect(button.classList.contains('event-button')).toBe(false);
            });
        });

        test('prefixes team row events with the team code and uses the team colour', () => {
            const fireBs = container.querySelector('[data-event="FIRE BS"]');
            expect(fireBs.dataset.teamSlot).toBe('1');
            expect(fireBs.dataset.zoned).toBe('true');
            expect(fireBs.classList.contains('team-color-red')).toBe(true);

            const tigersBw = container.querySelector('[data-event="TIGERS BW"]');
            expect(tigersBw.dataset.teamSlot).toBe('2');
            expect(tigersBw.classList.contains('team-color-yellow')).toBe(true);

            expect(container.querySelector('[data-event="START"]').dataset.teamSlot).toBeUndefined();
        });

        test('labels team rows and renders one shared multi-grid scoring row with a team toggle', () => {
            const labels = [...container.querySelectorAll('.team-row-label')].map(label => label.textContent);
            expect(labels).toEqual(['FIRE', 'TIGERS', 'TEAM']);

            const scoringRow = container.querySelector('[data-team-selector]');
            expect(scoringRow.querySelectorAll('.button-grid')).toHaveLength(2);
            expect([...scoringRow.querySelectorAll('.team-toggle')].map(toggle => toggle.textContent)).toEqual(['FIRE', 'TIGERS']);
            expect(container.querySelectorAll('[data-base-event="SO"]')).toHaveLength(1);
        });

        test('shared scoring buttons log for the selected team', () => {
            const so = container.querySelector('[data-team-selector] [data-base-event="SO"]');
            expect(so.dataset.event).toBe('FIRE SO');
            expect(so.classList.contains('team-color-red')).toBe(true);
            expect(container.querySelector('.team-toggle.is-active').dataset.teamSelect).toBe('1');

            eventButtons.setSelectedTeam(2);
            expect(so.dataset.event).toBe('TIGERS SO');
            expect(so.dataset.teamSlot).toBe('2');
            expect(so.classList.contains('team-color-yellow')).toBe(true);
            expect(so.classList.contains('team-color-red')).toBe(false);
            const active = container.querySelector('.team-toggle.is-active');
            expect(active.dataset.teamSelect).toBe('2');
            expect(active.classList.contains('team-color-yellow')).toBe(true);
        });

        test('team toggles are not event buttons', () => {
            container.querySelectorAll('.team-toggle').forEach(toggle => {
                expect(toggle.dataset.event).toBeUndefined();
            });
        });

        test('shows each team zone on zoned buttons and updates it with setZone', () => {
            const tag = (event) => container.querySelector(`[data-event="${event}"] [data-zone-tag]`).textContent;
            expect(tag('FIRE BS')).toBe('2');
            expect(tag('TIGERS BW')).toBe('3');

            eventButtons.setZone('4');
            expect(tag('FIRE BS')).toBe('4');
            expect(tag('TIGERS BW')).toBe('1');
            expect(container.querySelector('[data-zone-banner]').textContent).toBe('FIRE ZONE 4 · TIGERS ZONE 1');
            expect(container.querySelector('.zone-button.is-active').dataset.zone).toBe('4');
        });

        test('ignores unknown zones', () => {
            eventButtons.setZone('9');
            expect(eventButtons.zone).toBe('2');
        });

        test('setState enables event buttons only while running', () => {
            const fireGoal = container.querySelector('[data-event="FIRE GOAL"]');
            expect(fireGoal.disabled).toBe(true);

            eventButtons.setState({ isActive: true, isRunning: true });
            expect(fireGoal.disabled).toBe(false);
            expect(container.querySelector('.zone-button').disabled).toBe(false);
        });
    });

    test('falls back to the default zone and Team 1 when none is given', () => {
        eventButtons.initialize(getNamedConfig('hockey-one-zoned'), { teams });
        expect(eventButtons.zone).toBe('1');
        expect(eventButtons.selectedTeam).toBe(1);
    });

    test('renders the selected team passed to initialize', () => {
        eventButtons.initialize(getNamedConfig('hockey-one-zoned'), { teams, selectedTeam: 2 });
        expect(container.querySelector('[data-event="TIGERS GOAL"]')).not.toBeNull();
        expect(container.querySelector('[data-event="FIRE GOAL"]')).toBeNull();
    });
});
