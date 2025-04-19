# Unit Testing Guide for Critical Functions

This document provides a guide on how to add unit tests for critical functions like `computeGameStatistics` and `renderSavedGamesList` to ensure correctness and prevent regressions.

---

## **1. Setting Up the Testing Environment**

### Install Jest

Jest is a popular JavaScript testing framework. To install it, run the following command in your project directory:

```bash
npm install --save-dev jest
```

### Add a Test Script

Update your `package.json` file to include a test script:

```json
"scripts": {
  "test": "jest"
}
```

---

## **2. Writing Unit Tests for `computeGameStatistics`**

### Function Overview

The `computeGameStatistics` function calculates the count of each event in a game.

#### Example Function

```javascript
export function computeGameStatistics(currentGame) {
    return currentGame.loggedEvents.reduce((stats, event) => {
        stats[event.event] = (stats[event.event] || 0) + 1;
        return stats;
    }, {});
}
```

### Test File

Create a test file named `utils.test.js` in the same directory as `utils.js`.

#### Test Cases

```javascript
import { computeGameStatistics } from './utils.js';

describe('computeGameStatistics', () => {
    it('should compute statistics correctly for logged events', () => {
        const currentGame = {
            loggedEvents: [
                { event: 'GOAL', timeMs: 1000 },
                { event: 'GOAL', timeMs: 2000 },
                { event: 'SHOT', timeMs: 3000 },
            ],
        };

        const result = computeGameStatistics(currentGame);

        expect(result).toEqual({
            GOAL: 2,
            SHOT: 1,
        });
    });

    it('should return an empty object if there are no logged events', () => {
        const currentGame = { loggedEvents: [] };

        const result = computeGameStatistics(currentGame);

        expect(result).toEqual({});
    });
});
```

---

## **3. Writing Unit Tests for `renderSavedGamesList`**

### Function Overview

The `renderSavedGamesList` function dynamically generates HTML for saved games and injects it into a container.

#### Example Function

```javascript
export function renderSavedGamesList(savedGames, container) {
    container.innerHTML = savedGames.map((game, index) => `
        <div class="saved-game-card">
            <h3>Game ${index + 1}</h3>
            <p>Events: ${game.events.length}</p>
            <p>Saved on: ${new Date(game.timestamp).toLocaleString()}</p>
        </div>
    `).join('');
}
```

### Test File

Add the following test cases to `utils.test.js`:

#### Test Cases

```javascript
import { renderSavedGamesList } from './utils.js';

describe('renderSavedGamesList', () => {
    let container;

    beforeEach(() => {
        // Create a mock container for testing
        container = document.createElement('div');
    });

    it('should render saved games correctly', () => {
        const savedGames = [
            { events: [{ event: 'GOAL' }], timestamp: '2025-04-19T12:00:00Z' },
            { events: [{ event: 'SHOT' }, { event: 'GOAL' }], timestamp: '2025-04-19T13:00:00Z' },
        ];

        renderSavedGamesList(savedGames, container);

        expect(container.innerHTML).toContain('Game 1');
        expect(container.innerHTML).toContain('Events: 1');
        expect(container.innerHTML).toContain('Saved on: 4/19/2025, 12:00:00 PM');

        expect(container.innerHTML).toContain('Game 2');
        expect(container.innerHTML).toContain('Events: 2');
        expect(container.innerHTML).toContain('Saved on: 4/19/2025, 1:00:00 PM');
    });

    it('should render an empty container if no saved games are provided', () => {
        renderSavedGamesList([], container);

        expect(container.innerHTML).toBe('');
    });
});
```

---

## **4. Running the Tests**

Run the tests using the following command:

```bash
npm test
```

---

## **5. Key Points**

### Mocking DOM Elements

For functions that manipulate the DOM, use `document.createElement` to create mock elements for testing.

### Edge Cases

Always test edge cases, such as empty input, invalid data, or unexpected scenarios.

### Assertions

Use `expect` statements to assert the expected output of the function.

---

By following this guide, you can ensure that critical functions in your project are thoroughly tested, reducing the risk of bugs and regressions.
