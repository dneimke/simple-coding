/**
 * Filters saved games by a text query while preserving each game's original array index.
 *
 * @template T
 * @param {T[]} games
 * @param {string | null | undefined} query
 * @returns {Array<{ game: T, index: number }>}
 */
export function filterSavedGames(games, query) {
    if (!Array.isArray(games)) {
        return [];
    }

    const normalizedQuery = typeof query === 'string' ? query.trim().toLowerCase() : '';
    const indexedGames = games.map((game, index) => ({ game, index }));

    if (!normalizedQuery) {
        return indexedGames;
    }

    return indexedGames.filter(({ game, index }) => {
        const record = /** @type {any} */ (game || {});
        const title = record.teams ? String(record.teams) : `Game ${index + 1}`;
        const team1Name = record.team1 && record.team1.name ? String(record.team1.name) : '';
        const team2Name = record.team2 && record.team2.name ? String(record.team2.name) : '';
        const searchable = `${title} ${team1Name} ${team2Name}`.toLowerCase();
        return searchable.includes(normalizedQuery);
    });
}
