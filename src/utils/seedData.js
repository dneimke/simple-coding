/**
 * Seed Data Utility
 *
 * Provides instant mock state for developer testing, automated Playwright visual snapshots,
 * and deep-linking into specific UI states (?mock=sample, ?mock=active, ?seed=sample)
 * without requiring manual click-through or prior localStorage setup.
 */

import { storageService } from '../services/storageService.js';
import { DRAFT_STORAGE_KEY } from '../services/draftService.js';

export const SAMPLE_GAME_ID = 'sample-game';
export const GAMES_STORAGE_KEY = 'fieldHockeyGames_v1';

export const SAMPLE_GAMES = [
    {
        id: SAMPLE_GAME_ID,
        name: 'FIRE vs TIGERS',
        timestamp: '2026-10-20T10:00:00.000Z',
        events: [
            { event: 'FIRE BS1', timeMs: 45000, isTeam1: true, lead: 3, lag: 7 },
            { event: 'TIGERS A25E', timeMs: 120000, isTeam1: false, lead: 5, lag: 5 },
            { event: 'FIRE CE', timeMs: 310000, isTeam1: true, lead: 4, lag: 6 },
            { event: 'FIRE GOAL', timeMs: 615000, isTeam1: true, lead: 5, lag: 10, favorite: true },
            { event: 'TIGERS GREEN', timeMs: 940000, isTeam1: false, lead: 3, lag: 5 },
            { event: 'FIRE SHOT', timeMs: 1420000, isTeam1: true, lead: 4, lag: 6 },
            { event: 'TIGERS GOAL', timeMs: 1710000, isTeam1: false, lead: 5, lag: 10, favorite: true },
            { event: 'FIRE PC', timeMs: 2050000, isTeam1: true, lead: 6, lag: 8 }
        ]
    }
];

export const SAMPLE_DRAFT = {
    events: [
        { event: 'FIRE BS1', timeMs: 45000, isTeam1: true, lead: 3, lag: 7 },
        { event: 'TIGERS A25E', timeMs: 120000, isTeam1: false, lead: 5, lag: 5 },
        { event: 'FIRE CE', timeMs: 310000, isTeam1: true, lead: 4, lag: 6 },
        { event: 'FIRE GOAL', timeMs: 425000, isTeam1: true, lead: 5, lag: 10 }
    ],
    elapsedTime: 425000,
    runningSince: null,
    teams: [
        { code: 'FIRE', color: 'team-color-red' },
        { code: 'TIGERS', color: 'team-color-blue' }
    ],
    activeZone: '1',
    selectedTeam: 1,
    updatedAt: Date.now()
};

export const PC_COUNTER_DRAFT = {
    events: [
        {
            id: 'pc-1',
            event: 'FIRE PC',
            eventCode: 'PC',
            timeMs: 435000,
            timestamp: '07:15',
            team: 'FIRE',
            leadTime: 10,
            lagTime: 15,
            lead: 2,
            lag: 10
        },
        {
            id: 'pc-2',
            event: 'FIRE PC',
            eventCode: 'PC',
            timeMs: 435000,
            timestamp: '07:15',
            team: 'FIRE',
            leadTime: 10,
            lagTime: 15,
            lead: 2,
            lag: 10
        }
    ],
    elapsedTime: 435000,
    runningSince: null,
    teams: [
        { code: 'FIRE', color: 'team-color-red' },
        { code: 'TIGERS', color: 'team-color-yellow' }
    ],
    activeZone: '1',
    selectedTeam: 1,
    updatedAt: Date.now()
};

/**
 * Seed mock data into localStorage
 * @param {'sample'|'active'|'pc-counter'} [mockType='sample']
 * @returns {{seededGames: boolean, seededDraft: boolean}}
 */
export function seedMockData(mockType = 'sample') {
    let seededGames = false;
    let seededDraft = false;

    // Seed games list
    const existingGames = storageService.getItem(GAMES_STORAGE_KEY) || [];
    const hasSample = existingGames.some(g => g && g.id === SAMPLE_GAME_ID);

    if (!hasSample) {
        const updatedGames = [SAMPLE_GAMES[0], ...existingGames];
        storageService.setItem(GAMES_STORAGE_KEY, updatedGames);
        seededGames = true;
    }

    // Seed active draft if requested
    if (mockType === 'active') {
        storageService.setItem(DRAFT_STORAGE_KEY, SAMPLE_DRAFT);
        seededDraft = true;
    } else if (mockType === 'pc-counter') {
        storageService.setItem(DRAFT_STORAGE_KEY, PC_COUNTER_DRAFT);
        seededDraft = true;
    }

    return { seededGames, seededDraft };
}

/**
 * Ensures the sample game is available in localStorage.
 * Useful for deep links like #log/sample-game or timeline-video.html?game=sample-game.
 * @returns {boolean} True if the sample game was newly seeded
 */
export function ensureSampleGameExists() {
    const existingGames = storageService.getItem(GAMES_STORAGE_KEY) || [];
    const hasSample = existingGames.some(g => g && g.id === SAMPLE_GAME_ID);
    if (!hasSample) {
        seedMockData('sample');
        return true;
    }
    return false;
}

/**
 * Check window query params or a search string for ?mock=... or ?seed=...
 * and seed the state accordingly before UI initializes.
 * @param {string} [searchString] - Defaults to window.location.search
 * @returns {{mockType: string, seededGames: boolean, seededDraft: boolean}|null}
 */
export function checkAndApplyMockSeed(searchString = (typeof window !== 'undefined' ? (window.location?.search || window.location?.hash || '') : '')) {
    if (!searchString) return null;

    let searchPart = searchString;
    if (searchString.includes('?')) {
        searchPart = searchString.substring(searchString.indexOf('?'));
    }

    const params = new URLSearchParams(searchPart);
    const mockVal = params.get('mock') || params.get('seed');
    const stateVal = params.get('state');

    if (mockVal === 'pc-counter' || stateVal === 'adelaide-fire') {
        const { seededGames, seededDraft } = seedMockData('pc-counter');
        return { mockType: 'pc-counter', seededGames, seededDraft };
    }

    if (!mockVal) return null;

    const mockType = mockVal === 'active' ? 'active' : 'sample';
    const { seededGames, seededDraft } = seedMockData(mockType);

    return { mockType, seededGames, seededDraft };
}
