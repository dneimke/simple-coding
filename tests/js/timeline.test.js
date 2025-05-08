/**
 * @jest-environment jsdom
 */

import { renderTimeline } from '../../src/js/timeline.js';

describe('Timeline Module', () => {
    // Setup: create a fresh container element before each test
    beforeEach(() => {
        document.body.innerHTML = `<div id="test-container"></div>`;
    }); test('renderTimeline should display events in descending chronological order', () => {
        // Arrange
        const events = [
            { event: 'Event 1', timeMs: 600000, description: 'First event' },
            { event: 'Event 2', timeMs: 660000, description: 'Second event' },
            { event: 'Event 3', timeMs: 540000, description: 'Third event' }
        ];

        // Act
        renderTimeline(events, 'test-container');

        // Assert
        const container = document.getElementById('test-container');
        const eventElements = container.querySelectorAll('div');

        // There should be 3 event elements
        expect(eventElements.length).toBe(3);

        // First element should be Event 2 (most recent)
        expect(eventElements[0].textContent).toContain('Event 2');
        // Last element should be Event 3 (oldest)
        expect(eventElements[2].textContent).toContain('Event 3');
    });

    test('renderTimeline should display a message when no events are provided', () => {
        // Arrange
        const events = [];

        // Act
        renderTimeline(events, 'test-container');

        // Assert
        const container = document.getElementById('test-container');
        expect(container.innerHTML).toContain('No events yet');
    }); test('renderTimeline should handle non-existent container gracefully', () => {
        // Arrange
        const events = [
            { event: 'Event 1', timeMs: 600000, description: 'First event' }
        ];
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        // Act
        renderTimeline(events, 'non-existent-container');

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
        consoleSpy.mockRestore();
    });    // Ensure elements have the expected structure and classes
    test('renderTimeline should create properly formatted event elements', () => {
        // Arrange
        const events = [
            { event: 'Test Event', timeMs: 605000, description: 'Description here' }
        ];

        // Act
        renderTimeline(events, 'test-container');

        // Assert
        const container = document.getElementById('test-container');
        const eventElement = container.querySelector('div');

        // Check the element has the expected classes
        expect(eventElement.className).toContain('mb-4');
        expect(eventElement.className).toContain('rounded');
        expect(eventElement.className).toContain('cursor-pointer');        // Check structure (contains event name)
        expect(eventElement.innerHTML).toContain('Test Event');// Check the time format (should be in the format MM:SS)
        const timeRegex = /\d{1,2}:\d{2}/;
        expect(eventElement.textContent).toMatch(timeRegex);
    });
});
