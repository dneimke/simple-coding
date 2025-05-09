# Field Hockey Event Tracker

[![Deploy static content to Pages](https://github.com/dneimke/simple-coding/actions/workflows/static.yml/badge.svg)](https://github.com/dneimke/simple-coding/actions/workflows/static.yml)
[![Test Coverage](https://img.shields.io/badge/coverage-30%25-yellow.svg)](coverage/lcov-report/index.html)
[![JavaScript Style](https://img.shields.io/badge/code_style-ES6%2B-brightgreen.svg)](https://www.ecma-international.org/ecma-262/6.0/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Overview

The **Field Hockey Event Tracker** is a modern web application that empowers coaches, analysts, and sports enthusiasts to record, analyze, and visualize game events in real-time. Built with HTML5, Tailwind CSS, and modern Vanilla JavaScript (ES6+), it offers a responsive and customizable interface for sports performance analysis.

Key features:

- Record timestamped events during live games with minimal friction
- Customize event buttons to match your team's specific tracking needs
- Review event logs in multiple formats (list, timeline, statistics)
- Sync recorded events with video footage for in-depth analysis
- Export data in XML format for compatibility with other analysis tools
- Persist games and configurations with browser local storage
- Works offline with no server dependencies

![Tracker Page](images/coding-tool.png)

## Table of Contents

- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
  - [Testing](#testing)
- [Features](#features)
- [Application Pages](#application-pages)
- [Technical Architecture](#technical-architecture)
- [Contributing](#contributing)
- [Project Documentation](#project-documentation)

## Getting Started

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
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch
```

After running tests with coverage, open `coverage/lcov-report/index.html` in a browser to view the detailed coverage report.

## Features

### Game Timer and Event Recording

- **Real-time Timer**: Start, stop, and reset a game clock to track elapsed match time
- **Event Logging**: Record predefined events with timestamps using customizable buttons
- **Quick Actions**: Ability to undo or modify recent events

### Customizable Configuration

- **Button Editor**: Customize event buttons via an intuitive JSON configuration interface
- **Preset Layouts**: Create and save multiple button configurations for different analysis needs
- **Local Storage**: Configurations persist between sessions in your browser's storage

### Data Management

- **Game Saving**: Automatically save games to prevent data loss
- **Import/Export**: Exchange game data with other analysis tools via XML format
- **Local Storage**: Access previously recorded games from your browser's storage
- **Data Clearing**: Option to start fresh with a new game recording

### Analysis Views

- **List View**: Chronological list of events with timestamps and details
- **Timeline View**: Visual representation of events with video synchronization
- **Statistics View**: Aggregated counts and metrics from recorded events
- **XML View**: Raw data export with copy-to-clipboard functionality

## Application Pages

### Tracker Page

The primary interface for recording live game events:

- **Game Timer**: Controls for starting, pausing, and resetting the game clock
- **Event Buttons**: Customizable buttons for logging different event types
- **Quick Actions**: Undo functionality and game management options
- **Real-time Feedback**: Visual confirmations when events are recorded

![Tracker Page](images/field-hockey-tracker.png)

### Configure Page

Customize the application to match your specific tracking needs:

- **JSON Editor**: Define event button groups, labels, colors, and behaviors
- **Configuration Management**: Save, load, and reset button layouts
- **Preview**: See your changes before applying them to the tracker
- **Persistence**: All configurations are saved to browser local storage

### Log Page

Review, analyze, and export recorded game data:

- **Event List**: Chronological list of all recorded events with timestamps
- **Export Options**: Save or share your data in various formats
- **Game Selection**: Load previous games from local storage
- **Data Management**: Clear logs or start new recordings

The Log Page includes multiple views:

#### Timeline View

Visual representation of game events with video synchronization:

- Markers for each event positioned along a time axis
- Video playback controls synced with event timestamps
- Click navigation to jump to specific events in the footage
- [Timeline View Guide](docs/timeline-view-guide.md) for detailed usage instructions

![Timeline View](images/timeline-view.png)

#### XML View

Raw data export for integration with external analysis tools:

- Structured XML format containing all event data
- Copy-to-clipboard functionality for easy sharing
- Compatible with third-party sports analysis platforms

![XML View](images/xml-view.png)

#### Statistics View

Aggregate metrics and counts of recorded events:

- Total events by category and subcategory
- Visual representation of event distribution
- Quick insights into game patterns and key moments

![Statistics View](images/statistics-view.png)

## Technical Architecture

The Field Hockey Event Tracker is built using modern web technologies with a focus on simplicity, maintainability, and performance:

### Technology Stack

- **HTML5**: Modern semantic markup for structure
- **Tailwind CSS**: Utility-first CSS framework for styling without separate CSS files
- **Vanilla JavaScript (ES6+)**: No frameworks or libraries for core functionality
- **ES Modules**: Component-based architecture with native JavaScript modules
- **Jest**: Testing framework for unit tests

### Code Organization

- `src/` - Main application source code
  - `components/` - Reusable UI components and application modules
  - `services/` - Core services (state, storage, notifications)
  - `utils/` - Utility functions and helpers
  - `assets/` - Static resources like icons and sample data
- `tests/` - Jest test files mirroring the src/ structure
- `docs/` - Project documentation

### Key Design Patterns

- **Module Pattern**: ES6 modules for code organization and encapsulation
- **Service-Based Architecture**: Core functionality abstracted into service modules
- **Event-Driven Communication**: Components communicate via custom events
- **Local Storage Persistence**: Game data and configuration stored in browser

## Contributing

Contributions to improve the Field Hockey Event Tracker are welcome! Here's how to get started:

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests to ensure everything works (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Standards

- Follow ES6+ JavaScript conventions
- Use semantic HTML5 elements where appropriate
- Prefer Tailwind utility classes for styling
- Write tests for new functionality
- Maintain or improve current test coverage (aim for >30%)
- Document complex functions and components

### Adding New Features

When adding new features, consider:

- Compatibility with existing code structure
- Performance implications, especially for mobile devices
- Maintainability and testability
- User experience for coaches and analysts

## Project Documentation

Additional documentation is available in the `docs/` directory:

- [Timeline View Guide](docs/timeline-view-guide.md) - Instructions for using the timeline with video synchronization
- [Event Model Standardization](docs/event-model-standardization.md) - Standards for event data structure
- [Import Data Guide](docs/import-data.md) - How to import external game data
- [State Management](docs/state-management.md) - Overview of the application state architecture
- [Unit Testing](docs/unit-testing.md) - Testing approach and guidelines
- [User Experience](docs/user-experience.md) - UX design principles for the application
- [Refactoring Plan](docs/refactoring-plan.md) - Ongoing improvements and technical debt
- [UI Components](docs/ui-components-refactoring.md) - Component architecture documentation

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Developed for field hockey coaches and analysts
- Inspired by the needs of sports performance analysis
- Thanks to all contributors and testers who have provided valuable feedback
