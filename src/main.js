import { EventButtons, EventLog, GameState, Router } from './components/index.js';
import { notificationService } from './services/notificationService.js';
import { updateNavbarVisibility, showElement, hideElement } from './utils/domUtils.js';
import { logger } from './utils/formatUtils.js';
import { createGameCard, saveGameToLocalStorage, loadSavedGames, deleteSavedGame, updateSavedGame } from './utils/gameUtils.js';
import { validateXmlStructure, parseXmlToEvents, copyXmlToClipboard } from './utils/xmlUtils.js';
import { showPreview } from './utils/importUtils.js';
import { showMessage } from './utils/utils.js'; // Legacy function still in utils.js
import { loadConfiguration, saveConfiguration, resetConfiguration } from './components/config.js';

const LOCAL_STORAGE_KEY_GAMES = 'fieldHockeyGames_v1';

// DOM Elements
const timerDisplay = document.getElementById('timer');
const newGameButton = document.getElementById('newGameButton');
const pauseResumeButton = document.getElementById('pauseResumeButton');
const completeGameButton = document.getElementById('completeGameButton');
const tabNavContainer = document.querySelector('#log-view nav');
const navContainer = document.querySelector('nav');
const codingButtonsContainer = document.getElementById('coding-buttons-container');
const configJsonInput = document.getElementById('configJsonInput');
const saveConfigButton = document.getElementById('saveConfigButton');
const loadDefaultConfigButton = document.getElementById('loadDefaultConfigButton');
const configMessage = document.getElementById('configMessage');
const importXmlButton = document.getElementById('importXmlButton');
const xmlFileInput = document.getElementById('xmlFileInput');
const previewModal = document.getElementById('previewModal');
const previewContainer = document.getElementById('previewContainer');
const tabButtonTimeline = document.getElementById('tabButtonTimeline');
const tabButtonXml = document.getElementById('tabButtonXml');
const tabButtonStatistics = document.getElementById('tabButtonStatistics');
const timelineViewPanel = document.getElementById('timelineView');
const xmlViewPanel = document.getElementById('xmlView');
const statisticsViewPanel = document.getElementById('statisticsView');
const xmlOutputContainer = xmlViewPanel.querySelector('.xml-output');
const copyXmlButton = document.getElementById('copyXmlButton');

// Navigation Elements
const navTracker = document.getElementById('navTracker');
const navConfig = document.getElementById('navConfig');
const navLog = document.getElementById('navLog');
const navStats = document.getElementById('navStats');
const navSavedGames = document.getElementById('navSavedGames');

// View Elements
const trackerView = document.getElementById('tracker-view');
const configView = document.getElementById('config-view');
const logView = document.getElementById('log-view');
const statsView = document.getElementById('stats-view');
const savedGamesView = document.getElementById('saved-games-view');

function renderSavedGames() {
    const savedGamesList = document.getElementById('savedGamesList');
    savedGamesList.innerHTML = '';

    try {
        const savedGames = loadSavedGames(LOCAL_STORAGE_KEY_GAMES);

        if (savedGames.length > 0) {
            savedGames.forEach((game, index) => {
                const gameCard = createGameCard({
                    game,
                    index,
                    onLoad: () => {
                        if (gameState.isActive || gameState.isRunning) {
                            const userConfirmed = notificationService.confirm(
                                'A game is currently in progress. Do you want to stop it and load the saved game?'
                            );
                            if (!userConfirmed) return; // Exit if the user cancels
                        }

                        gameState.setGameState({
                            loggedEvents: game.events,
                            elapsedTime: game.elapsedTime,
                            hasCurrentGame: true,
                            isActive: false,
                        });

                        showElement(newGameButton);
                        hideElement(pauseResumeButton);
                        hideElement(completeGameButton);
                        updateNavbarVisibility(gameState.hasCurrentGame);

                        router.showView('Log');
                        // Use the team name if available when reporting successful load
                        const gameName = game.teams || `Game ${index + 1}`;
                        logger.log(`Game "${gameName}" loaded successfully.`);
                    },
                    onRename: () => {
                        // Get the current name or use a placeholder
                        const currentName = game.teams || `Game ${index + 1}`;
                        // Prompt the user for a new name
                        const newName = notificationService.prompt('Enter a new name for this game:', currentName);

                        // If the user didn't cancel and provided a non-empty name
                        if (newName !== null && newName.trim() !== '') {
                            // Update the game with the new name
                            const success = updateSavedGame(index, { teams: newName.trim() }, LOCAL_STORAGE_KEY_GAMES);

                            if (success) {
                                // Refresh the saved games list
                                renderSavedGames(); logger.log(`Game renamed to "${newName}" successfully.`);
                            } else {
                                notificationService.notify('Failed to rename the game. Please try again.', 'error');
                            }
                        }
                    }, onDelete: () => {
                        if (notificationService.confirm('Are you sure you want to delete this saved game?')) {
                            deleteSavedGame(index, LOCAL_STORAGE_KEY_GAMES);
                            renderSavedGames();
                        }
                    },
                });

                savedGamesList.appendChild(gameCard);
            });
        } else {
            savedGamesList.innerHTML = '<p class="text-gray-500 text-center">No saved games available.</p>';
        }
    } catch (error) {
        logger.error('Error loading games from localStorage:', error);
        savedGamesList.innerHTML = '<p class="text-red-500 text-center">Failed to load saved games.</p>';
    }
}

function initializeApplication() {
    registerEventListeners();

    const currentConfig = loadConfiguration();

    eventButtons.initialize(currentConfig);
    router.showView('Tracker');
    updateNavbarVisibility(gameState.hasCurrentGame);
}

function registerEventListeners() {
    // Tab navigation
    tabNavContainer.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (!button) return; // Ignore clicks on unrelated elements

        const tab = button.dataset.tab;
        router.switchTab(tab);
    });

    // Navigation container
    navContainer.addEventListener('click', (event) => {
        const { id } = event.target;
        const viewName = id.startsWith('nav') ? id.slice(3) : id;

        router.showView(viewName, () => {
            if (viewName === 'SavedGames') {
                renderSavedGames();
            } else if (viewName === 'Config') {
                const currentConfig = loadConfiguration();
                configJsonInput.value = JSON.stringify(currentConfig, null, 2);
            }
        });

        copyXmlButton.disabled = gameState.loggedEvents.length === 0;
    });

    // Coding buttons container
    codingButtonsContainer.addEventListener('click', (event) => {
        const button = event.target.closest('.event-button[data-event]');
        if (!button) return; // Ignore clicks on unrelated elements

        const eventName = button.dataset.event;
        const currentElapsedTimeMs = gameState.isRunning
            ? gameState.elapsedTime + (Date.now() - gameState.startTime)
            : gameState.elapsedTime;

        gameState.addEvent({ event: eventName, timeMs: currentElapsedTimeMs });
    });

    // Tracker view buttons
    trackerView.addEventListener('click', (event) => {
        const { id } = event.target;

        switch (id) {
            case 'newGameButton':
                gameState.newGame();
                hideElement(newGameButton);
                showElement(pauseResumeButton);
                showElement(completeGameButton);
                updateNavbarVisibility(gameState.hasCurrentGame);
                break;
            case 'pauseResumeButton':
                gameState.pauseResume();
                pauseResumeButton.textContent = gameState.isRunning ? 'Pause' : 'Resume';
                break;
            case 'completeGameButton': const userConfirmed = notificationService.confirm(
                'Are you sure you want to complete the game? This will reset all progress.'
            );

                if (userConfirmed) {
                    const { loggedEvents: events, elapsedTime } = gameState;
                    const timestamp = new Date().toISOString();                    // Ask for teams information
                    const teamsName = notificationService.prompt('Enter teams for this game (e.g., "Team A vs Team B"):', '');

                    const gameSnapshot = {
                        events,
                        elapsedTime,
                        timestamp,
                        teams: teamsName ? teamsName.trim() : null
                    };
                    saveGameToLocalStorage(gameSnapshot, LOCAL_STORAGE_KEY_GAMES);

                    gameState.completeGame();
                    showElement(newGameButton);
                    hideElement(pauseResumeButton);
                    hideElement(completeGameButton);
                    updateNavbarVisibility(gameState.hasCurrentGame);
                }
                break;
            default:
                break;
        }
    });

    // Copy XML button
    copyXmlButton.addEventListener('click', () => {
        const xmlContent = xmlOutputContainer.textContent;
        copyXmlToClipboard(xmlContent);
    });

    // Save configuration button
    saveConfigButton.addEventListener('click', () => {
        try {
            const jsonString = configJsonInput.value;
            const parsedConfig = JSON.parse(jsonString);

            if (parsedConfig && Array.isArray(parsedConfig.rowDefs)) {
                const isSaved = saveConfiguration(parsedConfig);

                if (isSaved) {
                    showMessage(configMessage, "Configuration saved successfully!", false);
                    eventButtons.initialize(parsedConfig);
                } else {
                    showMessage(configMessage, "Failed to save configuration.", true);
                }
            } else {
                throw new Error("Invalid configuration structure.");
            }
        } catch (error) {
            logger.error("Invalid JSON:", error);
            showMessage(configMessage, `Error parsing JSON: ${error.message}`, true);
        }
    });

    // Load default configuration button
    loadDefaultConfigButton.addEventListener('click', () => {
        const defaultConfig = resetConfiguration();
        configJsonInput.value = JSON.stringify(defaultConfig, null, 2);
        showMessage(configMessage, "Default configuration loaded into editor. Click 'Save Configuration' to apply.", false);
    });

    // Import XML button
    importXmlButton.addEventListener('click', () => {
        xmlFileInput.click();
    });

    // XML file input change event
    xmlFileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                const xmlContent = await file.text();
                validateXmlStructure(xmlContent);
                const events = parseXmlToEvents(xmlContent);

                showPreview(previewContainer, events, LOCAL_STORAGE_KEY_GAMES, (e) => {
                    if (e.importedFileCount > 0) {
                        renderSavedGames();
                    }
                });

                previewModal.classList.remove('hidden');
            } catch (error) {
                console.error('Error importing XML:', error);
                notificationService.notify(`Failed to import XML: ${error.message}`, 'error');
            } finally {
                xmlFileInput.value = '';
            }
        }
    });
}

const router = new Router(
    {
        Tracker: { view: trackerView, button: navTracker },
        Config: { view: configView, button: navConfig },
        Log: { view: logView, button: navLog },
        SavedGames: { view: savedGamesView, button: navSavedGames }
    },
    {
        timeline: tabButtonTimeline,
        xml: tabButtonXml,
        statistics: tabButtonStatistics,
        timelineView: timelineViewPanel,
        xmlView: xmlViewPanel,
        statisticsView: statisticsViewPanel
    }
);

const eventLog = new EventLog(timelineViewPanel, xmlOutputContainer, statisticsViewPanel);
const eventButtons = new EventButtons(codingButtonsContainer);
const gameState = new GameState(timerDisplay, eventLog, eventButtons);

initializeApplication();
