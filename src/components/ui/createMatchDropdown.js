/**
 * Create Match dropdown handler
 * @module components/ui/createMatchDropdown
 */

/**
 * Initializes the Create Match dropdown menu behavior
 * @param {Document|HTMLElement} [root=document] - Root container or document
 * @returns {{ open: Function, close: Function, toggle: Function, destroy: Function } | null}
 */
export function initCreateMatchDropdown(root = document) {
    const trigger = root.getElementById ? root.getElementById('createMatchDropdownButton') : root.querySelector('#createMatchDropdownButton');
    const menu = root.getElementById ? root.getElementById('createMatchMenu') : root.querySelector('#createMatchMenu');
    const chevron = root.getElementById ? root.getElementById('createMatchChevron') : root.querySelector('#createMatchChevron');

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
