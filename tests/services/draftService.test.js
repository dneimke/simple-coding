import { draftService, finishCapture, DRAFT_STORAGE_KEY } from '../../src/services/draftService.js';
import { storageService } from '../../src/services/storageService.js';
import { notificationService } from '../../src/services/notificationService.js';

jest.mock('../../src/services/storageService.js', () => ({
    storageService: {
        getItem: jest.fn(),
        setItem: jest.fn(() => true),
        removeItem: jest.fn(() => true)
    }
}));

jest.mock('../../src/services/notificationService.js', () => ({
    notificationService: { notify: jest.fn() }
}));

beforeEach(() => {
    jest.clearAllMocks();
    storageService.setItem.mockImplementation(() => true);
    draftService._writeFailureNotified = false;
});

describe('draftService', () => {
    test('saveDraft writes events, banked time, and runningSince with a timestamp', () => {
        const events = [{ event: 'GOAL', timeMs: 1000 }];

        expect(draftService.saveDraft({ events, elapsedTime: 5000, runningSince: 123 })).toBe(true);

        const [key, value] = storageService.setItem.mock.calls[0];
        expect(key).toBe(DRAFT_STORAGE_KEY);
        expect(value).toEqual(expect.objectContaining({ events, elapsedTime: 5000, runningSince: 123 }));
        expect(typeof value.updatedAt).toBe('number');
    });

    test('loadDraft returns the stored draft', () => {
        storageService.getItem.mockReturnValue({
            events: [{ event: 'GOAL', timeMs: 1000 }],
            elapsedTime: 5000,
            runningSince: null,
            updatedAt: 42
        });

        expect(draftService.loadDraft()).toEqual({
            events: [{ event: 'GOAL', timeMs: 1000 }],
            elapsedTime: 5000,
            runningSince: null,
            updatedAt: 42
        });
    });

    test('loadDraft returns null when nothing or something malformed is stored', () => {
        storageService.getItem.mockReturnValue(null);
        expect(draftService.loadDraft()).toBeNull();

        storageService.getItem.mockReturnValue({ elapsedTime: 10 });
        expect(draftService.loadDraft()).toBeNull();
    });

    test('clearDraft removes the draft key', () => {
        draftService.clearDraft();
        expect(storageService.removeItem).toHaveBeenCalledWith(DRAFT_STORAGE_KEY);
    });

    test('a failed write notifies once per session', () => {
        storageService.setItem.mockReturnValue({ success: false, message: 'quota' });
        const draft = { events: [], elapsedTime: 0, runningSince: null };

        expect(draftService.saveDraft(draft)).toBe(false);
        expect(draftService.saveDraft(draft)).toBe(false);
        expect(notificationService.notify).toHaveBeenCalledTimes(1);
    });
});

describe('finishCapture', () => {
    const snapshot = { events: [], elapsedTime: 0, timestamp: 't' };

    test('clears the draft after a successful save', () => {
        const manager = { saveGame: jest.fn(() => true) };

        expect(finishCapture(snapshot, manager)).toEqual({ success: true });
        expect(manager.saveGame).toHaveBeenCalledWith(snapshot);
        expect(storageService.removeItem).toHaveBeenCalledWith(DRAFT_STORAGE_KEY);
    });

    test('keeps the draft when saveGame returns an error', () => {
        const manager = { saveGame: jest.fn(() => ({ success: false, message: 'Browser storage limit exceeded' })) };

        expect(finishCapture(snapshot, manager)).toEqual({ success: false, message: 'Browser storage limit exceeded' });
        expect(storageService.removeItem).not.toHaveBeenCalled();
    });

    test('keeps the draft when saveGame throws', () => {
        const manager = { saveGame: jest.fn(() => { throw new Error('Storage quota exceeded.'); }) };

        expect(finishCapture(snapshot, manager)).toEqual({ success: false, message: 'Storage quota exceeded.' });
        expect(storageService.removeItem).not.toHaveBeenCalled();
    });
});
