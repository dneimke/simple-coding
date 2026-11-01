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

/**
 * Initializes mobile hamburger menu toggle and auto-collapse behavior
 * @param {HTMLElement|string} button - Button element or selector
 * @param {HTMLElement|string} menu - Menu element or selector
 */
export function setupMobileMenu(button, menu) {
    const mobileMenuButton = typeof button === 'string' ? document.querySelector(button) : button;
    const mainMenu = typeof menu === 'string' ? document.querySelector(menu) : menu;

    if (!mobileMenuButton || !mainMenu) return;

    mobileMenuButton.addEventListener('click', () => {
        const isOpen = !mainMenu.classList.contains('hidden');

        if (isOpen) {
            mainMenu.classList.add('opacity-0');
            setTimeout(() => {
                mainMenu.classList.add('hidden');
                mainMenu.classList.remove('opacity-0', 'flex');
            }, 200);
            mobileMenuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
            mobileMenuButton.setAttribute('aria-expanded', 'false');
        } else {
            mainMenu.classList.remove('hidden');
            setTimeout(() => {
                mainMenu.classList.add('flex');
            }, 10);
            mobileMenuButton.innerHTML = '<i class="fas fa-times text-xl"></i>';
            mobileMenuButton.setAttribute('aria-expanded', 'true');
        }
    });

    mobileMenuButton.setAttribute('aria-expanded', 'false');

    const navLinks = mainMenu.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                mainMenu.classList.add('opacity-0');
                setTimeout(() => {
                    mainMenu.classList.add('hidden');
                    mainMenu.classList.remove('opacity-0', 'flex');
                }, 200);
                mobileMenuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
                mobileMenuButton.setAttribute('aria-expanded', 'false');
            }
        });
    });
}
