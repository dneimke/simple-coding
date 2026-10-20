import { seedMockData, checkAndApplyMockSeed, ensureSampleGameExists } from '../../src/utils/seedData.js';
import { storageService } from '../../src/services/storageService.js';
import { DRAFT_STORAGE_KEY } from '../../src/services/draftService.js';

describe('seedData utility', () => {
    const GAMES_KEY = 'fieldHockeyGames_v1';

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    describe('seedMockData', () => {
        test('seeds sample game into empty games list', () => {
            const result = seedMockData('sample');
            expect(result.seededGames).toBe(true);

            const games = storageService.getItem(GAMES_KEY);
            expect(Array.isArray(games)).toBe(true);
            expect(games.length).toBeGreaterThan(0);
            expect(games[0].id).toBe('sample-game');
            expect(games[0].name).toBe('FIRE vs TIGERS');
            expect(games[0].events.length).toBeGreaterThan(0);
        });

        test('preserves existing games when seeding sample game', () => {
            const existing = [{ id: 'existing-1', name: 'Existing Game', events: [] }];
            storageService.setItem(GAMES_KEY, existing);

            seedMockData('sample');

            const games = storageService.getItem(GAMES_KEY);
            expect(games.length).toBe(2);
            expect(games.find(g => g.id === 'sample-game')).toBeDefined();
            expect(games.find(g => g.id === 'existing-1')).toBeDefined();
        });

        test('does not duplicate sample game if already present', () => {
            seedMockData('sample');
            const countAfterFirst = storageService.getItem(GAMES_KEY).length;

            seedMockData('sample');
            const countAfterSecond = storageService.getItem(GAMES_KEY).length;

            expect(countAfterSecond).toBe(countAfterFirst);
        });

        test('seeds active capture draft when mockType is active', () => {
            const result = seedMockData('active');
            expect(result.seededDraft).toBe(true);

            const draft = storageService.getItem(DRAFT_STORAGE_KEY);
            expect(draft).toBeDefined();
            expect(draft.events.length).toBeGreaterThan(0);
            expect(draft.teams).toHaveLength(2);
            expect(draft.teams[0].code).toBe('FIRE');
            expect(draft.teams[1].code).toBe('TIGERS');
        });

        test('seeds pc-counter draft when mockType is pc-counter', () => {
            const result = seedMockData('pc-counter');
            expect(result.seededDraft).toBe(true);

            const draft = storageService.getItem(DRAFT_STORAGE_KEY);
            expect(draft).toBeDefined();
            expect(draft.elapsedTime).toBe(435000);
            expect(draft.events).toHaveLength(2);
            expect(draft.events[0].event).toBe('FIRE PC');
            expect(draft.events[0].timestamp).toBe('07:15');
            expect(draft.teams[0].code).toBe('FIRE');
        });
    });

    describe('checkAndApplyMockSeed', () => {
        test('seeds sample data when search string has ?mock=sample or ?seed=sample', () => {
            const result = checkAndApplyMockSeed('?mock=sample');
            expect(result).not.toBeNull();
            expect(result.mockType).toBe('sample');
            expect(storageService.getItem(GAMES_KEY)).not.toBeNull();
        });

        test('seeds active draft when search string has ?mock=active', () => {
            const result = checkAndApplyMockSeed('?mock=active');
            expect(result.mockType).toBe('active');
            expect(storageService.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();
        });

        test('seeds pc-counter draft when preview URL has ?state=adelaide-fire&mock=pc-counter', () => {
            const result = checkAndApplyMockSeed('?state=adelaide-fire&mock=pc-counter');
            expect(result).not.toBeNull();
            expect(result.mockType).toBe('pc-counter');
            const draft = storageService.getItem(DRAFT_STORAGE_KEY);
            expect(draft).toBeDefined();
            expect(draft.elapsedTime).toBe(435000);
            expect(draft.events[0].eventCode).toBe('PC');
        });

        test('returns null and does not seed when no mock/seed param is present', () => {
            const result = checkAndApplyMockSeed('?view=config');
            expect(result).toBeNull();
            expect(storageService.getItem(GAMES_KEY)).toBeNull();
            expect(storageService.getItem(DRAFT_STORAGE_KEY)).toBeNull();
        });
    });

    describe('ensureSampleGameExists', () => {
        test('seeds sample game if not present', () => {
            expect(storageService.getItem(GAMES_KEY)).toBeNull();
            const seeded = ensureSampleGameExists();
            expect(seeded).toBe(true);
            expect(storageService.getItem(GAMES_KEY)).not.toBeNull();
        });

        test('returns false if sample game is already present', () => {
            ensureSampleGameExists();
            const seededAgain = ensureSampleGameExists();
            expect(seededAgain).toBe(false);
        });
    });
});
