import { updateNavbarVisibility, setupMobileMenu } from '../../src/utils/domUtils.js';

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
