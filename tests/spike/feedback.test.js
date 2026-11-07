/**
 * @jest-environment jsdom
 */

import {
    createFeedbackStore,
    formatFeedbackMarkdown,
    exportFeedbackJson,
    renderFeedbackBar,
    openFeedbackModal
} from '../../src/spike/sequences/feedback.js';

describe('sequence feedback module', () => {
    test('store manages feedback items and persists to storage', () => {
        let storageData = {};
        const mockStorage = {
            getItem: (k) => storageData[k] || null,
            setItem: (k, v) => { storageData[k] = String(v); },
            removeItem: (k) => { delete storageData[k]; }
        };

        const store = createFeedbackStore(mockStorage, 'test-match');
        expect(store.count()).toBe(0);
        expect(store.has('entry-1')).toBe(false);

        let notified = false;
        const unsubscribe = store.subscribe(() => { notified = true; });

        store.set({
            id: 'entry-1',
            eventId: '97',
            team: 'PRIDE',
            entryType: 'CE',
            clockText: 'match 16:07',
            videoTime: '16:07',
            currentSeek: '15:50',
            currentSeekSeconds: 950,
            originType: 'Counter',
            reason: '7s after BW2',
            chain: 'BW2 → A25E → CE',
            issues: ['Timing too late (missed turnover / leadup)'],
            suggestedSeek: '15:45',
            suggestedOrigin: 'Counter',
            coachNotes: 'Ball won by intercept at 15:55, need 10s lead.'
        });

        expect(notified).toBe(true);
        expect(store.count()).toBe(1);
        expect(store.has('entry-1')).toBe(true);
        expect(store.get('entry-1').suggestedSeek).toBe('15:45');

        // Test persistence reload
        const reloadedStore = createFeedbackStore(mockStorage, 'test-match');
        expect(reloadedStore.count()).toBe(1);
        expect(reloadedStore.get('entry-1').team).toBe('PRIDE');

        // Remove item
        store.remove('entry-1');
        expect(store.count()).toBe(0);

        unsubscribe();
    });

    test('formatFeedbackMarkdown formats batch into actionable markdown', () => {
        const items = [
            {
                id: 'entry-1',
                team: 'PRIDE',
                entryType: 'CE',
                clockText: 'match 16:07',
                videoTime: '16:07',
                currentSeek: '16:00',
                originType: 'Counter',
                reason: '7s after BW2',
                chain: 'BW2 → A25E → CE',
                issues: ['Timing too late (missed turnover / leadup)'],
                suggestedSeek: '15:50',
                suggestedOrigin: 'Counter',
                coachNotes: 'Ball won at 15:55 by intercept, need 5s lead.'
            }
        ];

        const md = formatFeedbackMarkdown(items, 'FIRE vs PRIDE');
        expect(md).toContain('### 🚩 Sequence Feedback Batch (1 item)');
        expect(md).toContain('**Match:** FIRE vs PRIDE');
        expect(md).toContain('**PRIDE CE** · match 16:07 (video 16:07)');
        expect(md).toContain('- **Current:** Counter (7s after BW2) · Seek 16:00');
        expect(md).toContain('- **Issues:** Timing too late (missed turnover / leadup)');
        expect(md).toContain('- **Suggested Seek:** 15:50');
        expect(md).toContain('- **Coach Note:** Ball won at 15:55 by intercept, need 5s lead.');
        expect(md).toContain('- **Chain:** BW2 → A25E → CE');

        expect(formatFeedbackMarkdown([])).toBe('No feedback items flagged.');
    });

    test('exportFeedbackJson produces valid JSON with metadata', () => {
        const items = [{ id: 'entry-1', team: 'FIRE', entryType: 'A25E' }];
        const jsonStr = exportFeedbackJson(items, 'Test Game');
        const parsed = JSON.parse(jsonStr);
        expect(parsed.match).toBe('Test Game');
        expect(parsed.count).toBe(1);
        expect(parsed.items[0].id).toBe('entry-1');
    });

    test('renderFeedbackBar updates badge and action button states', () => {
        const container = document.createElement('div');
        const store = createFeedbackStore(null, 'mem-match');

        renderFeedbackBar(container, store, { gameLabel: 'Sample Match' });

        const badge = container.querySelector('#feedback-count-badge');
        const copyBtn = container.querySelector('#copy-feedback-btn');
        const jsonBtn = container.querySelector('#download-feedback-json-btn');
        const clearBtn = container.querySelector('#clear-feedback-btn');

        expect(badge.textContent.trim()).toBe('0 items');
        expect(copyBtn.disabled).toBe(true);
        expect(jsonBtn.disabled).toBe(true);
        expect(clearBtn.disabled).toBe(true);

        // Add item to store
        store.set({
            id: 'e1',
            team: 'FIRE',
            entryType: 'CE',
            clockText: 'Q1 05:00',
            videoTime: '05:00',
            currentSeek: '04:50',
            originType: 'Build-Up'
        });

        const updatedBadge = container.querySelector('#feedback-count-badge');
        const updatedCopyBtn = container.querySelector('#copy-feedback-btn');
        const updatedJsonBtn = container.querySelector('#download-feedback-json-btn');
        const updatedClearBtn = container.querySelector('#clear-feedback-btn');

        expect(updatedBadge.textContent.trim()).toBe('1 item');
        expect(updatedCopyBtn.disabled).toBe(false);
        expect(updatedJsonBtn.disabled).toBe(false);
        expect(updatedClearBtn.disabled).toBe(false);
    });

    test('openFeedbackModal renders modal and saves feedback form', () => {
        const store = createFeedbackStore(null, 'mem-match-2');
        const entry = {
            id: 'entry-97',
            eventId: '97',
            team: 'PRIDE',
            entryType: 'CE',
            matchClock: '16:07',
            videoTime: '16:07',
            seekSeconds: 950,
            originType: 'Counter',
            reason: '7s after BW2',
            codes: ['BW2', 'A25E', 'CE']
        };

        const mockVideo = { currentTime: 952 };
        openFeedbackModal(document, entry, mockVideo, store);

        const modal = document.getElementById('sequence-feedback-modal');
        expect(modal).not.toBeNull();
        expect(modal.textContent).toContain('PRIDE CE');

        // Check quick time buttons
        const earlierBtn = modal.querySelector('.quick-time-btn[data-time="15:45"]');
        expect(earlierBtn).not.toBeNull();
        earlierBtn.click();

        const seekInput = modal.querySelector('#suggested-seek-input');
        expect(seekInput.value).toBe('15:45');

        // Check issue checkbox
        const issueCb = modal.querySelector('input[value="Timing too late (missed turnover / leadup)"]');
        expect(issueCb).not.toBeNull();
        issueCb.checked = true;

        // Type notes
        const notesArea = modal.querySelector('textarea[name="coachNotes"]');
        notesArea.value = 'Need earlier seek';

        // Submit form
        const form = modal.querySelector('#feedback-form');
        form.dispatchEvent(new Event('submit', { cancelable: true }));

        // Modal closed and item saved in store
        expect(document.getElementById('sequence-feedback-modal')).toBeNull();
        expect(store.count()).toBe(1);
        const saved = store.get('entry-97');
        expect(saved.suggestedSeek).toBe('15:45');
        expect(saved.issues).toContain('Timing too late (missed turnover / leadup)');
        expect(saved.coachNotes).toBe('Need earlier seek');
    });
});
