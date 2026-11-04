import {
    hasModifierKey,
    isEditableElement,
    isSpaceShortcut,
    isUndoShortcut,
    isTeamToggleShortcut,
    resolveZoneIndex
} from './utils/captureKeyboardRouter.js';
import { ChordEngine } from './utils/chordEngine.js';
import { bindChordDock } from './utils/chordDockController.js';
import { EventButtons } from './components/eventButtons.js';
import { EventLog } from './components/eventLog.js';
import { GameState } from './components/gameState.js';
import { Router } from './components/router.js';
import { notificationService } from './services/notificationService.js';
import { stateService } from './services/stateService.js';
import { updateNavbarVisibility, setupMobileMenu } from './utils/domUtils.js';
import { resolveInitialView, parseHelpJumpTargetId } from './utils/navigationUtils.js';
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
import { createCaptureEventPayload } from './utils/capturePayloadUtils.js';
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

function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function formatActiveMatchTeams(teams) {
    return (Array.isArray(teams) && teams.length >= 2) ? `${teams[0].code} vs ${teams[1].code}` : 'Live Match';
}

function formatActiveMatchMeta(clock, count) {
    return `${clock} · ${count} event${count === 1 ? '' : 's'} logged`;
}

function renderActiveMatchBanner() {
    const banner = document.getElementById('activeMatchBanner');
    if (!banner) return;

    if (!stateService.getState('game.hasCurrentGame')) {
        banner.classList.add('hidden');
        return;
    }

    const teams = stateService.getState('game.teams');
    const count = (stateService.getState('game.loggedEvents') || []).length;
    const elapsedTime = gameState?.getLiveElapsedTime() || 0;

    setElementText('activeMatchTeams', formatActiveMatchTeams(teams));
    setElementText('activeMatchMeta', formatActiveMatchMeta(formatTime(elapsedTime), count));
    banner.classList.remove('hidden');
}

function promptNewGameName(game, index) {
    const currentName = game.teams || `Game ${index + 1}`;
    const raw = notificationService.prompt('Enter a new name for this game:', currentName);
    return raw ? raw.trim() : '';
}

function notifyRenameResult(result, trimmed) {
    if (result === true) {
        renderSavedGames();
        logger.log(`Game renamed to "${trimmed}" successfully.`);
        return;
    }
    const msg = (result && result.message) ? result.message : 'Unknown error';
    notificationService.notify(`Failed to rename the game: ${msg}`, 'error');
}

function handleRenameSavedGame(game, index) {
    const trimmed = promptNewGameName(game, index);
    if (!trimmed) return;
    const result = gameStorageManager.updateGame(index, { teams: trimmed });
    notifyRenameResult(result, trimmed);
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
                    onRename: () => handleRenameSavedGame(game, index),
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
function renderSavedGameLog(game) {
    savedGameLogTitle.textContent = game.teams || 'Game';
    savedGameLogBanner.classList.remove('hidden');
    backToCaptureButton.classList.add('hidden');
    tabButtonRecent.classList.add('hidden');
    recentViewPanel.innerHTML = '';
    if (stateService.getState('ui.currentTab') === 'recentView') {
        router.switchTab('timelineView');
    }
}

function renderLiveGameLog(events) {
    savedGameLogBanner.classList.add('hidden');
    backToCaptureButton.classList.remove('hidden');
    tabButtonRecent.classList.remove('hidden');
    renderRecentEvents(recentViewPanel, events);
    router.switchTab('recentView');
}

function renderLogView() {
    const savedGameId = stateService.getState('ui.logGameId');
    if (savedGameId) {
        const game = gameStorageManager.getGameById(savedGameId);
        if (!game) {
            notificationService.notify('That saved game could not be found.', 'error');
            router.showView('SavedGames', renderSavedGames);
            return;
        }
        renderSavedGameLog(game);
        const events = game.events || [];
        eventLog.render(events);
        copyXmlButton.disabled = events.length === 0;
        return;
    }

    const events = stateService.getState('game.loggedEvents') || [];
    renderLiveGameLog(events);
    eventLog.render(events, { activeTab: 'recentView' });
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

function firstZoneValue(values) {
    return Array.isArray(values) && values.length > 0 ? values[0] : '1';
}

function getDefaultPreviewZone(zones) {
    if (!zones) return '1';
    return zones.default || firstZoneValue(zones.values);
}

function hasValidBoardRows(config) {
    return Boolean(config && Array.isArray(config.rowDefs));
}

function populateConfigPreview(previewer, config) {
    previewer.initialize(config, {
        teams: loadLastTeams(),
        zone: getDefaultPreviewZone(config.zones),
        selectedTeam: 1
    });
    configBoardPreview?.querySelectorAll('.event-button').forEach(button => {
        button.disabled = false;
    });
}

function tryPopulateConfigPreview(config) {
    try {
        const previewer = getPreviewEventButtons();
        if (previewer) populateConfigPreview(previewer, config);
    } catch (err) {
        configBoardPreview.innerHTML = `<p class="empty-state text-sm py-6 text-red-500">Preview error: ${err.message}</p>`;
    }
}

function renderConfigVisualPreview(config) {
    if (!configBoardPreview) return;
    if (!hasValidBoardRows(config)) {
        configBoardPreview.innerHTML = '<p class="empty-state text-sm py-6">Invalid board configuration.</p>';
        return;
    }
    tryPopulateConfigPreview(config);
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

function determineNewGameDefaults(config, teams) {
    const zones = config.zones;
    const activeZone = zones ? (eventButtons.zone || zones.default || zones.values[0]) : null;
    const selectedTeam = teams ? eventButtons.selectedTeam : null;
    return { activeZone, selectedTeam };
}

async function startNewGame() {
    const config = loadConfiguration();
    let teams = null;
    if (usesTeams(config)) {
        teams = await openTeamSetupDialog(loadLastTeams());
        if (!teams) return;
        saveLastTeams(teams);
    }
    const { activeZone, selectedTeam } = determineNewGameDefaults(config, teams);

    gameState.newGame({ teams, activeZone, selectedTeam, autoStart: false });
    renderBoard(config);
    saveCaptureDraft();
    showCaptureControls();
}

function initializeApplication() {
    checkAndApplyMockSeed();
    const currentConfig = loadConfiguration();
    if (currentConfig) {
        eventButtons.setConfig(currentConfig);
    }

    registerEventListeners();
    renderBoard(currentConfig);
    renderBoardOptions();
    showConfigView();
    restoreCaptureDraft();

    const initialView = resolveInitialView(window.location.search, window.location.hash, window.location.pathname);
    stateService.setState('ui.currentView', initialView);
    if (initialView === 'SavedGames') {
        renderSavedGames();
    } else if (initialView === 'Log') {
        handleLogViewActivation(navSavedGames);
    }

    updateNavbarVisibility(stateService.getState('game.hasCurrentGame'));
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

function buildFinishCapturePayload(choice, events, elapsedTime, teams) {
    const payload = {
        events,
        elapsedTime,
        timestamp: new Date().toISOString(),
        teams: choice.name || null
    };
    if (teams) {
        payload.teamCodes = teams.map(t => t.code);
    }
    return payload;
}

async function completeCapture() {
    const elapsedTime = gameState.getLiveElapsedTime();
    const events = stateService.getState('game.loggedEvents') || [];
    const teams = stateService.getState('game.teams');
    const suggestedName = formatActiveMatchTeams(teams);
    const summary = `Save ${events.length} event${events.length === 1 ? '' : 's'}, clock at ${formatTime(elapsedTime)}, to Saved Games. The capture will reset.`;

    const choice = await openCompleteGameDialog({ summary, suggestedName });
    if (!choice) return;

    const payload = buildFinishCapturePayload(choice, events, elapsedTime, teams);
    const result = finishCapture(payload, gameStorageManager);

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


function isCaptureBlockedByDialog() {
    return captureDialogOpen() || !finishGameList.classList.contains('hidden');
}

function shouldIgnoreCaptureKeydown(event) {
    if (stateService.getState('ui.currentView') !== 'EventCapture') return true;
    if (isCaptureBlockedByDialog()) return true;
    return isEditableElement(event.target);
}

function initNavEventListeners() {
    bindFinishMenu();

    tabNavContainer.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (!button) return;

        const tab = button.dataset.tab;
        router.switchTab(tab);
    });

    navContainer.addEventListener('click', (event) => {
        const navButton = event.target.closest('[id^="nav"]');
        if (!navButton) return;

        const viewName = navButton.id.slice(3);
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
}

function handleDirectCodingClick(target) {
    const zoneButton = target.closest('.zone-button[data-zone]');
    if (zoneButton) {
        selectZone(zoneButton.dataset.zone);
        return true;
    }
    const teamToggle = target.closest('.team-toggle[data-team-select]');
    if (teamToggle) {
        selectTeam(Number(teamToggle.dataset.teamSelect));
        return true;
    }
    return false;
}

function recordAndChordEvent(eventPayload) {
    if (!gameState.addEvent(eventPayload)) return;
    saveCaptureDraft();
    if (liveChordEngine) {
        liveChordEngine.startChord(eventPayload);
    }
}

function buildCaptureEventContext() {
    const cfg = eventButtons.config;
    return {
        zone: eventButtons.zone,
        zones: cfg ? cfg.zones : null,
        teams: eventButtons.teams,
        elapsedTime: gameState.getLiveElapsedTime()
    };
}

function handleCodingButtonClick(event) {
    if (handleDirectCodingClick(event.target)) return;
    const button = event.target.closest('.event-button[data-event]');
    if (!button) return;
    const eventPayload = createCaptureEventPayload(button, buildCaptureEventContext());
    recordAndChordEvent(eventPayload);
}

function initCodingButtonListeners() {
    codingButtonsContainer.addEventListener('click', handleCodingButtonClick);
}

function initTrackerControlListeners() {
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
}

function handleSpaceShortcut(event) {
    if (!isSpaceShortcut(event)) return false;
    if (shouldIgnoreCaptureKeydown(event) || !stateService.getState('game.hasCurrentGame')) return false;

    event.preventDefault();
    gameState.pauseResume();
    saveCaptureDraft();
    syncChrome();
    return true;
}

function handleUndoShortcut(event) {
    if (!isUndoShortcut(event)) return false;
    if (shouldIgnoreCaptureKeydown(event)) return false;

    event.preventDefault();
    undoLastEvent();
    return true;
}

function handleTeamToggleShortcut(event) {
    if (!isTeamToggleShortcut(event)) return false;
    if (!codingButtonsContainer.querySelector('.team-toggle')) return false;

    event.preventDefault();
    selectTeam(eventButtons.selectedTeam === 1 ? 2 : 1);
    return true;
}

function getActiveZoneValues() {
    const config = eventButtons.config;
    return config && config.zones ? config.zones.values : null;
}

function handleZoneShortcut(event) {
    const values = getActiveZoneValues();
    if (!Array.isArray(values)) return false;
    const index = resolveZoneIndex(event.key, values.length);
    if (index === -1) return false;

    event.preventDefault();
    selectZone(values[index]);
    return true;
}

function shouldIgnoreActiveKeydown(event) {
    return hasModifierKey(event) || shouldIgnoreCaptureKeydown(event);
}

function handleShortcutsBeforeFilter(event) {
    return handleSpaceShortcut(event) || handleUndoShortcut(event);
}

function handleCaptureKeydown(event) {
    if (handleShortcutsBeforeFilter(event)) return;
    if (shouldIgnoreActiveKeydown(event)) return;
    if (!handleTeamToggleShortcut(event)) {
        handleZoneShortcut(event);
    }
}

function initCaptureKeyboardShortcuts() {
    document.addEventListener('keydown', handleCaptureKeydown);
}

function resolveExportConfigName() {
    return savedConfigSelect?.value || selectedConfigName || 'Custom Board';
}

function handleBoardExport() {
    try {
        const currentName = resolveExportConfigName();
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
}

function isConfigDeletable(name) {
    return Boolean(name && !isBuiltInConfig(name) && name !== UNSAVED_CONFIG_VALUE);
}

function handleBoardDelete() {
    const name = savedConfigSelect?.value;
    if (!isConfigDeletable(name)) return;
    const displayName = getConfigDisplayName(name);
    if (!notificationService.confirm(`Are you sure you want to delete "${displayName}"?`)) {
        return;
    }
    deleteNamedConfig(name);
    notificationService.notify(`Deleted board "${displayName}".`, 'success');
    activateNamedConfig('simple-starter');
    showConfigView();
    renderBoardOptions();
}

function initBoardSelectorListeners() {
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

    savedConfigSelect?.addEventListener('change', () => {
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

function initBoardFileActionListeners() {
    exportConfigButton?.addEventListener('click', handleBoardExport);
    importConfigButton?.addEventListener('click', () => boardFileInput?.click());
    boardFileInput?.addEventListener('change', (e) => {
        const file = e.target?.files?.[0];
        if (file) handleBoardFile(file);
    });
    deleteConfigButton?.addEventListener('click', handleBoardDelete);
}

function initConfigPreviewClickListeners() {
    configBoardPreview?.addEventListener('click', (event) => {
        const zoneBtn = event.target.closest('.zone-button[data-zone]');
        if (zoneBtn) {
            getPreviewEventButtons()?.setZone(zoneBtn.dataset.zone);
            return;
        }
        const teamToggleBtn = event.target.closest('.team-toggle-button[data-team-slot]');
        if (teamToggleBtn) {
            getPreviewEventButtons()?.setSelectedTeam(Number(teamToggleBtn.dataset.teamSlot));
        }
    });
}

function initConfigViewEventListeners() {
    initBoardSelectorListeners();
    initBoardFileActionListeners();
    initConfigPreviewClickListeners();
}

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

function initXmlImportEventListeners() {
    copyXmlButton.addEventListener('click', () => {
        const xmlContent = eventLog.getXmlText();
        copyXmlToClipboard(xmlContent);
    });

    initCreateMatchDropdown();

    importXmlButton.addEventListener('click', () => {
        xmlFileInput.click();
    });

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

function registerEventListeners() {
    initNavEventListeners();
    initCodingButtonListeners();
    initTrackerControlListeners();
    initCaptureKeyboardShortcuts();
    initConfigViewEventListeners();
    initXmlImportEventListeners();
}

const eventLog = new EventLog(timelineViewPanel, xmlOutputContainer, statisticsViewPanel);
const eventButtons = new EventButtons(codingButtonsContainer);
const gameState = new GameState(timerDisplay, eventLog, eventButtons);

// Ensure mock seeds and active draft state are loaded before Router evaluates #log route guards
checkAndApplyMockSeed();
if (draftService.loadDraft()) {
    stateService.setState('game.hasCurrentGame', true);
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

function highlightSavedGamesNav(navSavedGames) {
    if (!navSavedGames) return;
    navSavedGames.classList.add('nav-link-active');
    navSavedGames.setAttribute('aria-current', 'page');
}

function handleLogViewActivation(navSavedGames) {
    renderLogView();
    if (stateService.getState('ui.currentView') === 'Log') {
        highlightSavedGamesNav(navSavedGames);
    }
}

function handleViewChange(viewName) {
    if (viewName === 'Log') {
        handleLogViewActivation(navSavedGames);
        return;
    }
    if (viewName === 'SavedGames') {
        renderSavedGames();
        return;
    }
    if (viewName === 'Config') {
        showConfigView();
    }
}

stateService.subscribe('ui.currentView', handleViewChange);

stateService.subscribe('ui.currentTab', (tabName) => {
    if (stateService.getState('ui.currentView') === 'Log') {
        eventLog.renderTab(tabName);
    }
});

// Child-path changes (game.loggedEvents) and whole-game replacements (newGame, restore, complete) both notify 'game'
stateService.subscribe('game', syncChrome);

const KNOWN_INITIAL_ROUTES = new Set(['help', 'event-capture', 'log']);

// Initial navigation based on URL hash or defaults to SavedGames (Matches Hub)
function handleInitialNavigation() {
    initLiveChordEngine();
    const [hash] = window.location.hash.substring(1).split('?')[0].split('/');
    if (hash === 'configure') {
        showConfigView();
    } else if (!KNOWN_INITIAL_ROUTES.has(hash) && !hash.startsWith('help-')) {
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
        const targetId = link ? parseHelpJumpTargetId(link.getAttribute('href')) : null;
        const target = targetId ? document.getElementById(targetId) : null;
        if (!target) return;

        e.preventDefault();
        target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        history?.replaceState?.(null, '', `#help/${targetId}`);
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
