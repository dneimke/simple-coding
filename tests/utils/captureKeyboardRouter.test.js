import {
    hasModifierKey,
    isEditableElement,
    isSpaceShortcut,
    isUndoShortcut,
    isTeamToggleShortcut,
    resolveZoneIndex
} from '../../src/utils/captureKeyboardRouter.js';

describe('captureKeyboardRouter', () => {
    describe('hasModifierKey', () => {
        test('detects ctrlKey, metaKey, and altKey', () => {
            expect(hasModifierKey({ ctrlKey: true })).toBe(true);
            expect(hasModifierKey({ metaKey: true })).toBe(true);
            expect(hasModifierKey({ altKey: true })).toBe(true);
            expect(hasModifierKey({ shiftKey: true })).toBe(false);
            expect(hasModifierKey({})).toBe(false);
        });
    });

    describe('isEditableElement', () => {
        test('identifies input, select, textarea, and contenteditable elements', () => {
            document.body.innerHTML = `
                <input id="inputEl" />
                <textarea id="textareaEl"></textarea>
                <select id="selectEl"></select>
                <div id="editableDiv" contenteditable="true"><span>nested</span></div>
                <div id="plainDiv"><button id="btn">Click</button></div>
            `;
            expect(isEditableElement(document.getElementById('inputEl'))).toBe(true);
            expect(isEditableElement(document.getElementById('textareaEl'))).toBe(true);
            expect(isEditableElement(document.getElementById('selectEl'))).toBe(true);
            expect(isEditableElement(document.querySelector('#editableDiv span'))).toBe(true);
            expect(isEditableElement(document.getElementById('btn'))).toBe(false);
            expect(isEditableElement(null)).toBe(false);
            expect(isEditableElement({})).toBe(false);
        });
    });

    describe('isSpaceShortcut', () => {
        test('returns true for Space code or Space key without modifiers', () => {
            expect(isSpaceShortcut({ code: 'Space', key: ' ' })).toBe(true);
            expect(isSpaceShortcut({ code: 'Space', key: 'Space' })).toBe(true);
            expect(isSpaceShortcut({ code: 'KeyA', key: ' ' })).toBe(true);
            expect(isSpaceShortcut({ code: 'Space', key: ' ', ctrlKey: true })).toBe(false);
            expect(isSpaceShortcut({ code: 'Space', key: ' ', altKey: true })).toBe(false);
            expect(isSpaceShortcut({ code: 'KeyA', key: 'a' })).toBe(false);
        });
    });

    describe('isUndoShortcut', () => {
        test('returns true for Ctrl+Z or Cmd+Z without Shift or Alt', () => {
            expect(isUndoShortcut({ ctrlKey: true, key: 'z' })).toBe(true);
            expect(isUndoShortcut({ metaKey: true, key: 'Z' })).toBe(true);
            expect(isUndoShortcut({ ctrlKey: true, shiftKey: true, key: 'z' })).toBe(false);
            expect(isUndoShortcut({ ctrlKey: true, altKey: true, key: 'z' })).toBe(false);
            expect(isUndoShortcut({ key: 'z' })).toBe(false);
            expect(isUndoShortcut({ ctrlKey: true, key: 'y' })).toBe(false);
        });
    });

    describe('isTeamToggleShortcut', () => {
        test('returns true for t or T without modifiers', () => {
            expect(isTeamToggleShortcut({ key: 't' })).toBe(true);
            expect(isTeamToggleShortcut({ key: 'T' })).toBe(true);
            expect(isTeamToggleShortcut({ key: 't', ctrlKey: true })).toBe(false);
            expect(isTeamToggleShortcut({ key: 'x' })).toBe(false);
        });
    });

    describe('resolveZoneIndex', () => {
        test('maps numeric 1-based string keys to 0-based index within bounds', () => {
            expect(resolveZoneIndex('1', 4)).toBe(0);
            expect(resolveZoneIndex('4', 4)).toBe(3);
            expect(resolveZoneIndex('5', 4)).toBe(-1);
            expect(resolveZoneIndex('0', 4)).toBe(-1);
            expect(resolveZoneIndex('abc', 4)).toBe(-1);
            expect(resolveZoneIndex('1', 0)).toBe(-1);
            expect(resolveZoneIndex('1', null)).toBe(-1);
        });
    });
});
