import { EventButtons, EventLog, GameState, Router } from './components/index.js';
import { notificationService } from './services/notificationService.js';
import { stateService } from './services/stateService.js';
import { updateNavbarVisibility } from './utils/domUtils.js';
import { logger, formatTime } from './utils/formatUtils.js';
import { validateXmlStructure, parseXmlToEvents, copyXmlToClipboard } from './utils/xmlUtils.js';
import { showPreview } from './utils/importUtils.js';
import { showMessage } from './utils/utils.js'; // Legacy function still in utils.js
import { loadConfiguration, listNamedConfigs, getNamedConfig, saveNamedConfig, findNamedConfigName, validateConfig, activateNamedConfig, usesTeams } from './components/config.js';
import { createGameCard, createButton, createInput, createSelect } from './components/ui/index.js';
import { gameStorageManager } from './services/gameStorageManager.js';
import { checkStorageQuota } from './utils/storageWarningUtils.js';
import { draftService, finishCapture } from './services/draftService.js';
import { openTeamSetupDialog, loadLastTeams, saveLastTeams } from './components/teamSetupDialog.js';
import { openCompleteGameDialog } from './components/completeGameDialog.js';
import { bindFinishMenu, syncCaptureChrome } from './components/captureChrome.js';
import { resolveEventName } from './utils/zoneUtils.js';
import { renderRecentEvents } from './components/recentEvents.js';

const LOCAL_STORAGE_KEY_GAMES = 'fieldHockeyGames_v1';

// DOM Elements
const timerDisplay = document.getElementById('timer');
const tabNavContainer = document.querySelector('#log-view nav');
const navContainer = document.querySelector('nav');
const codingButtonsContainer = document.getElementById('coding-buttons-container');
const boardSelect = document.getElementById('boardSelect');
const finishGameList = document.getElementById('finishGameList');
const teamSetupModal = document.getElementById('teamSetupModal');
const completeGameModal = document.getElementById('completeGameModal');
const undoEventButton = document.getElementById('undoEventButton');
const configJsonInput = document.getElementById('configJsonInput');
const configDirtyIndicator = document.getElementById('configDirtyIndicator');
const copyConfigButton = document.getElementById('copyConfigButton');
const replaceConfigButton = document.getElementById('replaceConfigButton');
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
const tabButtonRecent = document.getElementById('tabButtonRecent');
const recentViewPanel = document.getElementById('recentView');
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
            savedGamesList.innerHTML = '<div class="surface empty-state">No saved games yet. Complete a game on Event Capture or import an XML file.</div>';
        }
    } catch (error) {
        logger.error('Error loading games from localStorage:', error);
        savedGamesList.innerHTML = '<div class="banner banner-error">Failed to load saved games.</div>';
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
        // Saved logs are read-only, so they have no Recent tab with Delete buttons
        tabButtonRecent.classList.add('hidden');
        recentViewPanel.innerHTML = '';
        if (stateService.getState('ui.currentTab') === 'recentView') {
            router.switchTab('timelineView');
        }
    } else {
        events = stateService.getState('game.loggedEvents') || [];
        savedGameLogBanner.classList.add('hidden');
        tabButtonRecent.classList.remove('hidden');
        renderRecentEvents(recentViewPanel, events);
        router.switchTab('recentView');
    }

    eventLog.render(events);
    copyXmlButton.disabled = events.length === 0;
}

function deleteLoggedEvent(index) {
    const removed = gameState.removeEvent(index);
    if (!removed) return;
    saveCaptureDraft();
    notifyRemoved(removed);
    renderRecentEvents(recentViewPanel, stateService.getState('game.loggedEvents') || []);
    copyXmlButton.disabled = (stateService.getState('game.loggedEvents') || []).length === 0;
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
    renderBoard(config);
    renderBoardOptions();
}

// Team rows show the game's teams, or the last-used teams as placeholders before a game starts
function renderBoard(config = loadConfiguration()) {
    const game = stateService.getState('game');
    eventButtons.initialize(config, {
        teams: game.teams ?? loadLastTeams(),
        zone: game.activeZone ?? undefined,
        selectedTeam: game.selectedTeam ?? undefined
    });
    eventButtons.setState(game);
}

const CUSTOM_BOARD_VALUE = '';

function renderBoardOptions() {
    const activeName = findNamedConfigName(loadConfiguration());
    boardSelect.innerHTML = '';
    if (!activeName) {
        const option = document.createElement('option');
        option.value = CUSTOM_BOARD_VALUE;
        option.textContent = 'Custom layout';
        boardSelect.appendChild(option);
    }
    listNamedConfigs().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        boardSelect.appendChild(option);
    });
    boardSelect.value = activeName ?? CUSTOM_BOARD_VALUE;
    syncChrome();
}

function notifyRemoved(event) {
    notificationService.notify(`Removed ${describeEvent(event)}`, 'success');
}

function undoLastEvent() {
    const removed = gameState.removeLastEvent();
    if (!removed) return;
    saveCaptureDraft();
    notifyRemoved(removed);
}

function selectZone(zone) {
    eventButtons.setZone(zone);
    if (eventButtons.zone !== zone) return;
    if (stateService.getState('game.hasCurrentGame')) {
        gameState.setActiveZone(zone);
        saveCaptureDraft();
    }
}

function selectTeam(slot) {
    eventButtons.setSelectedTeam(slot);
    if (stateService.getState('game.hasCurrentGame')) {
        gameState.setSelectedTeam(slot);
        saveCaptureDraft();
    }
}

async function startNewGame() {
    const config = loadConfiguration();
    let teams = null;
    if (usesTeams(config)) {
        teams = await openTeamSetupDialog(loadLastTeams());
        if (!teams) return;
        saveLastTeams(teams);
    }
    const zones = config.zones;
    const activeZone = zones ? (eventButtons.zone ?? zones.default ?? zones.values[0]) : null;

    const selectedTeam = teams ? eventButtons.selectedTeam : null;

    gameState.newGame({ teams, activeZone, selectedTeam });
    renderBoard(config);
    saveCaptureDraft();
    showCaptureControls();
}

function parseEditorConfig() {
    const parsedConfig = JSON.parse(configJsonInput.value);
    validateConfig(parsedConfig);
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
    renderBoard(currentConfig);
    renderBoardOptions();
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

const describeEvent = (event) => `${event.event} (${formatTime(event.timeMs)})`;

function syncChrome() {
    const hasGame = Boolean(stateService.getState('game.hasCurrentGame'));
    const events = stateService.getState('game.loggedEvents') || [];
    const lastEvent = hasGame ? events.at(-1) : null;
    syncCaptureChrome({
        hasGame,
        isRunning: Boolean(stateService.getState('game.isRunning')),
        lastEventText: lastEvent ? `${lastEvent.event} · ${formatTime(lastEvent.timeMs)}` : ''
    });
    return hasGame;
}

function showCaptureControls() {
    syncChrome();
    updateNavbarVisibility(true);
}

function showStartControls() {
    syncChrome();
    updateNavbarVisibility(false);
}

function restoreCaptureDraft() {
    const draft = draftService.loadDraft();
    if (!draft) return;

    gameState.restoreSession(draft);
    renderBoard();
    showCaptureControls();
    notificationService.notify(`Restored capture in progress: ${describeCapture()}`, 'success', 6000);
}

function captureDialogOpen() {
    return [teamSetupModal, completeGameModal].some(modal => modal && !modal.classList.contains('hidden'));
}

async function completeCapture() {
    const elapsedTime = gameState.getLiveElapsedTime();
    const events = stateService.getState('game.loggedEvents') || [];
    const count = events.length;
    const teams = stateService.getState('game.teams');
    const suggestedName = teams ? `${teams[0].code} vs ${teams[1].code}` : '';
    const choice = await openCompleteGameDialog({
        summary: `Save ${count} event${count === 1 ? '' : 's'}, clock at ${formatTime(elapsedTime)}, to Saved Games. The capture will reset.`,
        suggestedName
    });
    if (!choice) return;

    const result = finishCapture({
        events,
        elapsedTime,
        timestamp: new Date().toISOString(),
        teams: choice.name ? choice.name : null,
        ...(teams && { teamCodes: teams.map(team => team.code) })
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
    renderBoard();
    showStartControls();
}

function discardCapture() {
    const userConfirmed = notificationService.confirm(
        `Discard ${describeCapture()}? This cannot be undone.`
    );
    if (!userConfirmed) return;

    gameState.completeGame();
    draftService.clearDraft();
    renderBoard();
    showStartControls();
}

function registerEventListeners() {
    bindFinishMenu();

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
        const zoneButton = event.target.closest('.zone-button[data-zone]');
        if (zoneButton) {
            selectZone(zoneButton.dataset.zone);
            return;
        }

        const teamToggle = event.target.closest('.team-toggle[data-team-select]');
        if (teamToggle) {
            selectTeam(Number(teamToggle.dataset.teamSelect));
            return;
        }

        const button = event.target.closest('.event-button[data-event]');
        if (!button) return; // Ignore clicks on unrelated elements

        const eventName = resolveEventName(
            { event: button.dataset.event, zoned: button.dataset.zoned === 'true', slot: button.dataset.teamSlot },
            { zone: eventButtons.zone, zones: eventButtons.config?.zones }
        );
        const clip = {};
        if (button.dataset.lead !== undefined) clip.lead = Number(button.dataset.lead);
        if (button.dataset.lag !== undefined) clip.lag = Number(button.dataset.lag);
        if (gameState.addEvent({ event: eventName, timeMs: gameState.getLiveElapsedTime(), ...clip })) {
            saveCaptureDraft();
        }
    });

    trackerView.addEventListener('click', (event) => {
        const { id } = event.target;

        switch (id) {
            case 'newGameButton':
                startNewGame();
                break;
            case 'pauseResumeButton':
                gameState.pauseResume();
                saveCaptureDraft();
                syncChrome();
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

    undoEventButton.addEventListener('click', undoLastEvent);

    recentViewPanel.addEventListener('click', (event) => {
        const button = event.target.closest('[data-delete-index]');
        if (!button || stateService.getState('ui.logGameId')) return;
        deleteLoggedEvent(Number(button.dataset.deleteIndex));
    });

    // Ctrl+Z / Cmd+Z removes the last event while capturing
    document.addEventListener('keydown', (event) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'z') return;
        if (stateService.getState('ui.currentView') !== 'EventCapture') return;
        if (captureDialogOpen() || !finishGameList.classList.contains('hidden')) return;
        if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;

        event.preventDefault();
        undoLastEvent();
    });

    boardSelect.addEventListener('change', () => {
        if (stateService.getState('game.hasCurrentGame') || boardSelect.value === CUSTOM_BOARD_VALUE) {
            renderBoardOptions();
            return;
        }
        try {
            const config = activateNamedConfig(boardSelect.value);
            eventButtons.setConfig(config);
            renderBoard(config);
        } catch (error) {
            logger.error('Failed to switch board:', error);
            notificationService.notify(error.message, 'error');
        }
        renderBoardOptions();
    });

    // Number keys pick the sticky zone (from Team 1's perspective); T switches the team for shared team buttons
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (stateService.getState('ui.currentView') !== 'EventCapture') return;
        if (captureDialogOpen() || !finishGameList.classList.contains('hidden')) return;
        if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;

        if (event.key === 't' || event.key === 'T') {
            if (!codingButtonsContainer.querySelector('.team-toggle')) return;
            event.preventDefault();
            selectTeam(eventButtons.selectedTeam === 1 ? 2 : 1);
            return;
        }

        const zones = eventButtons.config?.zones;
        const index = Number(event.key) - 1;
        if (!zones || !Number.isInteger(index) || index < 0 || index >= zones.values.length) return;

        event.preventDefault();
        selectZone(zones.values[index]);
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

    copyConfigButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(configJsonInput.value);
            notificationService.notify('Configuration copied to clipboard.', 'success');
        } catch (err) {
            logger.error('Failed to copy configuration to clipboard:', err);
            configJsonInput.focus();
            configJsonInput.select();
            showMessage(configMessage, 'Copy failed. The configuration is selected so you can copy it manually.', true);
        }
    });

    replaceConfigButton.addEventListener('click', async () => {
        let text;
        try {
            text = await navigator.clipboard.readText();
        } catch (err) {
            logger.error('Failed to read configuration from clipboard:', err);
            configJsonInput.focus();
            configJsonInput.select();
            showMessage(configMessage, 'Clipboard access was blocked. The configuration is selected, so long-press and choose Paste.', true);
            return;
        }

        let parsedConfig;
        try {
            parsedConfig = JSON.parse(text);
        } catch {
            parsedConfig = null;
        }
        if (!parsedConfig || !Array.isArray(parsedConfig.rowDefs)) {
            showMessage(configMessage, "The clipboard doesn't contain a valid configuration.", true);
            return;
        }
        try {
            validateConfig(parsedConfig);
        } catch (error) {
            showMessage(configMessage, `The clipboard configuration is invalid. ${error.message}`, true);
            return;
        }

        if (isEditorDirty() &&
            !notificationService.confirm('Replace your unsaved changes with the clipboard contents?')) {
            return;
        }

        const formatted = JSON.stringify(parsedConfig, null, 2);
        configJsonInput.focus();
        configJsonInput.select();
        if (!document.execCommand('insertText', false, formatted)) {
            configJsonInput.value = formatted;
        }
        configJsonInput.setSelectionRange(0, 0);
        configJsonInput.scrollTop = 0;
        updateDirtyIndicator();
        showMessage(configMessage, 'Configuration replaced. Tap Save or Save as to keep it.');
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
        recent: tabButtonRecent,
        timeline: tabButtonTimeline,
        xml: tabButtonXml,
        statistics: tabButtonStatistics,
        recentView: recentViewPanel,
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

// Child-path changes (game.loggedEvents) and whole-game replacements (newGame, restore, complete) both notify 'game'
stateService.subscribe('game', syncChrome);

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
