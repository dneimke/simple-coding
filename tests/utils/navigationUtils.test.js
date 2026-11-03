import { resolveInitialView, parseHelpJumpTargetId } from '../../src/utils/navigationUtils.js';

describe('navigationUtils', () => {
    describe('resolveInitialView', () => {
        test('resolves Config view from query param or hash', () => {
            expect(resolveInitialView('?view=config', '', '')).toBe('Config');
            expect(resolveInitialView('', '#configure', '')).toBe('Config');
            expect(resolveInitialView('', '#configure?foo=bar', '')).toBe('Config');
        });

        test('resolves Help view from query param or hash', () => {
            expect(resolveInitialView('?view=help', '', '')).toBe('Help');
            expect(resolveInitialView('', '#help', '')).toBe('Help');
            expect(resolveInitialView('', '#help/section', '')).toBe('Help');
        });

        test('resolves EventCapture view from mock params, view param, or dev preview pathname', () => {
            expect(resolveInitialView('?mock=active', '', '')).toBe('EventCapture');
            expect(resolveInitialView('?mock=pc-counter', '', '')).toBe('EventCapture');
            expect(resolveInitialView('?mock=armed', '', '')).toBe('EventCapture');
            expect(resolveInitialView('?view=event-capture', '', '')).toBe('EventCapture');
            expect(resolveInitialView('', '#event-capture', '')).toBe('EventCapture');
            expect(resolveInitialView('', '', '/dev/preview')).toBe('EventCapture');
        });

        test('resolves Log view from query param or hash', () => {
            expect(resolveInitialView('?view=log', '', '')).toBe('Log');
            expect(resolveInitialView('', '#log', '')).toBe('Log');
            expect(resolveInitialView('', '#log/game-123', '')).toBe('Log');
        });

        test('defaults to SavedGames view when no matching parameters are present', () => {
            expect(resolveInitialView('', '', '')).toBe('SavedGames');
            expect(resolveInitialView('?other=1', '#unknown', '/index.html')).toBe('SavedGames');
        });
    });

    describe('parseHelpJumpTargetId', () => {
        test('extracts direct hash target ID', () => {
            expect(parseHelpJumpTargetId('#help-configuration-title')).toBe('help-configuration-title');
            expect(parseHelpJumpTargetId('/index.html#help-sweep-metadata-title')).toBe('help-sweep-metadata-title');
        });

        test('extracts slash-prefixed target ID', () => {
            expect(parseHelpJumpTargetId('#help/help-configuration-title')).toBe('help-configuration-title');
        });

        test('strips query parameters from target ID', () => {
            expect(parseHelpJumpTargetId('#help-configuration-title?mock=sample')).toBe('help-configuration-title');
        });

        test('returns null for invalid or missing hash', () => {
            expect(parseHelpJumpTargetId('')).toBeNull();
            expect(parseHelpJumpTargetId('/no-hash-here')).toBeNull();
            expect(parseHelpJumpTargetId(null)).toBeNull();
        });
    });
});
