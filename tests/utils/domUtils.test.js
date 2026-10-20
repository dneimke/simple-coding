import { updateNavbarVisibility } from '../../src/utils/domUtils.js';

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
