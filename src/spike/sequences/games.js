/**
 * Loads a coded match for the sequence spike page.
 */

import { buildSequences } from './engine.js';
import { loadGameText } from './load-game.js';

export const SAVED_GAMES_KEY = 'fieldHockeyGames_v1';

/**
 * @param {Storage} storage
 * @returns {Array<object>}
 */
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
    if (typeof game.teams === 'string' && game.teams.trim()) return game.teams.trim();
    if (Array.isArray(game.teams) && game.teams.length) {
        const names = game.teams.map(team => {
            if (typeof team === 'string') return team;
            return team?.code || team?.name || '';
        }).filter(Boolean);
        if (names.length) return names.join(' vs ');
    }
    return 'Coded match';
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
