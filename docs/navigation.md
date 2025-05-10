# Navigation System

## Overview

The Field Hockey Event Tracker implements a modern navigation system using a vanilla JavaScript router with hash-based navigation. This document explains how the navigation works, including the router implementation, deep linking capabilities, and view transitions.

## Router Architecture

The application uses a custom `Router` class located in `src/components/router.js` that handles all navigation between views. This class is responsible for:

1. **Hash-Based Routing**: Using URL fragments (e.g., `#event-capture`) to determine which view to display
2. **View Management**: Showing/hiding view components based on the current route
3. **Navigation State**: Managing the active/inactive state of navigation buttons
4. **Tab Navigation**: Handling sub-navigation within specific views (e.g., tabs within the Log view)

The router works in conjunction with the application's state management system to ensure consistent navigation state across the application.

## Deep Linking

Deep linking allows users to navigate directly to specific views using URL hash fragments. This enables:

- Bookmarking specific views
- Sharing direct links to specific views
- Using browser back/forward navigation
- Entering the application at a specific view

Available deep links include:

- `index.html#event-capture` - Event Capture view
- `index.html#log` - Log view (requires active game)
- `index.html#configure` - Configure view
- `index.html#saved-games` - Saved Games view

## View Mapping

The router maintains two mapping objects to translate between internal view names and URL hash fragments:

```javascript
// Internal view names → URL hash fragments
viewToHashMap = {
    'EventCapture': 'event-capture',
    'Config': 'configure',
    'Log': 'log',
    'SavedGames': 'saved-games'
};

// URL hash fragments → Internal view names
hashToViewMap = {
    'event-capture': 'EventCapture',
    'configure': 'Config',
    'log': 'Log',
    'saved-games': 'SavedGames'
};
```

## Navigation Flow Example

Here's an end-to-end example of what happens during a navigation event:

### 1. User-Initiated Navigation

When a user clicks on the "Configure" navigation link:

```html
<a href="#configure" id="navConfig" class="text-gray-400 hover:text-white-300 font-medium">Configure</a>
```

### 2. Hash Change Detection

The browser's URL changes to `index.html#configure`, which triggers the `hashchange` event. The Router's `_handleHashChange` method is called:

```javascript
_handleHashChange() {
    // Get the hash without the # character
    const hash = window.location.hash.substring(1);

    if (hash) {
        const viewName = this.hashToViewMap[hash];
        if (viewName) {
            // Check prerequisites...

            // Show the requested view
            this._showViewWithoutHashUpdate(viewName);
        } else {
            // Invalid hash, default to EventCapture
            // ...
        }
    } else {
        // No hash, default to EventCapture
        // ...
    }
}
```

### 3. View Name Translation

The router converts the hash fragment `"configure"` to the internal view name `"Config"` using the `hashToViewMap`.

### 4. Prerequisites Check

For certain views, the router checks if prerequisites are met. For example, the Log view requires an active game:

```javascript
if (viewName === 'Log') {
    const hasActiveGame = localStorage.getItem('currentGame') !== null;
    if (!hasActiveGame) {
        // Default to EventCapture if no active game
        this._updateHashSilently('event-capture');
        this.showView('EventCapture');
        return;
    }
}
```

### 5. State Update

The router updates the application state through the state service:

```javascript
_showViewWithoutHashUpdate(viewName) {
    stateService.setState('ui.currentView', viewName);
}
```

### 6. View Change Handler

The state change triggers the `_handleViewChange` method, which:

- Hides all views by adding the `hidden` class
- Shows the requested view by removing the `hidden` class
- Updates navigation button styles to highlight the active route
- Updates tab visibility within the view if applicable

```javascript
_handleViewChange = (viewName) => {
    // Hide all views
    Object.values(this.views).forEach(({ view, button }) => {
        view.classList.add('hidden');
        button.classList.remove('text-white', 'hover:text-white');
        button.classList.add('text-gray-400', 'hover:text-white');
    });

    // Show requested view
    const selectedView = this.views[viewName];
    if (selectedView) {
        selectedView.view.classList.remove('hidden');
        selectedView.button.classList.add('text-white', 'hover:text-white');
        selectedView.button.classList.remove('text-gray-400', 'hover:text-white');
    }
};
```

### 7. UI Update Complete

The user now sees the Configure view, with the "Configure" navigation button highlighted, and the URL updated to `index.html#configure`.

## Route Guard Pattern

The router implements a simple "route guard" pattern to prevent access to views that require certain prerequisites:

```javascript
// Example: Log view requires an active game
if (viewName === 'Log') {
    const hasActiveGame = localStorage.getItem('currentGame') !== null;
    if (!hasActiveGame) {
        // Redirect to default view
        this._updateHashSilently('event-capture');
        this.showView('EventCapture');
        return;
    }
}
```

## Cross-Page Navigation

When navigating between separate HTML pages (e.g., from `index.html` to `timeline-video.html`), traditional anchor links are used with hash fragments for direct view targeting:

```html
<!-- In timeline-video.html -->
<a href="index.html#configure" class="text-gray-400 hover:text-white transition-colors font-medium py-1 px-2">Configure</a>
```

This ensures that when users navigate from the Match Review page back to the main application, they land directly on their intended view.

## Best Practices Implemented

The router implementation follows several industry best practices:

1. **History API**: Using `history.replaceState()` to update URLs without causing page refreshes
2. **Decoupled Views**: Views are completely independent of the router
3. **State Management**: Navigation state is managed through the state service
4. **Conditional Routing**: Route guards protect views with prerequisites
5. **Clean URLs**: Hash-based routing provides human-readable URLs

## Future Enhancements

Potential improvements to the navigation system could include:

1. **Route Parameters**: Enhance the router to support parameters in routes (e.g., `#saved-games/123` to load a specific game)
2. **Transition Animations**: Add smooth transitions between views
3. **Nested Routes**: Support for hierarchical routing structures
4. **Query Parameters**: Support for query parameters in addition to hash fragments
