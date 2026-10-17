import { EventButtons, EventLog, GameState, Router } from './components/index.js';
import { notificationService } from './services/notificationService.js';
import { stateService } from './services/stateService.js';
import { updateNavbarVisibility, showElement, hideElement } from './utils/domUtils.js';
import { logger, formatTime } from './utils/formatUtils.js';
import { validateXmlStructure, parseXmlToEvents, copyXmlToClipboard } from './utils/xmlUtils.js';
import { showPreview } from './utils/importUtils.js';
import { showMessage } from './utils/utils.js'; // Legacy function still in utils.js
import { loadConfiguration, listNamedConfigs, getNamedConfig, saveNamedConfig, findNamedConfigName } from './components/config.js';
import { createGameCard, createButton, createInput, createSelect } from './components/ui/index.js';
import { gameStorageManager } from './services/gameStorageManager.js';
import { checkStorageQuota } from './utils/storageWarningUtils.js';
import { draftService, finishCapture } from './services/draftService.js';

const LOCAL_STORAGE_KEY_GAMES = 'fieldHockeyGames_v1';

// DOM Elements
const timerDisplay = document.getElementById('timer');
const newGameButton = document.getElementById('newGameButton');
const pauseResumeButton = document.getElementById('pauseResumeButton');
const completeGameButton = document.getElementById('completeGameButton');
const discardGameButton = document.getElementById('discardGameButton');
const tabNavContainer = document.querySelector('#log-view nav');
const navContainer = document.querySelector('nav');
const codingButtonsContainer = document.getElementById('coding-buttons-container');
const configJsonInput = document.getElementById('configJsonInput');
const configDirtyIndicator = document.getElementById('configDirtyIndicator');
const saveConfigButton = document.getElementById('saveConfigButton');
const savedConfigSelect = document.getElementById('savedConfigSelect');
const saveAsConfigButton = document.getElementById('saveAsConfigButton');
const saveAsConfigForm = document.getElementById('saveAsConfigForm');
const configNameInput = document.getElementById('configNameInput');
const confirmSaveAsConfigButton = document.getElementById('confirmSaveAsConfigButton');
const cancelSaveAsConfigButton = document.getElementById('cancelSaveAsConfigButton');
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
const savedGameLogBanner = document.getElementById('savedGameLogBanner');
const savedGameLogTitle = document.getElementById('savedGameLogTitle');
const backToSavedGamesButton = document.getElementById('backToSavedGamesButton');

// Mobile Navigation Elements
const mobileMenuButton = document.getElementById('mobileMenuButton');
const mainMenu = document.getElementById('mainMenu');
const navEventCaptureMobile = document.getElementById('navEventCaptureMobile');

// Navigation Elements
const navEventCapture = document.getElementById('navEventCapture');
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
        logger.log('Loading saved games from localStorage...');
        const savedGames = gameStorageManager.ensureGameIds();
        checkStorageQuota(80);

        // Add export all button if there are games
        const exportAllButton = document.getElementById('exportAllGamesButton');
        if (!exportAllButton && savedGames.length > 0) {
            createExportButton();
        }

        if (savedGames.length > 0) {
            savedGames.forEach((game, index) => {
                const gameCard = createGameCard({
                    game,
                    index,
                    onSelect: () => {
                        window.location.href = `timeline-video.html?game=${encodeURIComponent(game.id)}`;
                    },
                    onViewLog: () => {
                        window.location.hash = `log/${encodeURIComponent(game.id)}`;
                    },
                    onRename: () => {
                        // Get the current name or use a placeholder
                        const currentName = game.teams || `Game ${index + 1}`;
                        // Prompt the user for a new name
                        const newName = notificationService.prompt('Enter a new name for this game:', currentName);

                        // If the user didn't cancel and provided a non-empty name
                        if (newName !== null && newName.trim() !== '') {
                            // Update the game with the new name using gameStorageManager
                            const result = gameStorageManager.updateGame(index, { teams: newName.trim() });

                            if (result === true) {
                                // Refresh the saved games list
                                renderSavedGames();
                                logger.log(`Game renamed to "${newName}" successfully.`);
                            } else {
                                const errorMessage = result.message || 'Unknown error';
                                notificationService.notify(`Failed to rename the game: ${errorMessage}`, 'error');
                            }
                        }
                    },
                    onDelete: () => {
                        if (notificationService.confirm('Are you sure you want to delete this saved game?')) {
                            // Use gameStorageManager to remove game
                            gameStorageManager.removeGame(index);
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

/**
 * Creates and adds the Export All Games button to the saved games view
 */
function createExportButton() {
    const savedGamesView = document.getElementById('saved-games-view');
    const importButton = document.getElementById('importXmlButton');

    if (savedGamesView && importButton) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'inline-block';

        importButton.parentNode.insertBefore(buttonContainer, importButton.nextSibling);
    }
}

/**
 * Renders the Log view for either a saved game (when ui.logGameId is set) or the live game.
 * Viewing a saved game never touches the live game state.
 */
function renderLogView() {
    const savedGameId = stateService.getState('ui.logGameId');
    let events;

    if (savedGameId) {
        const game = gameStorageManager.getGameById(savedGameId);
        if (!game) {
            notificationService.notify('That saved game could not be found.', 'error');
            router.showView('SavedGames', renderSavedGames);
            return;
        }
        events = game.events || [];
        savedGameLogTitle.textContent = game.teams || 'Game';
        savedGameLogBanner.classList.remove('hidden');
    } else {
        events = stateService.getState('game.loggedEvents') || [];
        savedGameLogBanner.classList.add('hidden');
    }

    eventLog.render(events);
    copyXmlButton.disabled = events.length === 0;
}

// An empty select value stands for the active layout when it matches no saved name
const UNSAVED_CONFIG_VALUE = '';
let configEditorBaseline = '';
let selectedConfigName = UNSAVED_CONFIG_VALUE;

function renderSavedConfigOptions(selectedName, includeUnsaved = false) {
    const names = listNamedConfigs();
    savedConfigSelect.innerHTML = '';
    if (includeUnsaved) {
        const option = document.createElement('option');
        option.value = UNSAVED_CONFIG_VALUE;
        option.textContent = 'Unsaved layout';
        savedConfigSelect.appendChild(option);
    }
    names.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        savedConfigSelect.appendChild(option);
    });
    if (includeUnsaved || names.includes(selectedName)) {
        savedConfigSelect.value = selectedName;
    }
    selectedConfigName = savedConfigSelect.value;
}

function isEditorDirty() {
    return configJsonInput.value !== configEditorBaseline;
}

function updateDirtyIndicator() {
    configDirtyIndicator.classList.toggle('hidden', !isEditorDirty());
}

function setEditorConfig(config) {
    configJsonInput.value = JSON.stringify(config, null, 2);
    configEditorBaseline = configJsonInput.value;
    updateDirtyIndicator();
}

function hideSaveAsForm() {
    saveAsConfigForm.classList.add('hidden');
    saveConfigButton.classList.remove('hidden');
    saveAsConfigButton.classList.remove('hidden');
    configNameInput.value = '';
}

function showConfigView() {
    const activeConfig = loadConfiguration();
    const activeName = findNamedConfigName(activeConfig);
    renderSavedConfigOptions(activeName ?? UNSAVED_CONFIG_VALUE, !activeName);
    setEditorConfig(activeConfig);
    hideSaveAsForm();
}

function applySavedConfig(name, config) {
    if (!saveNamedConfig(name, config)) {
        throw new Error("Failed to save configuration.");
    }
    renderSavedConfigOptions(name);
    configEditorBaseline = configJsonInput.value;
    updateDirtyIndicator();
    eventButtons.initialize(config);
}

function parseEditorConfig() {
    const parsedConfig = JSON.parse(configJsonInput.value);
    if (!parsedConfig || !Array.isArray(parsedConfig.rowDefs)) {
        throw new Error("Invalid configuration structure.");
    }
    return parsedConfig;
}

function initializeApplication() {
    // Load configuration
    const currentConfig = loadConfiguration();

    // Initialize event buttons from the active configuration
    if (currentConfig) {
        eventButtons.setConfig(currentConfig);
    }

    // Check URL parameters for view navigation
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');

    // Handle navigation based on URL parameters
    if (viewParam === 'config') {
        stateService.setState('ui.currentView', 'Config');
    } else if (viewParam === 'saved-games') {
        stateService.setState('ui.currentView', 'SavedGames');
        renderSavedGames();
    } else {
        // Default to event capture view if no parameter or invalid parameter
        stateService.setState('ui.currentView', 'EventCapture');
    }

    registerEventListeners();
    eventButtons.initialize(currentConfig);
    showConfigView();
    restoreCaptureDraft();

    const hasCurrentGame = stateService.getState('game.hasCurrentGame');
    updateNavbarVisibility(hasCurrentGame);
}

function saveCaptureDraft() {
    draftService.saveDraft(gameState.getDraftSnapshot());
}

function describeCapture() {
    const count = (stateService.getState('game.loggedEvents') || []).length;
    const clock = formatTime(gameState.getLiveElapsedTime());
    return `${count} event${count === 1 ? '' : 's'}, clock at ${clock}`;
}

function updatePauseResumeLabel() {
    pauseResumeButton.textContent = stateService.getState('game.isRunning') ? 'Pause' : 'Resume';
}

function showCaptureControls() {
    hideElement(newGameButton);
    showElement(pauseResumeButton);
    showElement(completeGameButton);
    showElement(discardGameButton);
    updatePauseResumeLabel();
    updateNavbarVisibility(true);
}

function showStartControls() {
    showElement(newGameButton);
    hideElement(pauseResumeButton);
    hideElement(completeGameButton);
    hideElement(discardGameButton);
    pauseResumeButton.textContent = 'Pause';
    updateNavbarVisibility(false);
}

function restoreCaptureDraft() {
    const draft = draftService.loadDraft();
    if (!draft) return;

    gameState.restoreSession(draft);
    showCaptureControls();
    notificationService.notify(`Restored capture in progress: ${describeCapture()}`, 'success', 6000);
}

function completeCapture() {
    const elapsedTime = gameState.getLiveElapsedTime();
    const userConfirmed = notificationService.confirm(
        'Are you sure you want to complete the game? It will be saved to Saved Games and the capture will reset.'
    );
    if (!userConfirmed) return;

    const teamsName = notificationService.prompt('Enter teams for this game (e.g., "Team A vs Team B"):', '');
    const result = finishCapture({
        events: stateService.getState('game.loggedEvents'),
        elapsedTime,
        timestamp: new Date().toISOString(),
        teams: teamsName ? teamsName.trim() : null
    }, gameStorageManager);

    if (!result.success) {
        notificationService.notify(
            `Failed to save game: ${result.message}. Your capture is still here; try Complete again.`,
            'error',
            8000
        );
        return;
    }

    checkStorageQuota();
    gameState.completeGame();
    showStartControls();
}

function discardCapture() {
    const userConfirmed = notificationService.confirm(
        `Discard ${describeCapture()}? This cannot be undone.`
    );
    if (!userConfirmed) return;

    gameState.completeGame();
    draftService.clearDraft();
    showStartControls();
}

function registerEventListeners() {

    tabNavContainer.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (!button) return; // Ignore clicks on unrelated elements

        const tab = button.dataset.tab;
        router.switchTab(tab);
    });

    navContainer.addEventListener('click', (event) => {
        // Find the closest ancestor with an id starting with 'nav'
        const navButton = event.target.closest('[id^="nav"]');
        if (!navButton) {
            return;
        }

        // Extract the view name from the button ID
        const viewName = navButton.id.slice(3);

        // Use the router to navigate, which will now update the hash
        router.showView(viewName, () => {
            if (viewName === 'SavedGames') {
                renderSavedGames();
            } else if (viewName === 'Config') {
                showConfigView();
            }
        });
    });

    backToSavedGamesButton.addEventListener('click', () => {
        router.showView('SavedGames', renderSavedGames);
    });


    codingButtonsContainer.addEventListener('click', (event) => {
        const button = event.target.closest('.event-button[data-event]');
        if (!button) return; // Ignore clicks on unrelated elements

        const eventName = button.dataset.event;
        if (gameState.addEvent({ event: eventName, timeMs: gameState.getLiveElapsedTime() })) {
            saveCaptureDraft();
        }
    });

    trackerView.addEventListener('click', (event) => {
        const { id } = event.target;

        switch (id) {
            case 'newGameButton':
                gameState.newGame();
                saveCaptureDraft();
                showCaptureControls();
                break;
            case 'pauseResumeButton':
                gameState.pauseResume();
                saveCaptureDraft();
                updatePauseResumeLabel();
                break;
            case 'completeGameButton':
                completeCapture();
                break;
            case 'discardGameButton':
                discardCapture();
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

    savedConfigSelect.addEventListener('change', () => {
        const name = savedConfigSelect.value;
        if (isEditorDirty() &&
            !notificationService.confirm('Discard your unsaved changes to the configuration JSON?')) {
            savedConfigSelect.value = selectedConfigName;
            return;
        }
        const config = name === UNSAVED_CONFIG_VALUE ? loadConfiguration() : getNamedConfig(name);
        if (!config) {
            savedConfigSelect.value = selectedConfigName;
            showMessage(configMessage, `No saved configuration named "${name}".`, true);
            return;
        }
        selectedConfigName = name;
        setEditorConfig(config);
        hideSaveAsForm();
    });

    configJsonInput.addEventListener('input', updateDirtyIndicator);

    configJsonInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }
        event.preventDefault();
        if (!document.execCommand('insertText', false, '  ')) {
            configJsonInput.setRangeText('  ', configJsonInput.selectionStart, configJsonInput.selectionEnd, 'end');
            updateDirtyIndicator();
        }
    });

    saveConfigButton.addEventListener('click', () => {
        const name = savedConfigSelect.value;
        try {
            if (name === UNSAVED_CONFIG_VALUE) {
                throw new Error("This layout has no name yet. Use Save as to name it.");
            }
            applySavedConfig(name, parseEditorConfig());
            showMessage(configMessage, `Configuration "${name}" saved and set as active.`, false);
        } catch (error) {
            logger.error("Failed to save configuration:", error);
            showMessage(configMessage, error.message, true);
        }
    });

    saveAsConfigButton.addEventListener('click', () => {
        saveConfigButton.classList.add('hidden');
        saveAsConfigButton.classList.add('hidden');
        saveAsConfigForm.classList.remove('hidden');
        configNameInput.value = '';
        configNameInput.focus();
    });

    cancelSaveAsConfigButton.addEventListener('click', hideSaveAsForm);

    const saveAsNewName = () => {
        const name = configNameInput.value.trim();
        try {
            if (!name) {
                throw new Error("Enter a name for this configuration.");
            }
            const parsedConfig = parseEditorConfig();
            if (listNamedConfigs().includes(name) &&
                !notificationService.confirm(`A configuration named "${name}" already exists. Overwrite it?`)) {
                return;
            }
            applySavedConfig(name, parsedConfig);
            hideSaveAsForm();
            showMessage(configMessage, `Configuration "${name}" saved and set as active.`, false);
        } catch (error) {
            logger.error("Failed to save named configuration:", error);
            showMessage(configMessage, error.message, true);
        }
    };

    confirmSaveAsConfigButton.addEventListener('click', saveAsNewName);
    configNameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            saveAsNewName();
        } else if (event.key === 'Escape') {
            hideSaveAsForm();
        }
    });

    importXmlButton.addEventListener('click', () => {
        xmlFileInput.click();
    });

    xmlFileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                const xmlContent = await file.text();
                validateXmlStructure(xmlContent);
                const events = parseXmlToEvents(xmlContent);
                if (!events.teamsAttribute) {
                    events.teamsAttribute = file.name.replace(/\.xml$/i, '').replace(/[-_]+/g, ' ').trim() || null;
                }

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
        EventCapture: { view: trackerView, button: navEventCapture },
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

stateService.subscribe('ui.currentView', (viewName) => {
    if (viewName === 'Log') {
        renderLogView();
    }
});

// Initial navigation based on URL hash or defaults to EventCapture
document.addEventListener('DOMContentLoaded', () => {
    // The Router class now handles initial hash-based navigation
    // So we don't need to manually set the view here

    // Check if we need to load content for specific views
    const hash = window.location.hash.substring(1);
    if (hash === 'saved-games') {
        renderSavedGames();
    } else if (hash === 'configure') {
        showConfigView();
    }

    // Initialize mobile menu functionality
    initMobileMenu();
});

/**
 * Initialize the mobile menu toggle and its behavior
 */
function initMobileMenu() {
    // Mobile menu toggle with animation
    mobileMenuButton.addEventListener('click', () => {
        const isOpen = !mainMenu.classList.contains('hidden');

        if (isOpen) {
            // Close menu with smooth transition
            mainMenu.classList.add('opacity-0');
            setTimeout(() => {
                mainMenu.classList.add('hidden');
                mainMenu.classList.remove('opacity-0');
            }, 200);
            mobileMenuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
        } else {
            // Open menu with smooth transition
            mainMenu.classList.remove('hidden');
            // Small delay to allow the display change before starting opacity transition
            setTimeout(() => {
                mainMenu.classList.add('flex');
            }, 10);
            mobileMenuButton.innerHTML = '<i class="fas fa-times text-xl"></i>';
            mobileMenuButton.setAttribute('aria-expanded', 'true');
        }
    });

    // Handle mobile menu item clicks (close menu after click)
    const navLinks = mainMenu.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) { // Only on mobile
                // Close menu with animation
                mainMenu.classList.add('opacity-0');
                setTimeout(() => {
                    mainMenu.classList.add('hidden');
                    mainMenu.classList.remove('opacity-0', 'flex');
                }, 200);
                mobileMenuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
                mobileMenuButton.setAttribute('aria-expanded', 'false');
            }
        });
    });

    // Handle mobile event capture link
    navEventCaptureMobile.addEventListener('click', (e) => {
        e.preventDefault();
        window.router.showView('EventCapture');
    });

    // Handle window resize to show/hide menu appropriately
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            // Desktop view - ensure menu is visible
            mainMenu.classList.remove('hidden');
            mainMenu.classList.add('flex');
        } else if (!mainMenu.classList.contains('hidden')) {
            // Mobile view - hide menu if it was open
            mainMenu.classList.add('hidden');
            mainMenu.classList.remove('flex');
            mobileMenuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
            mobileMenuButton.setAttribute('aria-expanded', 'false');
        }
    });

    // Set initial ARIA state
    mobileMenuButton.setAttribute('aria-expanded', 'false');
}

initializeApplication();
