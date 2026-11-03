import { updateNavbarVisibility, setupMobileMenu, calculateNextMenuIndex, openModalWithPromise } from '../../src/utils/domUtils.js';

describe('updateNavbarVisibility', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <a id="navLog" class="nav-link hidden" data-requires-game href="#log">Log</a>
        `;
    });

    test('hiding a game link clears the inline display that showing it set', () => {
        updateNavbarVisibility(true);
        const link = document.getElementById('navLog');
        expect(link.classList.contains('hidden')).toBe(false);
        expect(link.style.display).toBe('flex');

        updateNavbarVisibility(false);

        expect(link.classList.contains('hidden')).toBe(true);
        expect(link.style.display).toBe('');
    });
});

describe('setupMobileMenu', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        document.body.innerHTML = `
            <button id="mobileMenuButton"><i class="fas fa-bars text-xl"></i></button>
            <div id="mainMenu" class="hidden">
                <a href="#link1">Link 1</a>
            </div>
        `;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('toggles menu open and closed on click', () => {
        const btn = document.getElementById('mobileMenuButton');
        const menu = document.getElementById('mainMenu');

        setupMobileMenu(btn, menu);
        expect(btn.getAttribute('aria-expanded')).toBe('false');

        // Click to open
        btn.click();
        jest.advanceTimersByTime(20);
        expect(menu.classList.contains('hidden')).toBe(false);
        expect(menu.classList.contains('flex')).toBe(true);
        expect(btn.getAttribute('aria-expanded')).toBe('true');

        // Click to close
        btn.click();
        jest.advanceTimersByTime(250);
        expect(menu.classList.contains('hidden')).toBe(true);
        expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    test('gracefully handles missing elements', () => {
        expect(() => setupMobileMenu(null, null)).not.toThrow();
    });
});


describe('calculateNextMenuIndex', () => {
    test('returns -1 for empty list', () => {
        expect(calculateNextMenuIndex(0, 1, 0)).toBe(-1);
    });

    test('focuses first item when moving down from unselected state', () => {
        expect(calculateNextMenuIndex(-1, 1, 4)).toBe(0);
    });

    test('focuses last item when moving up from unselected state', () => {
        expect(calculateNextMenuIndex(-1, -1, 4)).toBe(3);
    });

    test('steps forward with wrap-around', () => {
        expect(calculateNextMenuIndex(0, 1, 3)).toBe(1);
        expect(calculateNextMenuIndex(2, 1, 3)).toBe(0);
    });

    test('steps backward with wrap-around', () => {
        expect(calculateNextMenuIndex(1, -1, 3)).toBe(0);
        expect(calculateNextMenuIndex(0, -1, 3)).toBe(2);
    });
});

describe('openModalWithPromise', () => {
    let modal, form, cancelButton;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="testModal">
                <form id="testForm">
                    <input id="testInput" value="initial" />
                    <button type="submit">Submit</button>
                    <button type="button" id="testCancel">Cancel</button>
                </form>
            </div>
        `;
        modal = document.getElementById('testModal');
        form = document.getElementById('testForm');
        cancelButton = document.getElementById('testCancel');
    });

    test('resolves with result and hides modal on form submit', async () => {
        const promise = openModalWithPromise({ modal, form, cancelButton }, (close) => {
            close('saved-value');
        });

        form.dispatchEvent(new Event('submit'));
        const result = await promise;

        expect(result).toBe('saved-value');
        expect(modal.classList.contains('hidden')).toBe(true);
    });

    test('resolves with null and hides modal on cancel click', async () => {
        const promise = openModalWithPromise({ modal, form, cancelButton }, (close) => {
            close('should-not-reach');
        });

        cancelButton.dispatchEvent(new Event('click'));
        const result = await promise;

        expect(result).toBeNull();
        expect(modal.classList.contains('hidden')).toBe(true);
    });

    test('resolves with null on Escape keydown', async () => {
        const promise = openModalWithPromise({ modal, form, cancelButton }, (close) => {
            close('should-not-reach');
        });

        modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        const result = await promise;

        expect(result).toBeNull();
        expect(modal.classList.contains('hidden')).toBe(true);
    });
});
