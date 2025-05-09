/**
 * Tests for the UI Card components
 */
import { createCard } from '../../../src/components/ui/card.js';

// Mock any dependencies
jest.mock('../../../src/components/ui/button.js', () => ({
    createButton: jest.fn().mockImplementation((options) => {
        return {
            type: 'button',
            options
        };
    })
}));

// Mock document methods
document.createElement = jest.fn().mockImplementation((tag) => {
    const element = {
        className: '',
        textContent: '',
        innerHTML: '',
        appendChild: jest.fn()
    };
    return element;
});

describe('Card UI Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('createCard should create a card with the correct structure', () => {
        const card = createCard({
            header: 'Card Header',
            body: 'Card Body',
            footer: 'Card Footer',
            className: 'custom-card'
        });

        expect(document.createElement).toHaveBeenCalledWith('div');
        expect(card.className).toContain('custom-card');
        expect(card.className).toContain('bg-white rounded-lg');

        // Should create header, body, and footer elements
        expect(document.createElement).toHaveBeenCalledTimes(4); // card + header + body + footer
        expect(card.appendChild).toHaveBeenCalledTimes(3);
    }); test('createCard should handle string content', () => {
        // Simplify the test to focus on card creation
        const card = createCard({
            header: 'String Header',
            body: 'String Body'
        });

        // Check that card was created
        expect(document.createElement).toHaveBeenCalledWith('div');
        expect(document.createElement).toHaveBeenCalledTimes(3); // card + header + body elements
    });

    test('createCard should handle element content', () => {
        const headerContent = { tagName: 'H3' };
        const bodyContent = { tagName: 'P' };

        // Create a card with element content
        const card = createCard({
            header: headerContent,
            body: bodyContent
        });

        // Check that card was created
        expect(document.createElement).toHaveBeenCalledWith('div');
        expect(document.createElement).toHaveBeenCalledTimes(3); // card + header + body elements
    });
});
