/**
 * Presentation Mode & Playlist Controller
 * Powers browser-native continuous playlist seeking for starred/favorite events (Friction 3).
 * Zero re-render overhead.
 */

import { formatTime } from '../utils/formatUtils.js';

/**
 * Controller class managing favorite events playlist and presentation mode HUD.
 */
export class PresentationController {
    constructor(deps = {}) {
        this.deps = deps; // { formatEventTypeName, setFavoritesOnly, showNotification }
        this.isActive = false;
        this.favoriteEvents = [];
        this.currentIndex = 0;
    }

    /**
     * Initializes DOM event handlers for presentation mode buttons.
     */
    init() {
        const presentationModeBtn = document.getElementById('presentation-mode');
        const playlistControls = document.getElementById('playlist-controls');
        const prevFavoriteBtn = document.getElementById('prev-favorite');
        const nextFavoriteBtn = document.getElementById('next-favorite');

        if (presentationModeBtn && playlistControls) {
            presentationModeBtn.addEventListener('click', () => {
                this.toggle();
            });

            if (prevFavoriteBtn && nextFavoriteBtn) {
                prevFavoriteBtn.addEventListener('click', () => {
                    this.navigate('previous');
                });

                nextFavoriteBtn.addEventListener('click', () => {
                    this.navigate('next');
                });
            }
        }
    }

    /**
     * Activates presentation view layout and jumps to the first favorite.
     */
    _enterPresentation(timelineEvents) {
        this.favoriteEvents = (timelineEvents || []).filter(e => e.isFavorite);
        this.favoriteEvents.forEach((evt, idx) => {
            if (!evt.id) evt.id = `event-fav-${idx}`;
        });

        if (this.favoriteEvents.length === 0) {
            if (this.deps.showNotification) {
                this.deps.showNotification('Add some favorites first to start a presentation', 'warning');
            }
            this.isActive = false;
            return;
        }

        const presentationModeBtn = document.getElementById('presentation-mode');
        const playlistControls = document.getElementById('playlist-controls');
        const timelineContainer = document.getElementById('timeline-container');

        if (presentationModeBtn) {
            presentationModeBtn.classList.add('is-active');
            presentationModeBtn.setAttribute('aria-pressed', 'true');
        }
        if (playlistControls) playlistControls.classList.replace('hidden', 'flex');
        if (timelineContainer) timelineContainer.classList.add('hidden');

        this.currentIndex = 0;
        this.updateCounter();

        if (this.deps.setFavoritesOnly) {
            this.deps.setFavoritesOnly(true);
        }

        if (this.favoriteEvents.length > 0) {
            setTimeout(() => {
                this.jumpToEvent(this.favoriteEvents[0]);
            }, 50);
        }
    }

    /**
     * Deactivates presentation view and restores original timeline controls.
     */
    _exitPresentation() {
        const presentationModeBtn = document.getElementById('presentation-mode');
        const playlistControls = document.getElementById('playlist-controls');
        const timelineContainer = document.getElementById('timeline-container');

        if (presentationModeBtn) {
            presentationModeBtn.classList.remove('is-active');
            presentationModeBtn.setAttribute('aria-pressed', 'false');
        }
        if (playlistControls) playlistControls.classList.replace('flex', 'hidden');
        if (timelineContainer) timelineContainer.classList.remove('hidden');

        this.updateOverlay(null);
    }

    /**
     * Toggles between presentation mode and normal editing mode.
     * @param {Array} timelineEvents - Current full event list
     */
    toggle(timelineEvents = []) {
        this.isActive = !this.isActive;
        if (this.isActive) {
            this._enterPresentation(timelineEvents);
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
     * Updates the counter text (e.g. "1/8").
     */
    updateCounter() {
        const counter = document.getElementById('playlist-counter');
        if (counter && this.favoriteEvents.length > 0) {
            counter.textContent = `${this.currentIndex + 1}/${this.favoriteEvents.length}`;
        }
    }

    /**
     * Jumps video player to the event timestamp.
     * @param {Object} event
     */
    jumpToEvent(event) {
        const videoPlayer = document.getElementById('video-player');
        if (!videoPlayer || !event || event.timeMs === undefined) return;

        const timeSeconds = event.timeMs / 1000;
        videoPlayer.currentTime = timeSeconds;
        videoPlayer.play().catch(e => console.error("Error playing video:", e));

        if (this.deps.highlightTimelineEvent && event.id) {
            this.deps.highlightTimelineEvent(event.id);
        }

        this.updateOverlay(event);
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
