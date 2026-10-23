import fs from 'fs';
import path from 'path';
import { initCreateMatchDropdown } from '../../src/components/ui/createMatchDropdown.js';

describe('Create Match Dropdown Component', () => {
    let container;

    beforeEach(() => {
        const filePath = path.resolve(process.cwd(), 'src/index.html');
        const html = fs.readFileSync(filePath, 'utf8');
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        container = doc;
    });

    test('replaces the three separate action buttons with a single "Create Match" dropdown trigger', () => {
        const trigger = container.querySelector('#createMatchDropdownButton');
        expect(trigger).not.toBeNull();
        expect(trigger.textContent).toContain('Create Match');
        expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    test('contains a dropdown menu with the three creation modes', () => {
        const menu = container.querySelector('#createMatchMenu');
        expect(menu).not.toBeNull();
        expect(menu.getAttribute('role')).toBe('menu');
        expect(menu.classList.contains('hidden')).toBe(true);

        const liveMatchItem = menu.querySelector('#startLiveMatchButton');
        const fromVideoItem = menu.querySelector('#codeFromVideoButton');
        const importXmlItem = menu.querySelector('#importXmlButton');

        expect(liveMatchItem).not.toBeNull();
        expect(liveMatchItem.getAttribute('href')).toBe('#event-capture');
        expect(liveMatchItem.textContent).toContain('Live Match');

        expect(fromVideoItem).not.toBeNull();
        expect(fromVideoItem.getAttribute('href')).toBe('timeline-video.html?new=video');
        expect(fromVideoItem.textContent).toContain('From Video');

        expect(importXmlItem).not.toBeNull();
        expect(importXmlItem.textContent).toContain('Import XML');
    });

    describe('Interactive Behavior', () => {
        let trigger;
        let menu;
        let controller;

        beforeEach(() => {
            // Put a copy of the dropdown in document.body
            document.body.innerHTML = `
                <div class="create-match-dropdown">
                    <button id="createMatchDropdownButton" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="createMatchMenu">
                        Create Match
                        <i id="createMatchChevron"></i>
                    </button>
                    <div id="createMatchMenu" class="hidden" role="menu">
                        <a href="#event-capture" id="startLiveMatchButton" role="menuitem">Live Match</a>
                        <a href="timeline-video.html?new=video" id="codeFromVideoButton" role="menuitem">From Video</a>
                        <button id="importXmlButton" type="button" role="menuitem">Import XML</button>
                    </div>
                </div>
            `;
            trigger = document.getElementById('createMatchDropdownButton');
            menu = document.getElementById('createMatchMenu');
            controller = initCreateMatchDropdown(document);
        });

        afterEach(() => {
            controller?.destroy();
            document.body.innerHTML = '';
        });

        test('toggles menu visibility and aria-expanded on trigger click', () => {
            expect(menu.classList.contains('hidden')).toBe(true);
            expect(trigger.getAttribute('aria-expanded')).toBe('false');

            trigger.click();
            expect(menu.classList.contains('hidden')).toBe(false);
            expect(trigger.getAttribute('aria-expanded')).toBe('true');

            trigger.click();
            expect(menu.classList.contains('hidden')).toBe(true);
            expect(trigger.getAttribute('aria-expanded')).toBe('false');
        });

        test('closes when clicking outside the dropdown', () => {
            trigger.click();
            expect(menu.classList.contains('hidden')).toBe(false);

            document.body.click();
            expect(menu.classList.contains('hidden')).toBe(true);
            expect(trigger.getAttribute('aria-expanded')).toBe('false');
        });

        test('closes on Escape key and refocuses trigger', () => {
            trigger.click();
            expect(menu.classList.contains('hidden')).toBe(false);

            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event);

            expect(menu.classList.contains('hidden')).toBe(true);
            expect(trigger.getAttribute('aria-expanded')).toBe('false');
            expect(document.activeElement).toBe(trigger);
        });

        test('closes when a menu item is clicked', () => {
            trigger.click();
            expect(menu.classList.contains('hidden')).toBe(false);

            const liveItem = document.getElementById('startLiveMatchButton');
            liveItem.click();

            expect(menu.classList.contains('hidden')).toBe(true);
            expect(trigger.getAttribute('aria-expanded')).toBe('false');
        });
    });
});
