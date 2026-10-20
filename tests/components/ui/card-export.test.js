/**
 * Tests for the Export XML functionality in Game Card component
 */
import { createGameCard } from '../../../src/components/ui/card.js';
import { escapeXml } from '../../../src/utils/formatUtils.js';
import { generateGameXml } from '../../../src/utils/xmlUtils.js';

// Mock dependencies
jest.mock('../../../src/utils/formatUtils.js', () => ({
    escapeXml: jest.fn(str => str)
}));

// Mock XML utils
jest.mock('../../../src/utils/xmlUtils.js', () => ({
    generateGameXml: jest.fn((game) => {
        return `<?xml version="1.0" encoding="utf-8"?>
<file>
  <ALL_INSTANCES>
${game.events.map((event, i) => `    <instance><ID>${i + 1}</ID><code>${event.event}</code></instance>`).join('\n')}
  </ALL_INSTANCES>
  <ROWS />
</file>`;
    }),
    getInvalidEvents: jest.fn((game) => [])
}));

// Mock button creation function
jest.mock('../../../src/components/ui/button.js');

// Buttons live in the card's .saved-game-actions row
const findActionButton = (card, text) => {
    const actions = card.append.mock.calls[0].find(el => el.className === 'saved-game-actions');
    return actions.append.mock.calls[0].find(el => el.textContent === text);
};

// Set up before tests run
beforeAll(() => {
    // Mock DOM methods
    document.createElement = jest.fn().mockImplementation(tag => {
        const element = {
            tagName: tag.toUpperCase(),
            className: '',
            textContent: '',
            innerHTML: '',
            setAttribute: jest.fn(),
            appendChild: jest.fn(),
            append: jest.fn(),
            style: {},
            href: '',
            download: '',
            click: jest.fn()
        };
        return element;
    });

    // Mock getElementById to return a simple element object for modal controls
    document.getElementById = jest.fn().mockImplementation((id) => {
        return {
            id,
            onclick: null,
            classList: {
                add: jest.fn(),
                remove: jest.fn()
            },
            innerHTML: ''
        };
    });

    // Set up mock implementation for button
    const { createButton } = require('../../../src/components/ui/button.js');
    createButton.mockImplementation(options => {
        const mockButton = document.createElement('button');
        mockButton.textContent = options.text;
        mockButton.className = options.className || '';
        mockButton.onclick = options.onClick;
        return mockButton;
    });
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL = {
    createObjectURL: jest.fn(() => 'blob:mock-url'),
    revokeObjectURL: jest.fn()
};

// Mock Blob
global.Blob = jest.fn(content => ({
    content,
    size: 100,
    type: 'application/xml'
}));

describe('Export XML Functionality', () => {
    let mockGame;
    let mockHandlers;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers(); // Use fake timers

        // Set up a mock game
        mockGame = {
            teams: 'Test Team vs Opponent',
            timestamp: '2025-05-10T14:30:00Z',
            events: [
                { event: 'GOAL_FOR', timeMs: 60000 },
                { event: 'FOUL', timeMs: 120000 }
            ]
        }; mockHandlers = {
            onRename: jest.fn(),
            onDelete: jest.fn()
        };

        // Ensure document.body.appendChild and removeChild are mocked
        document.body.appendChild = jest.fn();
        document.body.removeChild = jest.fn();
    });

    test('Export XML button should be created with the card', () => {
        const card = createGameCard({
            game: mockGame,
            index: 0,
            ...mockHandlers
        });

        expect(findActionButton(card, 'Export XML')).toBeDefined();
    });

    test('Export XML button click should generate XML file and trigger download', () => {
        const card = createGameCard({
            game: mockGame,
            index: 0,
            ...mockHandlers
        });

        const exportButton = findActionButton(card, 'Export XML');

        // Simulate click on export button
        const mockStopPropagation = jest.fn();
        exportButton.onclick({ stopPropagation: mockStopPropagation });

        // Verify stopPropagation was called
        expect(mockStopPropagation).toHaveBeenCalled();

        // Verify that generateGameXml was called with the correct parameters
        expect(generateGameXml).toHaveBeenCalledWith(mockGame, 1); // index + 1 = 0 + 1 = 1

        // Verify Blob was created with the Sportscode document
        expect(global.Blob).toHaveBeenCalled();
        const [[blobContent]] = global.Blob.mock.calls[0];
        expect(blobContent).toContain('<file>');
        expect(blobContent).toContain('<ALL_INSTANCES>');
        expect(blobContent).toContain('<ROWS />');

        // Verify URL.createObjectURL was called
        expect(URL.createObjectURL).toHaveBeenCalled();

        // Verify a download was triggered
        expect(document.createElement).toHaveBeenCalledWith('a');
        const anchorElement = document.createElement.mock.results.find(
            r => r.value && r.value.tagName === 'A'
        ).value;

        expect(anchorElement.href).toBe('blob:mock-url'); expect(anchorElement.download).toBe('test-team-vs-opponent.xml');
        expect(anchorElement.click).toHaveBeenCalled();

        // Test cleanup (setTimeout would be called)
        expect(document.body.appendChild).toHaveBeenCalled();

        // Run the setTimeout callback
        jest.runAllTimers();
    });
});

describe('View Log button', () => {
    const game = {
        teams: 'Test Team vs Opponent',
        timestamp: '2025-05-10T14:30:00Z',
        events: [{ event: 'GOAL_FOR', timeMs: 60000 }]
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('is not rendered without an onViewLog handler', () => {
        const card = createGameCard({ game, index: 0, onRename: jest.fn(), onDelete: jest.fn() });
        expect(findActionButton(card, 'View Log')).toBeUndefined();
    });

    test('calls onViewLog and stops propagation when clicked', () => {
        const onViewLog = jest.fn();
        const card = createGameCard({ game, index: 0, onRename: jest.fn(), onDelete: jest.fn(), onViewLog });

        const stopPropagation = jest.fn();
        findActionButton(card, 'View Log').onclick({ stopPropagation });

        expect(stopPropagation).toHaveBeenCalled();
        expect(onViewLog).toHaveBeenCalledTimes(1);
    });
});
