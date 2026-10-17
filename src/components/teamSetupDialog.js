import { storageService } from '../services/storageService.js';
import { DEFAULT_TEAMS, TEAM_PALETTE, getTeamColor } from './teamPalette.js';

export const LAST_TEAMS_STORAGE_KEY = 'fieldHockeyLastTeams_v1';
export const MAX_TEAM_CODE_LENGTH = 12;

/**
 * Trim and upper-case team codes so they read consistently in event names
 * @param {Array<{code: string, color: string}>} teams
 * @returns {Array<{code: string, color: string}>}
 */
export function normalizeTeams(teams) {
    return teams.map(team => ({ code: String(team?.code ?? '').trim().toUpperCase(), color: team?.color }));
}

/**
 * Check Team 1 and Team 2 can be used to name events
 * @param {Array<{code: string, color: string}>} teams - Normalised teams
 * @returns {string|null} The first problem found, or null when the teams are valid
 */
export function validateTeams(teams) {
    if (!Array.isArray(teams) || teams.length !== 2) return 'Enter two teams.';

    for (const [index, team] of teams.entries()) {
        const label = `Team ${index + 1}`;
        if (!team.code) return `${label} needs a code.`;
        if (/\s/.test(team.code)) return `${label} code can't contain spaces.`;
        if (team.code.length > MAX_TEAM_CODE_LENGTH) {
            return `${label} code must be ${MAX_TEAM_CODE_LENGTH} characters or fewer.`;
        }
        if (!getTeamColor(team.color)) return `Pick a colour for ${label}.`;
    }
    if (teams[0].code === teams[1].code) return 'Team codes must be different.';
    if (teams[0].color === teams[1].color) return 'Team colours must be different.';
    return null;
}

/**
 * Teams used for the last game, falling back to the defaults
 * @returns {Array<{code: string, color: string}>}
 */
export function loadLastTeams() {
    const saved = storageService.getItem(LAST_TEAMS_STORAGE_KEY);
    if (Array.isArray(saved) && validateTeams(normalizeTeams(saved)) === null) {
        return normalizeTeams(saved);
    }
    return DEFAULT_TEAMS.map(team => ({ ...team }));
}

export function saveLastTeams(teams) {
    return storageService.setItem(LAST_TEAMS_STORAGE_KEY, teams);
}

/**
 * Ask for Team 1 and Team 2 codes and colours before a game starts
 * @param {Array<{code: string, color: string}>} initialTeams - Prefilled teams
 * @returns {Promise<Array<{code: string, color: string}>|null>} Chosen teams, or null if cancelled
 */
export function openTeamSetupDialog(initialTeams) {
    const modal = document.getElementById('teamSetupModal');
    const form = document.getElementById('teamSetupForm');
    const cancelButton = document.getElementById('teamSetupCancel');
    const errorMessage = document.getElementById('teamSetupError');
    const codeInputs = [1, 2].map(slot => document.getElementById(`teamCode${slot}`));
    const swatchContainers = [1, 2].map(slot => document.getElementById(`teamSwatches${slot}`));

    const colors = initialTeams.map(team => team.color);
    codeInputs.forEach((input, index) => { input.value = initialTeams[index].code; });

    const renderSwatches = () => {
        swatchContainers.forEach((container, index) => {
            const otherColor = colors[1 - index];
            container.replaceChildren(...TEAM_PALETTE.map(color => {
                const swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = `swatch team-color-${color.id}`;
                swatch.title = color.name;
                swatch.setAttribute('aria-label', `Team ${index + 1} ${color.name}`);
                swatch.setAttribute('aria-pressed', String(colors[index] === color.id));
                swatch.classList.toggle('is-selected', colors[index] === color.id);
                swatch.disabled = color.id === otherColor;
                swatch.addEventListener('click', () => {
                    colors[index] = color.id;
                    renderSwatches();
                });
                return swatch;
            }));
        });
    };

    const showError = (message) => {
        errorMessage.textContent = message ?? '';
        errorMessage.classList.toggle('hidden', !message);
    };

    renderSwatches();
    showError(null);
    modal.classList.remove('hidden');
    codeInputs[0].focus();
    codeInputs[0].select();

    return new Promise(resolve => {
        const close = (result) => {
            modal.classList.add('hidden');
            form.removeEventListener('submit', onSubmit);
            cancelButton.removeEventListener('click', onCancel);
            modal.removeEventListener('keydown', onKeydown);
            resolve(result);
        };
        const onSubmit = (event) => {
            event.preventDefault();
            const teams = normalizeTeams(codeInputs.map((input, index) => ({ code: input.value, color: colors[index] })));
            const problem = validateTeams(teams);
            if (problem) {
                showError(problem);
                return;
            }
            close(teams);
        };
        const onCancel = () => close(null);
        const onKeydown = (event) => {
            if (event.key === 'Escape') close(null);
        };

        form.addEventListener('submit', onSubmit);
        cancelButton.addEventListener('click', onCancel);
        modal.addEventListener('keydown', onKeydown);
    });
}
