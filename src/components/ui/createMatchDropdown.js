/**
 * Create Match dropdown handler
 * @module components/ui/createMatchDropdown
 */
import { createDropdownController } from './dropdownController.js';

/**
 * Initializes the Create Match dropdown menu behavior
 * @param {Document|HTMLElement} [root=document] - Root container or document
 * @returns {{ open: Function, close: Function, toggle: Function, destroy: Function } | null}
 */
export function initCreateMatchDropdown(root = document) {
    return createDropdownController({
        triggerId: 'createMatchDropdownButton',
        menuId: 'createMatchMenu',
        chevronId: 'createMatchChevron',
        root
    });
}
