/**
 * @jest-environment jsdom
 */

import {
    PresentationController,
    DEFAULT_LEAD_SECONDS,
    DEFAULT_LAG_SECONDS,
    getEventLeadSeconds,
    getEventLagSeconds,
    getEventSeekSeconds,
    getEventEndSeconds
} from '../../src/js/presentationController.js';

describe('PresentationController & Playlist Continuous Seeking (Friction 3)', () => {
    let videoPlayer;
    let presentationModeBtn;
    let playlistControls;
    let prevFavoriteBtn;
    let nextFavoriteBtn;
    let playlistCounter;
    let presentationOverlay;
    let presentationTag;
    let presentationDescription;
    let timelineContainer;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="timeline-container"></div>
            <button id="presentation-mode" type="button"></button>
            <div id="playlist-controls" class="hidden">
                <button id="prev-favorite" type="button"></button>
                <span id="playlist-counter">0/0</span>
                <button id="next-favorite" type="button"></button>
            </div>
            <div id="presentation-overlay" class="hidden">
                <h3 id="presentation-tag"></h3>
                <p id="presentation-description"></p>
            </div>
            <video id="video-player"></video>
        `;

        videoPlayer = document.getElementById('video-player');
        presentationModeBtn = document.getElementById('presentation-mode');
        playlistControls = document.getElementById('playlist-controls');
        prevFavoriteBtn = document.getElementById('prev-favorite');
        nextFavoriteBtn = document.getElementById('next-favorite');
        playlistCounter = document.getElementById('playlist-counter');
        presentationOverlay = document.getElementById('presentation-overlay');
        presentationTag = document.getElementById('presentation-tag');
        presentationDescription = document.getElementById('presentation-description');
        timelineContainer = document.getElementById('timeline-container');

        // Mock HTMLVideoElement methods in jsdom
        videoPlayer.play = jest.fn().mockImplementation(() => {
            videoPlayer.paused = false;
            return Promise.resolve();
        });
        videoPlayer.pause = jest.fn().mockImplementation(() => {
            videoPlayer.paused = true;
        });
        videoPlayer.currentTime = 0;
        let isPaused = true;
        Object.defineProperty(videoPlayer, 'paused', {
            get: () => isPaused,
            set: (val) => { isPaused = Boolean(val); },
            configurable: true
        });
    });

    describe('Lead/Lag and Seek Calculation Utilities', () => {
        test('getEventLeadSeconds extracts lead or falls back to default 5s', () => {
            expect(getEventLeadSeconds({ lead: 15 })).toBe(15);
            expect(getEventLeadSeconds({ leadTime: 10 })).toBe(10);
            expect(getEventLeadSeconds({ lead: 0 })).toBe(0);
            expect(getEventLeadSeconds({})).toBe(DEFAULT_LEAD_SECONDS);
            expect(getEventLeadSeconds(null)).toBe(DEFAULT_LEAD_SECONDS);
        });

        test('getEventLagSeconds extracts lag or falls back to default 5s', () => {
            expect(getEventLagSeconds({ lag: 10 })).toBe(10);
            expect(getEventLagSeconds({ lagTime: 8 })).toBe(8);
            expect(getEventLagSeconds({ lag: 0 })).toBe(0);
            expect(getEventLagSeconds({})).toBe(DEFAULT_LAG_SECONDS);
            expect(getEventLagSeconds(null)).toBe(DEFAULT_LAG_SECONDS);
        });

        test('getEventSeekSeconds calculates Math.max(0, eventSeconds - lead)', () => {
            // 615s (10:15) with 15s lead seeks to 600s (10:00)
            expect(getEventSeekSeconds({ timeMs: 615000, lead: 15 })).toBe(600);
            // Early event at 3s with 5s lead clamps to 0s
            expect(getEventSeekSeconds({ timeMs: 3000, lead: 5 })).toBe(0);
            // Default lead of 5s applies when omitted
            expect(getEventSeekSeconds({ timeMs: 30000 })).toBe(25);
            expect(getEventSeekSeconds(null)).toBe(0);
        });

        test('getEventEndSeconds calculates eventSeconds + lag', () => {
            // 615s with 5s lag ends at 620s
            expect(getEventEndSeconds({ timeMs: 615000, lag: 5 })).toBe(620);
            // Default lag of 5s applies when omitted
            expect(getEventEndSeconds({ timeMs: 30000 })).toBe(35);
            expect(getEventEndSeconds(null)).toBe(0);
        });
    });

    describe('Journey 1: Seeking an event opens the build-up window (Issue #72)', () => {
        test('GIVEN an event with timestamp 10:15 (615s) and lead 15s WHEN jumped to THEN seeks to 10:00 (600s)', () => {
            const controller = new PresentationController();
            const event = { id: 'e1', event: 'FIRE GOAL', timeMs: 615000, lead: 15, lag: 5, note: 'Great deflection' };

            controller.jumpToEvent(event);

            expect(videoPlayer.currentTime).toBe(600);
            expect(videoPlayer.play).toHaveBeenCalled();
            expect(controller.currentClipEnd).toBe(620);
        });

        test('GIVEN an event near start of match (3s) with lead 5s WHEN jumped to THEN safely clamps to 0s', () => {
            const controller = new PresentationController();
            const event = { id: 'e0', event: 'START', timeMs: 3000, lead: 5, lag: 2 };

            controller.jumpToEvent(event);

            expect(videoPlayer.currentTime).toBe(0);
            expect(controller.currentClipEnd).toBe(5);
        });
    });

    describe('Journey 2: Presentation mode auto-advances through playlist (Issue #72)', () => {
        test('GIVEN Presentation Mode with 3 favorite clips WHEN playback crosses time + lag THEN auto-advances to next clip', () => {
            const highlightMock = jest.fn();
            const controller = new PresentationController({ highlightTimelineEvent: highlightMock });
            controller.init();

            const timelineEvents = [
                { id: 'fav1', event: 'FIRE CE', timeMs: 100000, lead: 5, lag: 10, isFavorite: true }, // window: 95s -> 110s
                { id: 'fav2', event: 'FIRE SHOT', timeMs: 200000, lead: 15, lag: 5, isFavorite: true }, // window: 185s -> 205s
                { id: 'fav3', event: 'FIRE GOAL', timeMs: 300000, lead: 15, lag: 5, isFavorite: true }  // window: 285s -> 305s
            ];

            controller.toggle(timelineEvents);

            expect(controller.isActive).toBe(true);
            expect(controller.currentIndex).toBe(0);
            expect(playlistCounter.textContent).toBe('1/3');
            expect(timelineContainer.classList.contains('hidden')).toBe(true);
            expect(playlistControls.classList.contains('hidden')).toBe(false);

            // First clip is playing: window [95s, 110s]
            expect(videoPlayer.currentTime).toBe(95);
            expect(controller.currentClipEnd).toBe(110);

            // Simulate playback at 105s (still within clip 1)
            videoPlayer.currentTime = 105;
            videoPlayer.paused = false;
            videoPlayer.dispatchEvent(new Event('timeupdate'));

            expect(controller.currentIndex).toBe(0);
            expect(playlistCounter.textContent).toBe('1/3');

            // Simulate video advancing past lag window at 110.1s
            videoPlayer.currentTime = 110.1;
            videoPlayer.dispatchEvent(new Event('timeupdate'));

            // Auto-advance must jump to clip 2 (fav2) at its time - lead (200 - 15 = 185s)
            expect(controller.currentIndex).toBe(1);
            expect(playlistCounter.textContent).toBe('2/3');
            expect(videoPlayer.currentTime).toBe(185);
            expect(controller.currentClipEnd).toBe(205);
            expect(highlightMock).toHaveBeenCalledWith('fav2');
        });
    });

    describe('Journey 3: Respects coach manual pauses and scrubbing', () => {
        test('GIVEN Presentation Mode WHEN video is paused THEN auto-advance does NOT fire even if currentTime >= clipEnd', () => {
            const controller = new PresentationController();
            controller.init();

            const timelineEvents = [
                { id: 'fav1', event: 'FIRE CE', timeMs: 100000, lead: 5, lag: 10, isFavorite: true },
                { id: 'fav2', event: 'FIRE SHOT', timeMs: 200000, lead: 15, lag: 5, isFavorite: true }
            ];

            controller.toggle(timelineEvents);
            expect(controller.currentIndex).toBe(0);

            // Coach paused the video to explain
            videoPlayer.paused = true;
            videoPlayer.currentTime = 115; // Past clipEnd (110s)
            videoPlayer.dispatchEvent(new Event('timeupdate'));

            // Must NOT advance while paused!
            expect(controller.currentIndex).toBe(0);
            expect(playlistCounter.textContent).toBe('1/2');
        });

        test('GIVEN Presentation Mode WHEN coach scrubs backward within clip THEN playback continues until new clipEnd is reached', () => {
            const controller = new PresentationController();
            controller.init();

            const timelineEvents = [
                { id: 'fav1', event: 'FIRE CE', timeMs: 100000, lead: 5, lag: 10, isFavorite: true },
                { id: 'fav2', event: 'FIRE SHOT', timeMs: 200000, lead: 15, lag: 5, isFavorite: true }
            ];

            controller.toggle(timelineEvents);
            videoPlayer.paused = false;

            // Coach scrubs backward to replay action at 97s
            videoPlayer.currentTime = 97;
            videoPlayer.dispatchEvent(new Event('timeupdate'));
            expect(controller.currentIndex).toBe(0);

            // Video advances back to end of clip at 110s
            videoPlayer.currentTime = 110;
            videoPlayer.dispatchEvent(new Event('timeupdate'));

            // Auto-advances to clip 2
            expect(controller.currentIndex).toBe(1);
        });
    });

    describe('Journey 4: Playlist finishes cleanly at end of last clip (Decision A1 & A2)', () => {
        test('GIVEN Presentation Mode at final clip WHEN video reaches time + lag THEN video pauses and allows coach to continue', () => {
            const controller = new PresentationController();
            controller.init();

            const timelineEvents = [
                { id: 'fav1', event: 'FIRE CE', timeMs: 100000, lead: 5, lag: 10, isFavorite: true },
                { id: 'fav2', event: 'FIRE GOAL', timeMs: 200000, lead: 15, lag: 5, isFavorite: true }
            ];

            controller.toggle(timelineEvents);

            // Advance to last clip (index 1)
            controller.navigate('next');
            expect(controller.currentIndex).toBe(1);
            expect(videoPlayer.currentTime).toBe(185);
            expect(controller.currentClipEnd).toBe(205);

            // Playback reaches end of final clip at 205s
            videoPlayer.paused = false;
            videoPlayer.currentTime = 205.1;
            videoPlayer.dispatchEvent(new Event('timeupdate'));

            // Must pause at end of final clip
            expect(videoPlayer.pause).toHaveBeenCalled();
            expect(controller.currentIndex).toBe(1);
            // currentClipEnd is cleared so if coach taps play, video can continue without jitter
            expect(controller.currentClipEnd).toBeNull();
        });
    });

    describe('Journey 5: Clean exit and teardown', () => {
        test('GIVEN active Presentation Mode WHEN toggled off THEN listener is removed and overlay is hidden', () => {
            const controller = new PresentationController();
            controller.init();

            const timelineEvents = [
                { id: 'fav1', event: 'FIRE CE', timeMs: 100000, lead: 5, lag: 10, isFavorite: true }
            ];

            controller.toggle(timelineEvents);
            expect(controller.isActive).toBe(true);

            // Toggle off
            controller.toggle();
            expect(controller.isActive).toBe(false);
            expect(presentationOverlay.classList.contains('hidden')).toBe(true);
            expect(timelineContainer.classList.contains('hidden')).toBe(false);

            // Further timeupdates must not trigger anything
            videoPlayer.currentTime = 120;
            videoPlayer.paused = false;
            videoPlayer.dispatchEvent(new Event('timeupdate'));
            expect(controller.currentIndex).toBe(0);
        });
    });
});
