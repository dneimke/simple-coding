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
    generateGameXml: jest.fn((game, index) => {
        return `<?xml version="1.0" encoding="UTF-8"?>
<game date="${new Date(game.timestamp).toISOString().split('T')[0]}" teams="${game.teams || `Game ${index}`}">
    <events>
${game.events.map(event => `        <event event="${event.event}" timeMs="${event.timeMs}" />`).join('\n')}
    </events>
</game>`;
    })
}));

// Mock button creation function
jest.mock('../../../src/components/ui/button.js');

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

        // Find the Export XML button among the appended elements
        let exportButtonFound = false;
        for (const call of card.append.mock.calls[0]) {
            if (call.textContent === 'Export XML') {
                exportButtonFound = true;
                break;
            }
        }

        expect(exportButtonFound).toBe(true);
    });

    test('Export XML button click should generate XML file and trigger download', () => {
        const card = createGameCard({
            game: mockGame,
            index: 0,
            ...mockHandlers
        });

        // Find the Export XML button
        let exportButton;
        for (const call of card.append.mock.calls[0]) {
            if (call.textContent === 'Export XML') {
                exportButton = call;
                break;
            }
        }

        // Simulate click on export button
        const mockStopPropagation = jest.fn();
        exportButton.onclick({ stopPropagation: mockStopPropagation });

        // Verify stopPropagation was called
        expect(mockStopPropagation).toHaveBeenCalled();

        // Verify that generateGameXml was called with the correct parameters
        expect(generateGameXml).toHaveBeenCalledWith(mockGame, 1); // index + 1 = 0 + 1 = 1

        // Verify Blob was created
        expect(global.Blob).toHaveBeenCalled();

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
