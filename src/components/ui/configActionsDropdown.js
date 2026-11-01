/**
 * Board Actions dropdown handler for the Configure view
 * @module components/ui/configActionsDropdown
 */
import { createDropdownController } from './dropdownController.js';

/**
 * Initializes the Board Actions dropdown menu behavior
 * @param {Document|HTMLElement} [root=document] - Root container or document
 * @returns {{ open: Function, close: Function, toggle: Function, destroy: Function } | null}
 */
export function initConfigActionsDropdown(root = document) {
    return createDropdownController({
        triggerId: 'configActionsDropdownButton',
        menuId: 'configActionsMenu',
        chevronId: 'configActionsChevron',
        root
    });
}
