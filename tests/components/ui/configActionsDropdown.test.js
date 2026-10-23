import { initConfigActionsDropdown } from '../../../src/components/ui/configActionsDropdown.js';

describe('initConfigActionsDropdown', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        container.innerHTML = `
            <div id="configActionsDropdown">
                <button id="configActionsDropdownButton" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="configActionsMenu">
                    <span>Actions</span>
                    <i id="configActionsChevron" class="fas fa-chevron-down"></i>
                </button>
                <div id="configActionsMenu" class="saved-game-menu hidden" role="menu">
                    <button id="renameConfigButton" type="button" role="menuitem">Rename</button>
                    <button id="duplicateBoardMenuItem" type="button" role="menuitem">Duplicate</button>
                    <button id="exportConfigButton" type="button" role="menuitem">Export</button>
                    <button id="importConfigButton" type="button" role="menuitem">Import</button>
                    <button id="toggleConfigModeButton" type="button" role="menuitem">Code</button>
                    <button id="deleteConfigButton" type="button" role="menuitem">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('returns null if elements are not found', () => {
        const emptyDiv = document.createElement('div');
        const dropdown = initConfigActionsDropdown(emptyDiv);
        expect(dropdown).toBeNull();
    });

    test('initializes with closed menu and correct ARIA state', () => {
        const dropdown = initConfigActionsDropdown(container);
        expect(dropdown).not.toBeNull();

        const trigger = container.querySelector('#configActionsDropdownButton');
        const menu = container.querySelector('#configActionsMenu');

        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(menu.classList.contains('hidden')).toBe(true);

        dropdown.destroy();
    });

    test('opens and closes menu when trigger is clicked', () => {
        const dropdown = initConfigActionsDropdown(container);
        const trigger = container.querySelector('#configActionsDropdownButton');
        const menu = container.querySelector('#configActionsMenu');
        const chevron = container.querySelector('#configActionsChevron');

        // Click to open
        trigger.click();
        expect(menu.classList.contains('hidden')).toBe(false);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(chevron.classList.contains('rotate-180')).toBe(true);

        // Click to close
        trigger.click();
        expect(menu.classList.contains('hidden')).toBe(true);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(chevron.classList.contains('rotate-180')).toBe(false);

        dropdown.destroy();
    });

    test('closes menu when clicking outside', () => {
        const dropdown = initConfigActionsDropdown(container);
        const trigger = container.querySelector('#configActionsDropdownButton');
        const menu = container.querySelector('#configActionsMenu');

        trigger.click();
        expect(menu.classList.contains('hidden')).toBe(false);

        // Click outside on document body
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(menu.classList.contains('hidden')).toBe(true);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        dropdown.destroy();
    });

    test('closes menu and refocuses trigger on Escape key', () => {
        const dropdown = initConfigActionsDropdown(container);
        const trigger = container.querySelector('#configActionsDropdownButton');
        const menu = container.querySelector('#configActionsMenu');

        const focusSpy = jest.spyOn(trigger, 'focus');

        trigger.click();
        expect(menu.classList.contains('hidden')).toBe(false);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(menu.classList.contains('hidden')).toBe(true);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(focusSpy).toHaveBeenCalled();

        dropdown.destroy();
    });

    test('closes menu when a menu item is clicked', () => {
        const dropdown = initConfigActionsDropdown(container);
        const trigger = container.querySelector('#configActionsDropdownButton');
        const menu = container.querySelector('#configActionsMenu');
        const menuItem = container.querySelector('#exportConfigButton');

        trigger.click();
        expect(menu.classList.contains('hidden')).toBe(false);

        menuItem.click();
        expect(menu.classList.contains('hidden')).toBe(true);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        dropdown.destroy();
    });
});
