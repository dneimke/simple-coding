import {
    validateTeams,
    normalizeTeams,
    loadLastTeams,
    saveLastTeams,
    openTeamSetupDialog,
    LAST_TEAMS_STORAGE_KEY
} from '../../src/components/teamSetupDialog.js';
import { DEFAULT_TEAMS } from '../../src/components/teamPalette.js';

describe('normalizeTeams', () => {
    test('trims and upper-cases codes', () => {
        expect(normalizeTeams([{ code: ' fire ', color: 'red' }, { code: 'Tigers', color: 'yellow' }]))
            .toEqual([{ code: 'FIRE', color: 'red' }, { code: 'TIGERS', color: 'yellow' }]);
    });
});

describe('validateTeams', () => {
    const teams = (one, two) => [{ code: 'FIRE', color: 'red', ...one }, { code: 'TIGERS', color: 'yellow', ...two }];

    test('accepts two distinct teams with palette colours', () => {
        expect(validateTeams(teams())).toBeNull();
    });

    test('requires a code for each team', () => {
        expect(validateTeams(teams({ code: '' }))).toBe('Team 1 needs a code.');
        expect(validateTeams(teams({}, { code: '' }))).toBe('Team 2 needs a code.');
    });

    test('rejects codes with spaces or longer than 12 characters', () => {
        expect(validateTeams(teams({ code: 'FIRE HC' }))).toBe("Team 1 code can't contain spaces.");
        expect(validateTeams(teams({}, { code: 'ABCDEFGHIJKLM' }))).toBe('Team 2 code must be 12 characters or fewer.');
    });

    test('requires colours from the palette', () => {
        expect(validateTeams(teams({ color: 'pink' }))).toBe('Pick a colour for Team 1.');
    });

    test('requires distinct codes and colours', () => {
        expect(validateTeams(teams({}, { code: 'FIRE' }))).toBe('Team codes must be different.');
        expect(validateTeams(teams({}, { color: 'red' }))).toBe('Team colours must be different.');
    });

    test('requires exactly two teams', () => {
        expect(validateTeams([{ code: 'FIRE', color: 'red' }])).toBe('Enter two teams.');
    });
});

describe('openTeamSetupDialog', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="teamSetupModal" class="hidden">
                <form id="teamSetupForm">
                    <input id="teamCode1"><div id="teamSwatches1"></div>
                    <input id="teamCode2"><div id="teamSwatches2"></div>
                    <p id="teamSetupError" class="hidden"></p>
                    <button id="teamSetupCancel" type="button">Cancel</button>
                    <button type="submit">Start</button>
                </form>
            </div>`;
    });

    const submit = () => document.getElementById('teamSetupForm')
        .dispatchEvent(new Event('submit', { cancelable: true }));

    test('prefills teams, disables the other team colour and resolves with the chosen teams', async () => {
        const result = openTeamSetupDialog(DEFAULT_TEAMS);
        const modal = document.getElementById('teamSetupModal');
        expect(modal.classList.contains('hidden')).toBe(false);
        expect(document.getElementById('teamCode1').value).toBe('FIRE');
        expect(document.querySelector('#teamSwatches1 .team-color-yellow').disabled).toBe(true);

        document.getElementById('teamCode1').value = 'melb';
        document.querySelector('#teamSwatches1 .team-color-navy').click();
        submit();

        await expect(result).resolves.toEqual([{ code: 'MELB', color: 'navy' }, { code: 'TIGERS', color: 'yellow' }]);
        expect(modal.classList.contains('hidden')).toBe(true);
    });

    test('shows a validation message and stays open until the teams are valid', async () => {
        const result = openTeamSetupDialog(DEFAULT_TEAMS);
        document.getElementById('teamCode2').value = 'fire';
        submit();

        const error = document.getElementById('teamSetupError');
        expect(error.textContent).toBe('Team codes must be different.');
        expect(document.getElementById('teamSetupModal').classList.contains('hidden')).toBe(false);

        document.getElementById('teamCode2').value = 'perth';
        submit();
        await expect(result).resolves.toEqual([{ code: 'FIRE', color: 'red' }, { code: 'PERTH', color: 'yellow' }]);
    });

    test('resolves with null when cancelled', async () => {
        const result = openTeamSetupDialog(DEFAULT_TEAMS);
        document.getElementById('teamSetupCancel').click();
        await expect(result).resolves.toBeNull();
    });
});

describe('last teams', () => {
    beforeEach(() => localStorage.clear());

    test('falls back to the default teams', () => {
        expect(loadLastTeams()).toEqual(DEFAULT_TEAMS);
    });

    test('round-trips saved teams', () => {
        const teams = [{ code: 'MELB', color: 'navy' }, { code: 'PERTH', color: 'orange' }];
        saveLastTeams(teams);

        expect(JSON.parse(localStorage.getItem(LAST_TEAMS_STORAGE_KEY))).toEqual(teams);
        expect(loadLastTeams()).toEqual(teams);
    });

    test('ignores invalid saved teams', () => {
        localStorage.setItem(LAST_TEAMS_STORAGE_KEY, JSON.stringify([{ code: 'A', color: 'red' }]));
        expect(loadLastTeams()).toEqual(DEFAULT_TEAMS);
    });
});
