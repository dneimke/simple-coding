# State Management Implementation

## Overview

This document outlines the implementation of a simple state management pattern in the Field Hockey Event Tracker application. The state management pattern follows a pub/sub (publisher/subscriber) approach, providing a centralized state store with the ability for components to subscribe to state changes.

## Key Components

### State Service (`src/services/stateService.js`)

The core of the state management system is the `stateService` module, which:

- Maintains a central state store
- Provides methods to get and update state
- Implements a pub/sub pattern for state change notifications
- Supports dot notation for accessing nested state properties

### Key Features

1. **Centralized State Store**
   - Single source of truth for application state
   - State is organized into logical sections (e.g., `game`, `ui`)

2. **Pub/Sub Pattern**
   - Components can subscribe to specific state changes
   - Subscribers are notified when relevant state changes occur
   - Support for unsubscribing to prevent memory leaks

3. **Path-based Access**
   - Dot notation for accessing nested state properties
   - Automatic creation of intermediate objects for deep paths
   - Parent path subscribers are notified of child path changes

## API Reference

### `getState(path)`

Gets the current state or a specific state slice.

**Parameters:**

- `path` (optional): Dot notation path to specific state slice (e.g., `game.isRunning`)

**Returns:** Current state or state slice

### `setState(path, newValue, merge)`

Updates state at the specified path and notifies subscribers.

**Parameters:**

- `path`: Dot notation path to state slice to update
- `newValue`: New value to set
- `merge` (optional): Whether to merge with existing object (default: `false`)

### `subscribe(path, handler)`

Subscribes to state changes at the specified path.

**Parameters:**

- `path`: Path to state slice to subscribe to
- `handler`: Callback function to be called when state changes

**Returns:** Unsubscribe function

## Implementation in Components

### Router Component

The Router component was updated to:

- Subscribe to UI state changes (`ui.currentView` and `ui.currentTab`)
- Update the view and tab display based on state changes
- Update state when navigation occurs

### GameState Component

The GameState component was updated to:

- Subscribe to game state changes
- Update UI components based on state changes
- Update state when game actions occur (start, pause, etc.)

### Event Listeners

Event listeners in `main.js` were updated to:

- Read state from the state service
- Update state through the GameState and Router components
- React to state changes through subscriptions

## Testing

Unit tests for the state service cover:

- Getting and setting state at various paths
- Subscribing to state changes
- Unsubscribing from state changes
- Handling parent and child path subscriptions

## Future Improvements

1. **Dev Tools**: Add developer tools for state inspection and debugging
2. **Middleware**: Implement middleware support for logging, validation, etc.
3. **State Persistence**: Add support for persisting state across page reloads
4. **Action Creators**: Add typed action creators for more structured state updates
5. **Selectors**: Add memoized selectors for derived state
