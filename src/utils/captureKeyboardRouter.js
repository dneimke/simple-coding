/**
 * Pure functions for inspecting keyboard events in event capture mode.
 */

/**
 * Returns true if Ctrl, Meta (Cmd), or Alt is held down.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function hasModifierKey(event) {
    return Boolean(event && (event.ctrlKey || event.metaKey || event.altKey));
}

/**
 * Returns true if an input, select, textarea, or contenteditable target is active.
 * @param {EventTarget} target
 * @returns {boolean}
 */
export function isEditableElement(target) {
    if (!target || !(target instanceof Element)) return false;
    return Boolean(target.closest('input, select, textarea, [contenteditable="true"]'));
}

/**
 * Checks if the spacebar shortcut was pressed without modifiers.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function isSpaceShortcut(event) {
    if (!event || hasModifierKey(event)) return false;
    return event.code === 'Space' || event.key === ' ';
}

/**
 * Checks if Ctrl+Z / Cmd+Z was pressed without Alt or Shift.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function isUndoShortcut(event) {
    if (!event) return false;
    const hasCtrlOrMeta = Boolean(event.ctrlKey || event.metaKey);
    if (!hasCtrlOrMeta || event.altKey || event.shiftKey) return false;
    return String(event.key).toLowerCase() === 'z';
}

/**
 * Checks if 't' or 'T' was pressed without modifiers.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function isTeamToggleShortcut(event) {
    if (!event || hasModifierKey(event)) return false;
    return event.key === 't' || event.key === 'T';
}

/**
 * Resolves the 0-based index for zone hotkeys '1', '2', etc. within available zone count.
 * Returns -1 if key is not a valid zone number.
 * @param {string} key
 * @param {number} zoneCount
 * @returns {number}
 */
export function resolveZoneIndex(key, zoneCount) {
    if (typeof zoneCount !== 'number' || zoneCount <= 0) return -1;
    const num = Number(key);
    if (!Number.isInteger(num)) return -1;
    const index = num - 1;
    return index >= 0 && index < zoneCount ? index : -1;
}
