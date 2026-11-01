/**
 * Generic accessible dropdown controller for action menus
 * @module components/ui/dropdownController
 */

/**
 * Creates and initializes an accessible dropdown menu controller
 * @param {Object} options
 * @param {string} options.triggerId - ID of trigger button
 * @param {string} options.menuId - ID of dropdown menu
 * @param {string} [options.chevronId] - Optional chevron icon ID to toggle rotation
 * @param {Document|HTMLElement} [options.root=document] - Root container or document
 * @returns {{ open: Function, close: Function, toggle: Function, destroy: Function } | null}
 */
export function createDropdownController({ triggerId, menuId, chevronId = null, root = document } = {}) {
    const trigger = root.getElementById ? root.getElementById(triggerId) : root.querySelector(`#${triggerId}`);
    const menu = root.getElementById ? root.getElementById(menuId) : root.querySelector(`#${menuId}`);
    const chevron = chevronId
        ? (root.getElementById ? root.getElementById(chevronId) : root.querySelector(`#${chevronId}`))
        : null;

    if (!trigger || !menu) return null;

    const open = () => {
        menu.classList.remove('hidden');
        trigger.setAttribute('aria-expanded', 'true');
        if (chevron) chevron.classList.add('rotate-180');
    };

    const close = () => {
        menu.classList.add('hidden');
        trigger.setAttribute('aria-expanded', 'false');
        if (chevron) chevron.classList.remove('rotate-180');
    };

    const toggle = () => {
        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
            close();
        } else {
            open();
        }
    };

    const handleTriggerClick = (e) => {
        e.stopPropagation();
        toggle();
    };

    const handleDocumentClick = (e) => {
        if (!trigger.contains(e.target) && !menu.contains(e.target)) {
            close();
        }
    };

    const handleDocumentKeydown = (e) => {
        if (e.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
            close();
            trigger.focus();
        }
    };

    const menuItems = menu.querySelectorAll('[role="menuitem"]');
    const handleMenuItemClick = () => {
        close();
    };

    trigger.addEventListener('click', handleTriggerClick);
    const doc = root.ownerDocument || root;
    doc.addEventListener('click', handleDocumentClick);
    doc.addEventListener('keydown', handleDocumentKeydown);
    menuItems.forEach((item) => item.addEventListener('click', handleMenuItemClick));

    const destroy = () => {
        trigger.removeEventListener('click', handleTriggerClick);
        doc.removeEventListener('click', handleDocumentClick);
        doc.removeEventListener('keydown', handleDocumentKeydown);
        menuItems.forEach((item) => item.removeEventListener('click', handleMenuItemClick));
    };

    return { open, close, toggle, destroy };
}
