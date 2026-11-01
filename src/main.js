import { ChordEngine } from './utils/chordEngine.js';
import { bindChordDock } from './utils/chordDockController.js';
import { EventButtons } from './components/eventButtons.js';
import { EventLog } from './components/eventLog.js';
import { GameState } from './components/gameState.js';
import { Router } from './components/router.js';
import { notificationService } from './services/notificationService.js';
import { stateService } from './services/stateService.js';
import { updateNavbarVisibility, setupMobileMenu } from './utils/domUtils.js';
import { logger, formatTime } from './utils/formatUtils.js';
import { validateXmlStructure, parseXmlToEvents, copyXmlToClipboard, mergeXmlEventStreams } from './utils/xmlUtils.js';
import { showPreview, showAppendPreview, appendEventsToGame } from './utils/importUtils.js';
function showMessage(element, message, isError = false) {
    notificationService.showMessage(element, message, isError);
}
import {
    loadConfiguration,
    listNamedConfigs,
    populateBoardSelect,
    getNamedConfig,
    findNamedConfigName,
    activateNamedConfig,
    usesTeams,
    isBuiltInConfig,
    deleteNamedConfig,
    getConfigDisplayName,
    createBoardExportPayload,
    getBoardExportFilename,
    importNamedConfig,
    triggerFileDownload
} from './components/config.js';
import { createGameCard } from './components/ui/card.js';
import { initCreateMatchDropdown } from './components/ui/createMatchDropdown.js';
import { gameStorageManager } from './services/gameStorageManager.js';
let liveChordEngine = null;

function initLiveChordEngine() {
    if (liveChordEngine) return;
    liveChordEngine = bindChordDock({
        dockElement: document.getElementById('chordThumbDock'),
        badgeElement: document.getElementById('chordEventBadge'),
        promptElement: document.getElementById('chordPromptText'),
        countdownElement: document.getElementById('chordCountdownText'),
        progressBarElement: document.getElementById('chordProgressBar'),
        pillsContainer: document.getElementById('chordPillsContainer'),
        decayDuration: 3500,
        onResolved: ({ label }) => {
            if (label) {
                gameState.updateLastEvent({ labels: [label] });
                saveCaptureDraft();
                syncChrome();
                const lastBar = document.getElementById('lastEventBar');
                if (lastBar) {
                    lastBar.classList.remove('glance-flash');
                    void lastBar.offsetWidth;
                    lastBar.classList.add('glance-flash');
                }
            }
        }
    });
}

import { checkStorageQuota } from './utils/storageWarningUtils.js';
import { draftService, finishCapture } from './services/draftService.js';
import { openTeamSetupDialog, loadLastTeams, saveLastTeams } from './components/teamSetupDialog.js';
import { openCompleteGameDialog } from './components/completeGameDialog.js';
import { bindFinishMenu, syncCaptureChrome } from './components/captureChrome.js';
import { resolveEventName } from './utils/zoneUtils.js';
import { renderRecentEvents } from './components/recentEvents.js';
import { checkAndApplyMockSeed } from './utils/seedData.js';

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
const configProtectedBadge = document.getElementById('configProtectedBadge');
const configProtectedNotice = document.getElementById('configProtectedNotice');
const resetConfigDefaultButton = document.getElementById('resetConfigDefaultButton');
const duplicateConfigButton = document.getElementById('duplicateConfigButton');
const deleteConfigButton = document.getElementById('deleteConfigButton');
const duplicateBoardMenuItem = document.getElementById('duplicateBoardMenuItem');
const exitJsonModeButton = document.getElementById('exitJsonModeButton');
const customizeBoardLink = document.getElementById('customizeBoardLink');
const toggleConfigModeButton = document.getElementById('toggleConfigModeButton');
const toggleConfigModeIcon = document.getElementById('toggleConfigModeIcon');
const toggleConfigModeText = document.getElementById('toggleConfigModeText');
const renameConfigButton = document.getElementById('renameConfigButton');
const importConfigButton = document.getElementById('importConfigButton');
const exportConfigButton = document.getElementById('exportConfigButton');
const boardFileInput = document.getElementById('boardFileInput');
const buttonEditorModal = document.getElementById('buttonEditorModal');
const buttonEditorTitle = document.getElementById('buttonEditorTitle');
const btnEditLabelInput = document.getElementById('btnEditLabelInput');
const btnEditLeadInput = document.getElementById('btnEditLeadInput');
const btnEditLagInput = document.getElementById('btnEditLagInput');
const btnEditColorGroup = document.getElementById('btnEditColorGroup');
const btnEditColorSelect = document.getElementById('btnEditColorSelect');
const btnEditZoneGroup = document.getElementById('btnEditZoneGroup');
const btnEditZonedCheckbox = document.getElementById('btnEditZonedCheckbox');
const btnEditDeleteButton = document.getElementById('btnEditDeleteButton');
const btnEditCancelButton = document.getElementById('btnEditCancelButton');
const btnEditSaveButton = document.getElementById('btnEditSaveButton');
const configModeVisualBtn = document.getElementById('configModeVisualBtn');
const configModeJsonBtn = document.getElementById('configModeJsonBtn');
const configVisualContainer = document.getElementById('configVisualContainer');
const configJsonContainer = document.getElementById('configJsonContainer');
const configBoardPreview = document.getElementById('configBoardPreview');
const configVisualBannerText = document.getElementById('configVisualBannerText');
const importXmlButton = document.getElementById('importXmlButton');
const xmlFileInput = document.getElementById('xmlFileInput');
const appendXmlFileInput = document.getElementById('appendXmlFileInput');
let pendingAppendGame = null;
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
const backToCaptureButton = document.getElementById('backToCaptureButton');

// Mobile Navigation Elements
const mobileMenuButton = document.getElementById('mobileMenuButton');
const mainMenu = document.getElementById('mainMenu');
const navEventCaptureMobile = document.getElementById('navEventCaptureMobile');

// Navigation Elements
const navEventCapture = document.getElementById('navEventCapture');
const navConfig = document.getElementById('navConfig');
const navHelp = document.getElementById('navHelp');
const navStats = document.getElementById('navStats');
const navSavedGames = document.getElementById('navSavedGames');

// View Elements
const trackerView = document.getElementById('tracker-view');
const configView = document.getElementById('config-view');
const logView = document.getElementById('log-view');
const statsView = document.getElementById('stats-view');
const savedGamesView = document.getElementById('saved-games-view');
const helpView = document.getElementById('help-view');

function renderActiveMatchBanner() {
    const banner = document.getElementById('activeMatchBanner');
    if (!banner) return;

    const hasGame = Boolean(stateService.getState('game.hasCurrentGame'));
    if (!hasGame) {
        banner.classList.add('hidden');
        return;
    }

    const teams = stateService.getState('game.teams');
    const events = stateService.getState('game.loggedEvents') || [];
    const count = events.length;
    const elapsedTime = gameState ? gameState.getLiveElapsedTime() : 0;
    const clock = formatTime(elapsedTime);

    const teamsEl = document.getElementById('activeMatchTeams');
    const metaEl = document.getElementById('activeMatchMeta');

    if (teamsEl) {
        teamsEl.textContent = teams ? `${teams[0].code} vs ${teams[1].code}` : 'Live Match';
    }
    if (metaEl) {
        metaEl.textContent = `${clock} · ${count} event${count === 1 ? '' : 's'} logged`;
    }

    banner.classList.remove('hidden');
}

function renderSavedGames() {
    renderActiveMatchBanner();
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
                    onContinueCoding: () => {
                        window.location.href = `timeline-video.html?game=${encodeURIComponent(game.id)}&mode=tag`;
                    },
                    onViewLog: () => {
                        window.location.hash = `log/${encodeURIComponent(game.id)}`;
                    },
                    onAppendXml: () => {
                        pendingAppendGame = game;
                        if (appendXmlFileInput) {
                            appendXmlFileInput.click();
                        }
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
const helpView = document.getElementById('help-view');
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
        backToCaptureButton.classList.add('hidden');
        // Saved logs are read-only, so they have no Recent tab with Delete buttons
        tabButtonRecent.classList.add('hidden');
        recentViewPanel.innerHTML = '';
        if (stateService.getState('ui.currentTab') === 'recentView') {
            router.switchTab('timelineView');
        }
    } else {
        events = stateService.getState('game.loggedEvents') || [];
        savedGameLogBanner.classList.add('hidden');
        backToCaptureButton.classList.remove('hidden');
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
let selectedConfigName = UNSAVED_CONFIG_VALUE;
let previewEventButtons = null;

function updateDeleteButtonState() {
    const name = savedConfigSelect?.value;
    const isCustom = Boolean(name && !isBuiltInConfig(name));
    if (deleteConfigButton) {
        deleteConfigButton.classList.toggle('hidden', !isCustom);
    }
}

function renderSavedConfigOptions(selectedName, includeUnsaved = false) {
    populateBoardSelect(savedConfigSelect, {
        selectedName,
        includeUnsaved
    });
    selectedConfigName = savedConfigSelect.value;
    updateDeleteButtonState();
}

function getPreviewEventButtons() {
    if (!previewEventButtons && configBoardPreview) {
        previewEventButtons = new EventButtons(configBoardPreview);
    }
    return previewEventButtons;
}

function renderConfigVisualPreview(config) {
    if (!configBoardPreview) return;
    if (!config || !Array.isArray(config.rowDefs)) {
        configBoardPreview.innerHTML = '<p class="empty-state text-sm py-6">Invalid board configuration.</p>';
        return;
    }
    try {
        const previewer = getPreviewEventButtons();
        if (previewer) {
            previewer.initialize(config, {
                teams: loadLastTeams(),
                zone: config.zones?.default ?? (config.zones?.values?.[0] ?? '1'),
                selectedTeam: 1
            });
            configBoardPreview.querySelectorAll('.event-button').forEach(button => {
                button.disabled = false;
            });
        }
    } catch (err) {
        configBoardPreview.innerHTML = `<p class="empty-state text-sm py-6 text-red-500">Preview error: ${err.message}</p>`;
    }
    updateDeleteButtonState();
}

function handleBoardFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const fileContent = e.target.result;
            const imported = importNamedConfig(fileContent, file.name);
            renderSavedConfigOptions(imported.name);
            selectedConfigName = imported.name;
            renderConfigVisualPreview(imported.config);
            renderBoard(imported.config);
            renderBoardOptions();
            notificationService.notify(`Imported "${imported.name}" as a custom board.`, 'success');
        } catch (error) {
            logger.error('Failed to import board:', error);
            notificationService.notify(`Failed to import board: ${error.message}`, 'error');
        } finally {
            if (boardFileInput) boardFileInput.value = '';
        }
    };
    reader.onerror = () => {
        notificationService.notify('Could not read the selected board file.', 'error');
        if (boardFileInput) boardFileInput.value = '';
    };
    reader.readAsText(file);
}

function showConfigView() {
    const activeConfig = loadConfiguration();
    const activeName = findNamedConfigName(activeConfig);
    renderSavedConfigOptions(activeName ?? UNSAVED_CONFIG_VALUE, !activeName);
    renderConfigVisualPreview(activeConfig);
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
    populateBoardSelect(boardSelect, {
        selectedName: activeName ?? CUSTOM_BOARD_VALUE,
        includeUnsaved: !activeName
    });
    syncChrome();
}

function notifyRemoved(event) {
    notificationService.notify(`Removed ${describeEvent(event)}`, 'success');
}

function undoLastEvent() {
    if (liveChordEngine) liveChordEngine.cancel();
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

    gameState.newGame({ teams, activeZone, selectedTeam, autoStart: false });
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
    // Check for seeded mock state (?mock=sample, ?mock=active, ?seed=sample)
    checkAndApplyMockSeed();

    // Load configuration
    const currentConfig = loadConfiguration();

    // Initialize event buttons from the active configuration
    if (currentConfig) {
        eventButtons.setConfig(currentConfig);
    }

    // Check URL parameters and hash for view navigation
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const mockParam = urlParams.get('mock');
    const isDevPreview = window.location.pathname.includes('/dev/preview');
    const hash = window.location.hash.substring(1).split('?')[0].split('/')[0];

    // Handle navigation based on URL parameters or hash
    if (viewParam === 'config' || hash === 'configure') {
        stateService.setState('ui.currentView', 'Config');
    } else if (viewParam === 'help' || hash === 'help') {
        stateService.setState('ui.currentView', 'Help');
    } else if (isDevPreview || viewParam === 'event-capture' || hash === 'event-capture' || mockParam === 'active' || mockParam === 'pc-counter' || mockParam === 'armed') {
        stateService.setState('ui.currentView', 'EventCapture');
    } else if (viewParam === 'log' || hash === 'log') {
        stateService.setState('ui.currentView', 'Log');
    } else {
        // Default to saved-games (Matches Hub) view
        stateService.setState('ui.currentView', 'SavedGames');
        renderSavedGames();
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
        lastEventText: lastEvent ? `${lastEvent.event} · ${formatTime(lastEvent.timeMs)}` : '',
        elapsedTime: stateService.getState('game.elapsedTime') || 0
    });
    eventButtons.updateBadgeCounts(events);
    renderActiveMatchBanner();
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


function shouldIgnoreCaptureKeydown(event) {
    if (stateService.getState('ui.currentView') !== 'EventCapture') return true;
    if (captureDialogOpen() || !finishGameList.classList.contains('hidden')) return true;
    if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return true;
    return false;
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

        const timeMs = gameState.getLiveElapsedTime();
        const teamSlot = button.dataset.teamSlot;
        const teamCode = teamSlot && eventButtons.teams ? (eventButtons.teams[Number(teamSlot) - 1]?.code || null) : null;
        const isPC =
            button.dataset.baseEvent === 'PC' ||
            (button.dataset.event && button.dataset.event.endsWith('PC')) ||
            (button.textContent && button.textContent.includes('Penalty Corner'));

        const eventPayload = {
            id: 'pc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            event: eventName,
            timeMs,
            timestamp: formatTime(timeMs),
            eventCode: isPC ? 'PC' : (button.dataset.baseEvent || button.dataset.event || eventName),
            team: teamCode,
            leadTime: isPC ? 10 : (clip.lead ?? 10),
            lagTime: isPC ? 15 : (clip.lag ?? 15),
            ...clip
        };

        if (gameState.addEvent(eventPayload)) {
            saveCaptureDraft();
            if (liveChordEngine) {
                liveChordEngine.startChord(eventPayload);
            }
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


    // Space starts the clock when armed, or pauses/resumes while a game is active
    document.addEventListener('keydown', (event) => {
                if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.code !== 'Space' && event.key !== ' ') return;
        if (shouldIgnoreCaptureKeydown(event)) return;
        if (!stateService.getState('game.hasCurrentGame')) return;

        event.preventDefault();
        gameState.pauseResume();
        saveCaptureDraft();
        syncChrome();
    });

    // Ctrl+Z / Cmd+Z removes the last event while capturing
    document.addEventListener('keydown', (event) => {
                if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'z') return;
        if (shouldIgnoreCaptureKeydown(event)) return;

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
        if (shouldIgnoreCaptureKeydown(event)) return;

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

    if (savedConfigSelect) {
        savedConfigSelect.addEventListener('change', () => {
            const name = savedConfigSelect.value;
            const config = getNamedConfig(name);
            if (config) {
                activateNamedConfig(name);
                selectedConfigName = name;
                renderConfigVisualPreview(config);
                renderBoard(config);
                renderBoardOptions();
                notificationService.notify(`Switched active board to ${getConfigDisplayName(name)}`, 'success');
            }
        });
    }

    if (exportConfigButton) {
        exportConfigButton.addEventListener('click', () => {
            try {
                const currentName = savedConfigSelect?.value || selectedConfigName || 'Custom Board';
                const config = getNamedConfig(currentName) || loadConfiguration();
                const payload = createBoardExportPayload(currentName, config);
                const filename = getBoardExportFilename(currentName);
                const displayName = getConfigDisplayName(currentName) || currentName;
                triggerFileDownload(filename, payload);
                notificationService.notify(`Exported "${displayName}" board file.`, 'success');
            } catch (error) {
                logger.error('Failed to export board:', error);
                notificationService.notify(`Failed to export board: ${error.message}`, 'error');
            }
        });
    }

    if (importConfigButton) {
        importConfigButton.addEventListener('click', () => {
            boardFileInput?.click();
        });
    }

    if (boardFileInput) {
        boardFileInput.addEventListener('change', (e) => {
            const file = e.target?.files?.[0];
            if (file) {
                handleBoardFile(file);
            }
        });
    }

    if (deleteConfigButton) {
        deleteConfigButton.addEventListener('click', () => {
            const name = savedConfigSelect?.value;
            if (!name || isBuiltInConfig(name) || name === UNSAVED_CONFIG_VALUE) return;
            const displayName = getConfigDisplayName(name);
            if (!notificationService.confirm(`Are you sure you want to delete "${displayName}"?`)) {
                return;
            }
            deleteNamedConfig(name);
            notificationService.notify(`Deleted board "${displayName}".`, 'success');
            activateNamedConfig('simple-starter');
            showConfigView();
            renderBoardOptions();
        });
    }

    if (configBoardPreview) {
        configBoardPreview.addEventListener('click', (event) => {
            const zoneBtn = event.target.closest('.zone-button[data-zone]');
            if (zoneBtn) {
                getPreviewEventButtons()?.setZone(zoneBtn.dataset.zone);
                return;
            }
            const teamToggleBtn = event.target.closest('.team-toggle-button[data-team-slot]');
            if (teamToggleBtn) {
                getPreviewEventButtons()?.setSelectedTeam(Number(teamToggleBtn.dataset.teamSlot));
                return;
            }
        });
    }

    initCreateMatchDropdown();

    importXmlButton.addEventListener('click', () => {
        xmlFileInput.click();
    });

    async function parseSingleXmlFile(file) {
        const xmlContent = await file.text();
        validateXmlStructure(xmlContent);
        const events = parseXmlToEvents(xmlContent);
        if (!events.teamsAttribute) {
            events.teamsAttribute = file.name.replace(/\.xml$/i, '').replace(/[-_]+/g, ' ').trim() || null;
        }
        return events;
    }

    async function parseXmlFiles(files) {
        if (files.length === 1) {
            return parseSingleXmlFile(files[0]);
        }

        let combinedEvents = [];
        let detectedTeams = null;
        for (const file of files) {
            const parsed = await parseSingleXmlFile(file);
            detectedTeams = detectedTeams || parsed.teamsAttribute;
            combinedEvents = mergeXmlEventStreams(combinedEvents, parsed);
        }
        combinedEvents.teamsAttribute = detectedTeams;
        return combinedEvents;
    }

    xmlFileInput.addEventListener('change', async (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        try {
            const events = await parseXmlFiles(files);
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
    });

    async function handleAppendFileSelected(file, game) {
        try {
            const xmlContent = await file.text();
            validateXmlStructure(xmlContent);
            const events = parseXmlToEvents(xmlContent);
            if (events.length === 0) {
                throw new Error('No events found in the XML file.');
            }

            showAppendPreview(previewContainer, game, events, (res) => {
                if (res && res.appended) {
                    renderSavedGames();
                }
            });

            previewModal.classList.remove('hidden');
        } catch (error) {
            console.error('Error appending XML:', error);
            notificationService.notify(`Failed to append XML: ${error.message}`, 'error');
        }
    }

    if (appendXmlFileInput) {
        appendXmlFileInput.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (file && pendingAppendGame) {
                await handleAppendFileSelected(file, pendingAppendGame);
            }
            appendXmlFileInput.value = '';
        });
    }
}

const router = new Router(
    {
        EventCapture: { view: trackerView, button: null },
        Config: { view: configView, button: navConfig },
        Log: { view: logView, button: null },
        SavedGames: { view: savedGamesView, button: navSavedGames },
        Help: { view: helpView, button: navHelp }
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
        if (stateService.getState('ui.currentView') !== 'Log') return;
        if (navSavedGames) {
            navSavedGames.classList.add('nav-link-active');
            navSavedGames.setAttribute('aria-current', 'page');
        }
    } else if (viewName === 'SavedGames') {
        renderSavedGames();
    } else if (viewName === 'Config') {
        showConfigView();
    }
});

// Child-path changes (game.loggedEvents) and whole-game replacements (newGame, restore, complete) both notify 'game'
stateService.subscribe('game', syncChrome);

// Initial navigation based on URL hash or defaults to SavedGames (Matches Hub)
function handleInitialNavigation() {
    initLiveChordEngine();
    const fullHash = window.location.hash.substring(1);
    const routeOnly = fullHash.split('?')[0];
    const [hash] = routeOnly.split('/');
    if (hash === 'configure') {
        showConfigView();
    } else if (hash === 'help' || hash.startsWith('help-')) {
        // Help view
    } else if (hash === 'event-capture') {
        // Event capture view
    } else {
        renderSavedGames();
    }

    // Initialize mobile menu functionality
    initMobileMenu();
    // Initialize sticky quick-jump bar smooth scrolling on Help page
    initHelpJumpLinks();
}

/**
 * Initialize quick-jump navigation on the Help page
 */
function initHelpJumpLinks() {
    const jumpBar = document.getElementById('help-jump-bar');
    if (!jumpBar) return;

    jumpBar.addEventListener('click', (e) => {
        const link = e.target.closest('a[href*="#"]');
        if (!link) return;
        const href = link.getAttribute('href');
        const hashIndex = href.indexOf('#');
        if (hashIndex === -1) return;
        const targetPart = href.substring(hashIndex + 1).split('?')[0];
        const targetId = targetPart.includes('/') ? targetPart.split('/')[1] : targetPart;
        const target = document.getElementById(targetId);
        if (target) {
            e.preventDefault();
            if (typeof target.scrollIntoView === 'function') {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
                history.replaceState(null, '', `#help/${targetId}`);
            }
        }
    });
}

if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleInitialNavigation);
} else {
    handleInitialNavigation();
}

/**
 * Initialize the mobile menu toggle and its behavior
 */
function initMobileMenu() {
    setupMobileMenu(mobileMenuButton, mainMenu);

    // Handle mobile brand link
    if (navEventCaptureMobile) {
        navEventCaptureMobile.addEventListener('click', (e) => {
            e.preventDefault();
            window.router.showView('SavedGames');
        });
    }
}

initializeApplication();
