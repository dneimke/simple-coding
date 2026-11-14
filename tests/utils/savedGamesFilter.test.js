import { filterSavedGames } from '../../src/utils/savedGamesFilter.js';

describe('filterSavedGames', () => {
    const sampleGames = [
        { id: '1', teams: 'Fire vs Tigers', timestamp: 1700000000000 },
        { id: '2', teams: 'NSW Pride vs Brisbane Blaze', timestamp: 1700001000000 },
        { id: '3', teams: 'Perth Thundersticks vs NSW Pride', timestamp: 1700002000000 },
        { id: '4', teams: '', timestamp: 1700003000000 }
    ];

    it('returns all games with original indices when query is empty or whitespace', () => {
        expect(filterSavedGames(sampleGames, '')).toEqual([
            { game: sampleGames[0], index: 0 },
            { game: sampleGames[1], index: 1 },
            { game: sampleGames[2], index: 2 },
            { game: sampleGames[3], index: 3 }
        ]);
        expect(filterSavedGames(sampleGames, '   ')).toHaveLength(4);
        expect(filterSavedGames(sampleGames, null)).toHaveLength(4);
        expect(filterSavedGames(sampleGames, undefined)).toHaveLength(4);
    });

    it('filters games case-insensitively and preserves original indices', () => {
        const results = filterSavedGames(sampleGames, 'pride');
        expect(results).toEqual([
            { game: sampleGames[1], index: 1 },
            { game: sampleGames[2], index: 2 }
        ]);
    });

    it('trims whitespace around the search query', () => {
        const results = filterSavedGames(sampleGames, '  fire  ');
        expect(results).toEqual([{ game: sampleGames[0], index: 0 }]);
    });

    it('matches fallback title when teams is empty', () => {
        const results = filterSavedGames(sampleGames, 'game 4');
        expect(results).toEqual([{ game: sampleGames[3], index: 3 }]);
    });

    it('matches team1/team2 names when teams string is absent', () => {
        const gamesWithTeamObjs = [
            { id: 'a', team1: { name: 'NSW Pride' }, team2: { name: 'Adelaide Fire' } }
        ];
        expect(filterSavedGames(gamesWithTeamObjs, 'adelaide')).toEqual([
            { game: gamesWithTeamObjs[0], index: 0 }
        ]);
    });

    it('returns an empty array when nothing matches or input is invalid', () => {
        expect(filterSavedGames(sampleGames, 'nonexistent')).toEqual([]);
        expect(filterSavedGames([], 'pride')).toEqual([]);
        expect(filterSavedGames(null, 'pride')).toEqual([]);
    });
});
