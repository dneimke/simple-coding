# State Management Implementation

## Overview

This document outlines how state is managed in the Field Hockey Event Tracker application. The application uses a custom state management system built around the pub/sub (publisher/subscriber) pattern, which provides a centralized way to manage application state and notify components when changes occur.

## Core Component: StateService

The `stateService` module is the heart of the state management solution, providing:

1. **Centralized State Storage**
   - Maintains a single source of truth for application state
   - Initial state structure with logical sections:

     ```javascript
     _state: {
         game: {
             isActive: false,
             isRunning: false,
             elapsedTime: 0,
             loggedEvents: [],
             hasCurrentGame: false
         },
         ui: {
             currentView: 'EventCapture',
             currentTab: 'timelineView'
         }
     }
     ```

2. **State Access & Manipulation Methods**
   - `getState(path)` - Retrieves state values using dot notation paths
   - `setState(path, newValue, merge)` - Updates state values and notifies subscribers

3. **Subscription System**
   - `subscribe(path, handler)` - Registers callbacks for state changes
   - Returns an unsubscribe function to prevent memory leaks

## How Components Subscribe to State

The `GameState` class demonstrates a typical subscription pattern:

```javascript
constructor(timerDisplay, eventLog, eventButtons) {
    // Store UI references
    this.eventButtons = eventButtons;
    this.eventLog = eventLog;
    this.timerDisplay = timerDisplay;

    // Subscribe to game state changes
    stateService.subscribe('game', this._handleStateChange.bind(this));

    // Initialize UI with current state
    this._updateUI(stateService.getState('game'));
}

_handleStateChange(gameState) {
    this._updateUI(gameState);
}
```

This pattern allows the `GameState` component to:

1. Subscribe to changes in the 'game' state slice
2. Respond to those changes by updating the UI

## Notification Flow Example

When an event is added during gameplay:

1. The `addEvent` method in `GameState` modifies state:

   ```javascript
   addEvent(event) {
       const gameState = stateService.getState('game');

       // Validation checks...

       const events = [...gameState.loggedEvents, event];
       stateService.setState('game.loggedEvents', events);
   }
   ```

2. Inside `setState`, the state is updated and notifications are triggered:

   ```javascript
   setState(path, newValue, merge = false) {
       // Update the state...

       // Notify subscribers
       this._notify(path, this.getState(path));
   }
   ```

3. The `_notify` method handles notification propagation:
   - Notifies direct subscribers of the path
   - Also notifies subscribers of parent paths (cascading notifications)

4. The `_handleStateChange` callback in `GameState` is invoked:

   ```javascript
   _handleStateChange(gameState) {
       this._updateUI(gameState);
   }
   ```

5. The `_updateUI` method refreshes UI components:

   ```javascript
   _updateUI(gameState) {
       if (gameState.loggedEvents && this.eventLog) {
           this.eventLog.render(gameState.loggedEvents);
       }

       // Update other UI elements...
   }
   ```

## Advanced Features

1. **Path-based Subscriptions** - Components can subscribe to specific state slices, reducing unnecessary updates.

2. **Automatic Parent Path Notifications** - Updating a nested path (`game.loggedEvents`) also notifies subscribers of parent paths (`game`).

3. **Object Merging** - When updating objects, the `merge` parameter allows shallow merging with existing state.

4. **Unsubscribe Support** - Every subscription returns a function to remove the subscription, preventing memory leaks:

   ```javascript
   const unsubscribe = stateService.subscribe('path', handler);
   // Later when no longer needed:
   unsubscribe();
   ```

## Implementation Details

The state management system is implemented in `src/services/stateService.js` and follows these key principles:

### 1. Immutability

State updates create new objects rather than mutating existing ones, which helps with:

- Preventing unintended side effects
- Supporting undo/redo functionality in the future
- Easier debugging and state tracking

### 2. Path-based State Access

The dot notation path system allows components to:

- Access deeply nested state values with simple syntax
- Subscribe to specific parts of the state tree
- Receive updates only when relevant data changes

### 3. Centralized Updates

All state mutations go through `setState()`, which ensures:

- Consistent state update patterns
- Proper notification of all subscribers
- A single entry point for potential logging or middleware

## Usage Guidelines

When implementing new components that need to interact with application state:

1. **Identify Required State** - Determine which pieces of state the component needs
2. **Subscribe to Relevant Paths** - Use specific paths to minimize unnecessary updates
3. **Handle Cleanup** - Store and call the unsubscribe function when the component is no longer needed
4. **Avoid Direct State Mutation** - Always use `setState()` to update state

## Benefits of This Approach

This state management approach provides several advantages:

1. **Lightweight** - No external dependencies required
2. **Modular** - Components can subscribe only to what they need
3. **Testable** - Pure functions and ES6 modules make testing straightforward
4. **Efficient** - Targeted updates prevent unnecessary re-renders
5. **Understandable** - Simple API with predictable behavior

## Subscription and Notification Flow Diagram

The diagram below illustrates how components interact with the state management system:

```ascii
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                       State Management System                           │
│                                                                         │
├─────────────────────────────────────────┬───────────────────────────────┤
│                                         │                               │
│  ┌───────────────────┐                  │  ┌─────────────────────────┐  │
│  │                   │                  │  │                         │  │
│  │   Central State   │◄─────────────────┘  │    Subscriber Registry  │  │
│  │                   │  Updates State      │                         │  │
│  └──────────┬────────┘                     └─────────────┬───────────┘  │
│             │                                            │              │
└─────────────┼────────────────────────────────────────────┼──────────────┘
              │                                            │
              │                                            │
              ▼                                            │
┌─────────────────────────┐                                │
│                         │                                │
│  1. State Change Event  │                                │
│                         │                                │
└──────────────┬──────────┘                                │
               │                                           │
               │                                           │
               ▼                                           │
┌─────────────────────────┐                                │
│                         │                                │
│  2. _notify() Called    │                                │
│                         │                                │
└──────────────┬──────────┘                                │
               │                                           │
               │                                           │
               ▼                                           │
┌─────────────────────────┐        Looks Up         ┌─────▼───────────────┐
│                         │◄───────Handlers─────────┤                     │
│  3. Find Subscribers    │                         │   Subscribed        │
│     for Path            │                         │   Components        │
└──────────────┬──────────┘                         │                     │
               │                                    └─────────────────────┘
               │
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  4. Execute Callback for Each Subscriber with Updated State  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
               │
               │
               ▼
┌─────────────────────────┐         ┌────────────────────────┐
│                         │         │                        │
│  Component A            │         │  Component B           │
│  _handleStateChange()   │         │  _handleStateChange()  │
│                         │         │                        │
└─────────────────────────┘         └────────────────────────┘
               │                                │
               │                                │
               ▼                                ▼
┌─────────────────────────┐         ┌────────────────────────┐
│                         │         │                        │
│  Update UI Elements     │         │  Update UI Elements    │
│                         │         │                        │
└─────────────────────────┘         └────────────────────────┘
```

### Example Scenario

In this example:

1. A user clicks a button to log an event during gameplay
2. `GameState.addEvent()` calls `stateService.setState('game.loggedEvents', events)`
3. `setState()` updates the internal state and calls `_notify()`
4. `_notify()` finds all subscribers for 'game.loggedEvents' and 'game'
5. Each subscriber's handler function is called with the updated state
6. Components (GameState, EventLog) update their UI elements based on the new state

This pattern ensures that all components depending on a particular part of the state are updated when changes occur, while components not dependent on that state remain unaffected.
