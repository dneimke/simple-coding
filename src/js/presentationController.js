/**
 * Presentation Mode & Playlist Controller
 * Powers browser-native continuous playlist seeking for starred/favorite events (Friction 3).
 * Zero re-render overhead.
 */

import { formatTime } from '../utils/formatUtils.js';

export const DEFAULT_LEAD_SECONDS = 5;
export const DEFAULT_LAG_SECONDS = 5;

/**
 * Returns lead pre-roll duration in seconds for an event, falling back to DEFAULT_LEAD_SECONDS.
 * @param {Object} event
 * @returns {number}
 */
export function getEventLeadSeconds(event) {
    if (!event) return DEFAULT_LEAD_SECONDS;
    const raw = event.lead ?? event.leadTime;
    const num = Number(raw);
    return Number.isFinite(num) && num >= 0 ? num : DEFAULT_LEAD_SECONDS;
}

/**
 * Returns lag post-roll duration in seconds for an event, falling back to DEFAULT_LAG_SECONDS.
 * @param {Object} event
 * @returns {number}
 */
export function getEventLagSeconds(event) {
    if (!event) return DEFAULT_LAG_SECONDS;
    const raw = event.lag ?? event.lagTime;
    const num = Number(raw);
    return Number.isFinite(num) && num >= 0 ? num : DEFAULT_LAG_SECONDS;
}

/**
 * Returns the video seek position (in seconds) for reviewing an event build-up.
 * Clamps to 0 so early events do not produce negative video times.
 * @param {Object} event
 * @returns {number}
 */
export function getEventSeekSeconds(event) {
    if (!event || typeof event.timeMs !== 'number') return 0;
    const eventSeconds = event.timeMs / 1000;
    const lead = getEventLeadSeconds(event);
    return Math.max(0, eventSeconds - lead);
}

/**
 * Returns the video end boundary (in seconds) for an event clip window.
 * @param {Object} event
 * @returns {number}
 */
export function getEventEndSeconds(event) {
    if (!event || typeof event.timeMs !== 'number') return 0;
    const eventSeconds = event.timeMs / 1000;
    const lag = getEventLagSeconds(event);
    return eventSeconds + lag;
}

/**
 * Controller class managing favorite events playlist and presentation mode HUD.
 */
export class PresentationController {
    constructor(deps = {}) {
        this.deps = deps; // { formatEventTypeName, setFavoritesOnly, showNotification, highlightTimelineEvent }
        this.isActive = false;
        this.favoriteEvents = [];
        this.activePlaylistName = 'Favorites';
        this.currentIndex = 0;
        this.currentClipEnd = null;
        this.boundOnTimeUpdate = this._onTimeUpdate.bind(this);
    }

    /**
     * Initializes DOM event handlers for presentation mode buttons.
     * @param {Object} [callbacks] Optional external callbacks { onToggle, onNavigate }
     */
    init(callbacks = {}) {
        const presentationModeBtn = document.getElementById('presentation-mode');
        const playlistControls = document.getElementById('playlist-controls');
        const prevFavoriteBtn = document.getElementById('prev-favorite');
        const nextFavoriteBtn = document.getElementById('next-favorite');

        if (presentationModeBtn && playlistControls) {
            presentationModeBtn.addEventListener('click', () => {
                if (typeof callbacks.onToggle === 'function') {
                    callbacks.onToggle();
                } else {
                    this.toggle();
                }
            });

            if (prevFavoriteBtn && nextFavoriteBtn) {
                const handleNavigate = (dir) => (typeof callbacks.onNavigate === 'function' ? callbacks.onNavigate(dir) : this.navigate(dir));
                prevFavoriteBtn.addEventListener('click', () => handleNavigate('previous'));
                nextFavoriteBtn.addEventListener('click', () => handleNavigate('next'));
            }
        }
    }

    _getElements() {
        return {
            presentationModeBtn: document.getElementById('presentation-mode'),
            playlistControls: document.getElementById('playlist-controls'),
            timelineContainer: document.getElementById('timeline-container'),
            videoPlayer: document.getElementById('video-player')
        };
    }

    /**
     * Activates presentation view layout and jumps to the first clip in the active playlist.
     * @param {Array} timelineEvents
     * @param {Object} [options] - { events?: Array, playlistName?: string, skipFilterSync?: boolean }
     */
    _enterPresentation(timelineEvents, options = {}) {
        const hasExplicitEvents = Array.isArray(options?.events);
        const sourceEvents = hasExplicitEvents
            ? options.events
            : (Array.isArray(timelineEvents) && timelineEvents.length > 0
                ? timelineEvents
                : (this.deps.getTimelineEvents?.() || []));

        this.activePlaylistName = options?.playlistName || 'Favorites';

        const selectedEvents = hasExplicitEvents
            ? sourceEvents
            : sourceEvents.filter(e => Boolean(e.isFavorite || e.favorite));

        this.favoriteEvents = selectedEvents
            .map((evt, idx) => evt.id ? evt : { ...evt, id: `event-fav-${idx}` });

        if (this.favoriteEvents.length === 0) {
            const msg = options?.playlistName && options.playlistName !== 'Favorites'
                ? `Add clips to "${options.playlistName}" first to start a presentation`
                : 'Add some favorites first to start a presentation';
            this.deps.showNotification?.(msg, 'warning');
            this.isActive = false;
            return;
        }

        const { presentationModeBtn, playlistControls, timelineContainer, videoPlayer } = this._getElements();
        presentationModeBtn?.classList.add('is-active');
        presentationModeBtn?.setAttribute('aria-pressed', 'true');
        playlistControls?.classList.replace('hidden', 'flex');
        timelineContainer?.classList.add('hidden');
        videoPlayer?.addEventListener('timeupdate', this.boundOnTimeUpdate);

        this.currentIndex = 0;
        this.updateCounter();
        if (!options?.skipFilterSync) {
            this.deps.setFavoritesOnly?.(true);
        }
        this.jumpToEvent(this.favoriteEvents[0]);
    }

    /**
     * Deactivates presentation view and restores original timeline controls.
     */
    _exitPresentation() {
        const { presentationModeBtn, playlistControls, timelineContainer, videoPlayer } = this._getElements();

        if (presentationModeBtn) {
            presentationModeBtn.classList.remove('is-active');
            presentationModeBtn.setAttribute('aria-pressed', 'false');
        }
        if (playlistControls) playlistControls.classList.replace('flex', 'hidden');
        if (timelineContainer) timelineContainer.classList.remove('hidden');

        if (videoPlayer) {
            videoPlayer.removeEventListener('timeupdate', this.boundOnTimeUpdate);
        }
        this.currentClipEnd = null;

        this.updateOverlay(null);
    }

    /**
     * Toggles between presentation mode and normal editing mode.
     * @param {Array} timelineEvents - Current full event list
     * @param {Object} [options] - Optional { events, playlistName, skipFilterSync }
     */
    toggle(timelineEvents = [], options = {}) {
        this.isActive = !this.isActive;
        if (this.isActive) {
            this._enterPresentation(timelineEvents, options);
        } else {
            this._exitPresentation();
        }
    }

    /**
     * Navigates playlist next or previous.
     * @param {'next' | 'previous'} direction
     */
    navigate(direction) {
        if (!this.favoriteEvents || this.favoriteEvents.length === 0) return;

        if (direction === 'next') {
            this.currentIndex = (this.currentIndex + 1) % this.favoriteEvents.length;
        } else {
            this.currentIndex = (this.currentIndex - 1 + this.favoriteEvents.length) % this.favoriteEvents.length;
        }

        this.updateCounter();
        this.jumpToEvent(this.favoriteEvents[this.currentIndex]);
    }

    /**
     * Updates the counter text (e.g. "1/8" or "NSW Press · 1/3").
     */
    updateCounter() {
        const counter = document.getElementById('playlist-counter');
        if (counter && this.favoriteEvents.length > 0) {
            const ratio = `${this.currentIndex + 1}/${this.favoriteEvents.length}`;
            counter.textContent = this.activePlaylistName && this.activePlaylistName !== 'Favorites'
                ? `${this.activePlaylistName} · ${ratio}`
                : ratio;
        }
    }

    /**
     * Jumps video player to the event timestamp accounting for pre-roll lead.
     * Sets currentClipEnd for auto-advance.
     * @param {Object} event
     */
    jumpToEvent(event) {
        const videoPlayer = document.getElementById('video-player');
        if (!videoPlayer || !event || event.timeMs === undefined) return;

        const seekTime = getEventSeekSeconds(event);
        this.currentClipEnd = getEventEndSeconds(event);

        videoPlayer.currentTime = seekTime;
        videoPlayer.play().catch(e => console.error("Error playing video:", e));

        if (this.deps.highlightTimelineEvent && event.id) {
            this.deps.highlightTimelineEvent(event.id);
        }

        this.updateOverlay(event);
    }

    /**
     * Automatically monitors video playback in presentation mode.
     * Advances to the next favorite clip when currentTime reaches currentClipEnd.
     * Pauses when the end of the final favorite clip is reached.
     */
    _onTimeUpdate() {
        if (!this.isActive) return;
        const videoPlayer = document.getElementById('video-player');
        if (!videoPlayer || videoPlayer.paused) return;
        if (this.currentClipEnd === null || !this.favoriteEvents || this.favoriteEvents.length === 0) return;

        if (videoPlayer.currentTime >= this.currentClipEnd) {
            if (this.currentIndex < this.favoriteEvents.length - 1) {
                this.navigate('next');
            } else {
                // End of playlist: pause video once at end of final clip (coach can press play to continue)
                videoPlayer.pause();
                this.currentClipEnd = null;
            }
        }
    }

    /**
     * Updates the HUD overlay text when an event plays.
     * @param {Object} event
     */
    updateOverlay(event) {
        const overlay = document.getElementById('presentation-overlay');
        const tag = document.getElementById('presentation-tag');
        const desc = document.getElementById('presentation-description');
        if (!overlay || !tag || !desc) return;

        if (this.isActive && event) {
            tag.textContent = this.deps.formatEventTypeName ? this.deps.formatEventTypeName(event.event) : event.event;
            desc.textContent = event.note || '';
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }
}
