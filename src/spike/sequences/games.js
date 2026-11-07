/**
 * Loads a coded match for the sequence spike page.
 */

import { buildSequences } from './engine.js';
import { loadGameText } from './load-game.js';

const SAVED_GAMES_KEY = 'fieldHockeyGames_v1';

export function readSavedGames(storage) {
    if (!storage || typeof storage.getItem !== 'function') return [];
    try {
        const parsed = JSON.parse(storage.getItem(SAVED_GAMES_KEY) || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(game => game && Array.isArray(game.events));
    } catch {
        return [];
    }
}

/**
 * @param {object} game
 * @returns {string}
 */
export function gameLabel(game) {
    if (!game) return 'Coded match';
    if (game.name) return String(game.name);
    return teamsLabel(game.teams) || 'Coded match';
}

function teamsLabel(teams) {
    if (typeof teams === 'string') return teams.trim();
    if (!Array.isArray(teams)) return '';
    return teams.map(teamText).filter(Boolean).join(' vs ');
}

function teamText(team) {
    if (typeof team === 'string') return team;
    return team?.code || team?.name || '';
}

/**
 * @param {string} text
 * @returns {{ game: object, result: object, mutated: boolean }}
 */
export function analyseGameText(text) {
    const game = loadGameText(text);
    const snapshot = JSON.stringify(game.events);
    const result = buildSequences(game.events, { teams: game.teams });
    return {
        game,
        result,
        mutated: JSON.stringify(game.events) !== snapshot
    };
}
