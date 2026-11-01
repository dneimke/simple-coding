/**
 * Video Source Management for Match Review & Timeline
 * Handles direct MP4/WebM URL validation, video stage overlays, banner updates,
 * and attach/detach modals.
 */

import { storageService } from '../services/storageService.js';
import { notificationService } from '../services/notificationService.js';

const LOCAL_STORAGE_KEY_GAMES = 'fieldHockeyGames_v1';

/**
 * Validates a video URL and checks whether it is a supported direct stream
 * or a 3rd-party watch link (e.g. YouTube, Vimeo) that requires caution.
 *
 * @param {string} url
 * @returns {{ valid: boolean, error?: string, isSupportedDirect?: boolean, warning?: string }}
 */
export function validateVideoUrl(url) {
    if (!url || typeof url !== 'string' || !url.trim()) {
        return { valid: false, error: 'Please enter a valid video link' };
    }
    const clean = url.trim();
    try {
        const parsed = new URL(clean);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { valid: false, error: 'Please enter an http or https video link' };
        }
        const host = parsed.hostname.toLowerCase();
        if (host.includes('youtube.com') || host.includes('youtu.be')) {
            return {
                valid: true,
                isSupportedDirect: false,
                warning: 'YouTube watch pages cannot be controlled for frame-accurate hockey coding. Please supply a direct MP4/WebM video stream or downloaded video file.'
            };
        }
        if (host.includes('vimeo.com')) {
            return {
                valid: true,
                isSupportedDirect: false,
                warning: 'Vimeo watch pages require direct MP4/WebM links to support frame seeking and playback speeds.'
            };
        }
        return {
            valid: true,
            isSupportedDirect: true
        };
    } catch (_) {
        return { valid: false, error: 'Please enter a complete, valid URL (e.g. https://example.com/video.mp4)' };
    }
}

/**
 * Updates empty and error overlays on the video player stage based on loaded source.
 */
export function updateVideoStageOverlays() {
    const video = document.getElementById('video-player');
    const emptyOverlay = document.getElementById('video-stage-empty-overlay');
    const errorOverlay = document.getElementById('video-error-overlay');
    const hasSource = Boolean(video && (video.currentSrc || video.src || video.querySelector('source')));

    if (emptyOverlay) {
        emptyOverlay.classList.toggle('hidden', hasSource);
    }
    if (errorOverlay && !hasSource) {
        errorOverlay.classList.add('hidden');
    }
}

/**
 * Updates the current video source banner with filename or URL.
 * @param {Object} [activeGame] - Currently active game object if available
 */
export function updateCurrentVideoBanner(activeGame = null) {
    const banner = document.getElementById('current-video-banner');
    const textEl = document.getElementById('current-video-source-text');
    const video = document.getElementById('video-player');

    const currentSrc = (activeGame && (activeGame.videoUrl || (activeGame.metadata && activeGame.metadata.videoUrl))) ||
                       (video && (video.src || video.currentSrc || ''));

    if (banner && textEl) {
        if (currentSrc) {
            banner.classList.remove('hidden');
            textEl.textContent = currentSrc.length > 40 ? (currentSrc.slice(0, 37) + '...') : currentSrc;
            textEl.title = currentSrc;
        } else {
            banner.classList.add('hidden');
            textEl.textContent = '';
        }
    }
}

/**
 * Sets active/inactive styles and accessibility attributes on a tab pair.
 */
function updateTabUI(activeTab, inactiveTab, activePanel, inactivePanel) {
    if (activeTab) {
        activeTab.classList.add('is-active');
        activeTab.setAttribute('aria-selected', 'true');
    }
    if (inactiveTab) {
        inactiveTab.classList.remove('is-active');
        inactiveTab.setAttribute('aria-selected', 'false');
    }
    if (activePanel) activePanel.classList.remove('hidden');
    if (inactivePanel) inactivePanel.classList.add('hidden');
}

/**
 * Switches tab between URL input and Local File picker.
 * @param {'url' | 'file'} tab
 */
export function switchAttachVideoTab(tab = 'url') {
    const tabUrl = document.getElementById('tab-attach-url');
    const tabFile = document.getElementById('tab-attach-file');
    const panelUrl = document.getElementById('panel-attach-url');
    const panelFile = document.getElementById('panel-attach-file');

    if (tab === 'file') {
        updateTabUI(tabFile, tabUrl, panelFile, panelUrl);
    } else {
        updateTabUI(tabUrl, tabFile, panelUrl, panelFile);
        const input = document.getElementById('video-url-input');
        if (input) setTimeout(() => input.focus(), 100);
    }
}

/**
 * Opens the attach video modal dialog.
 * @param {'url' | 'file'} initialTab
 * @param {Object} [activeGame]
 */
export function openAttachVideoModal(initialTab = 'url', activeGame = null) {
    const modal = document.getElementById('attach-video-modal');
    if (!modal) return;
    switchAttachVideoTab(initialTab);
    updateCurrentVideoBanner(activeGame);
    modal.classList.remove('hidden');
}

/**
 * Closes the attach video modal dialog and clears warnings.
 */
export function closeAttachVideoModal() {
    const modal = document.getElementById('attach-video-modal');
    if (modal) modal.classList.add('hidden');
    const warning = document.getElementById('video-url-warning');
    if (warning) warning.classList.add('hidden');
}
