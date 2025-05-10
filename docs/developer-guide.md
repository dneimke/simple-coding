# Developer Guide

## Developer Getting Started

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/dneimke/simple-coding.git
   cd coding-tool
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

### Running Locally

You can run the application using any of these methods:

1. **VS Code Live Server (Recommended)**:
   - Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for VS Code
   - Right-click on `src/index.html` and select "Open with Live Server"
   - The application will open in your default browser

2. **Any HTTP Server**:
   - If you have Python installed:

     ```bash
     # Python 3.x
     python -m http.server --directory src 8080
     ```

   - Then open `http://localhost:8080` in your browser

3. **NPM http-server package**:

   ```bash
   npm install -g http-server
   http-server src
   ```

The application runs entirely in the browser with no backend dependencies.

### Testing

The project uses Jest for testing:

```bash
# Run tests once
npm test

# Run tests with coverage report
npm test:coverage

# Run tests in watch mode during development
npm run test:watch
```

After running tests with coverage, open `coverage/lcov-report/index.html` in a browser to view the detailed coverage report.

## Project Structure

### Key Directories and Files

- `src/` - Application source code
  - `index.html` - Main HTML entry point
  - `main.js` - Main JavaScript entry point
  - `components/` - UI components and reusable elements
  - `services/` - Business logic services (state management, storage, etc.)
  - `utils/` - Helper functions and utilities
  - `assets/` - Static assets like icons, sample data, etc.

- `tests/` - Jest test files mirroring the structure of `src/`
- `docs/` - Project documentation
- `coverage/` - Test coverage reports (generated when running tests with coverage)

### Architecture Overview

The application follows a modular ES6 architecture with:

1. **Component-Based Structure**: UI elements are organized into reusable components
2. **Service Layer**: Handles business logic, data management, state, and storage
3. **Utility Modules**: Provide helper functions for common operations
4. **Event-Based Communication**: Components communicate through the notification service

## Development Workflow

### Making Changes

1. **Creating New Components**:
   - Create a new file in the appropriate directory under `src/components/`
   - Export your component using ES6 modules
   - Import and use the component where needed

2. **Adding New Features**:
   - Create or modify relevant components, services, or utilities
   - Update the main application logic in `main.js` if necessary
   - Add tests for new functionality

### Testing Guidelines

1. **Writing Tests**:
   - All tests are located in the `tests/` directory
   - Tests should mirror the structure of the `src/` directory
   - Each module should have a corresponding `.test.js` file

2. **Test Coverage**:
   - Aim for at least 30% code coverage (minimum threshold set in Jest config)
   - Focus on testing core functionality and business logic

### Code Style

- The project uses modern ES6+ JavaScript features
- No external frameworks are used (Vanilla JS only with Tailwind CSS for styling)
- Code should be clean, modular, and well-documented

## Technical Details

### Storage

- The application uses `localStorage` for persisting games and configuration
- The storage key structure follows a versioned approach (e.g., `fieldHockeyGames_v1`)

### DOM Manipulation

- Direct DOM manipulation is performed using the standard Web APIs
- Helper functions in `utils/domUtils.js` provide common DOM operations

### Testing Environment

- Jest with jsdom for frontend testing
- Babel for transpilation during tests
- Coverage thresholds are set to 30% for statements, branches, functions, and lines

## Common Tasks

### Adding a New Event Type

1. Update the configuration schema in `components/config.js`
2. Add any necessary helper functions in relevant utils
3. Update tests to cover the new event type

### Modifying the UI

1. Locate the relevant component in `src/components/`
2. Update the markup and associated JavaScript
3. Use Tailwind CSS classes for styling
4. Test the changes both visually and with unit tests

## Additional Resources

- Check the `README.md` for an overview of the application
- See `docs/user-workflow.md` for understanding the user experience flow
- Explore `docs/match-review.md` and `docs/saved-games.md` for feature-specific documentation
