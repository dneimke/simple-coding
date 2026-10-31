// DOM manipulation utility functions

/**
 * Updates navbar visibility based on game state
 * @param {boolean} isVisible - Whether game-related buttons should be visible
 */
export function updateNavbarVisibility(isVisible) {
    const requiresGameButtons = document.querySelectorAll('[data-requires-game]');
    requiresGameButtons.forEach(button => {
        if (isVisible) {
            // Make visible, but maintain proper display mode
            button.classList.remove('hidden');
            // For standard nav items, we want flex display
            if (button.classList.contains('nav-link')) {
                button.style.display = 'flex';
            } else {
                button.style.display = 'inline-block';
            }
        } else {
            button.classList.add('hidden');
            button.style.display = '';
        }
    });
}

/**
 * Adds visual feedback to buttons when clicked
 * @param {Array<HTMLElement>} buttons - Array of button elements
 */
export function addVisualFeedbackToButtons(buttons) {
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            button.classList.add('clicked');
            setTimeout(() => button.classList.remove('clicked'), 200);
        });
    });
}
