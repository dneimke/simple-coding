import { EventButtons, EventLog, GameState, Router } from './components/index.js';
import {
    createGameCard,
    copyXmlToClipboard,
    updateNavbarVisibility,
    logger,
    showElement,
    hideElement,
    showMessage,
    saveGameToLocalStorage,
    loadSavedGames,
    deleteSavedGame,
    loadConfig,
    saveConfig,
    validateXmlStructure,
    parseXmlToEvents,
    showPreview
} from './utils/utils.js';

// --- Constants & Config ---
const LOCAL_STORAGE_KEY_GAMES = 'fieldHockeyGames_v1';
const LOCAL_STORAGE_KEY_CONFIG = 'fieldHockeyConfig_v1';
const DEFAULT_CONFIG = {
    rowDefs: [
        { gridCols: "grid-cols-2", buttons: [{ event: "OUTLET", text: "OUTLET", color: "btn-blue" }, { event: "PRESS", text: "PRESS", color: "btn-blue" }] },
        { gridCols: "grid-cols-4", buttons: [{ event: "DEF 25 ENTRY", text: "DEF 25 ENTRY", color: "btn-red" }, { event: "DEF CIRC ENTRY", text: "DEF CIRC ENTRY", color: "btn-red" }, { event: "SHOT AG", text: "SHOT AG", color: "btn-red" }, { event: "GOAL AG", text: "GOAL AG", color: "btn-red" }] },
        { gridCols: "grid-cols-4", buttons: [{ event: "ATT 25 ENTRY", text: "ATT 25 ENTRY", color: "btn-green" }, { event: "ATT CIRC ENTRY", text: "ATT CIRC ENTRY", color: "btn-green" }, { event: "SHOT FOR", text: "SHOT FOR", color: "btn-green" }, { event: "GOAL FOR", text: "GOAL FOR", color: "btn-green" }] },
        { gridCols: "grid-cols-4", buttons: [{ event: "APC", text: "APC", color: "btn-blue" }, { event: "DPC", text: "DPC", color: "btn-blue" }, { event: "STROKE", text: "STROKE", color: "btn-blue" }, { event: "1V1", text: "1V1", color: "btn-blue" }] },
        { gridCols: "grid-cols-5", buttons: [{ event: "3 PASS", text: "3 PASS", color: "btn-yellow" }, { event: "TACKLE", text: "TACKLE", color: "btn-yellow" }, { event: "DEF", text: "DEF", color: "btn-yellow" }, { event: "MF", text: "MF", color: "btn-yellow" }, { event: "ATT", text: "ATT", color: "btn-yellow" }] },
        { gridCols: "grid-cols-4", buttons: [{ event: "OVERHEAD FOR", text: "OVERHEAD FOR", color: "btn-blue" }, { event: "OVERHEAD AG", text: "OVERHEAD AG", color: "btn-blue" }, { event: "CIRC-DEF", text: "CIRC-DEF", color: "btn-blue" }, { event: "CLOSE-BASE", text: "CLOSE-BASE", color: "btn-blue" }] },
        { gridCols: "grid-cols-4", buttons: [{ event: "P1", text: "P1", color: "btn-blue" }, { event: "P2", text: "P2", color: "btn-blue" }, { event: "P3", text: "P3", color: "btn-blue" }, { event: "P4", text: "P4", color: "btn-blue" }] },
        { gridCols: "grid-cols-3", buttons: [{ event: "CARD", text: "CARD", color: "btn-green" }, { event: "INJURY", text: "INJURY", color: "btn-green" }, { event: "WHISTLE", text: "WHISTLE", color: "btn-green" }] }
    ]
};

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
                            const userConfirmed = confirm(
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
                        logger.log(`Game ${index + 1} loaded successfully.`);
                    },
                    onDelete: () => {
                        if (confirm('Are you sure you want to delete this saved game?')) {
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

    const currentConfig = loadConfig(LOCAL_STORAGE_KEY_CONFIG, DEFAULT_CONFIG);

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
            case 'completeGameButton':
                const userConfirmed = confirm(
                    'Are you sure you want to complete the game? This will reset all progress.'
                );

                if (userConfirmed) {
                    const { loggedEvents: events, elapsedTime } = gameState;
                    const timestamp = new Date().toISOString();

                    const gameSnapshot = { events, elapsedTime, timestamp };
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
                const isSaved = saveConfig(parsedConfig, LOCAL_STORAGE_KEY_CONFIG);

                if (isSaved) {
                    showMessage(configMessage, "Configuration saved successfully!", false);
                    eventButtons.initialize(parsedConfig);
                } else {
                    showMessage(configMessage, "Failed to save configuration.", true);
                }
            } else {
                logger.error(configMessage, "Invalid configuration structure. Loading default configuration.");
                configJsonInput.value = JSON.stringify(DEFAULT_CONFIG, null, 2);
                showMessage(configMessage, "Default configuration loaded into editor. Click 'Save Configuration' to apply.", false);
            }
        } catch (error) {
            logger.error("Invalid JSON:", error);
            showMessage(configMessage, `Error parsing JSON: ${error.message}`, true);
        }
    });

    // Load default configuration button
    loadDefaultConfigButton.addEventListener('click', () => {
        configJsonInput.value = JSON.stringify(DEFAULT_CONFIG, null, 2);
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
                const xmlDoc = validateXmlStructure(xmlContent);
                const events = parseXmlToEvents(xmlContent);

                showPreview(previewContainer, events, LOCAL_STORAGE_KEY_GAMES, (e) => {
                    if (e.importedFileCount > 0) {
                        renderSavedGames();
                    }
                });

                previewModal.classList.remove('hidden');
            } catch (error) {
                console.error('Error importing XML:', error);
                alert(`Failed to import XML: ${error.message}`);
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
