/**
 * Tests for the UI Button components
 */
import { createButton, createIconButton } from '../../../src/components/ui/button.js';

// Mock document methods
document.createElement = jest.fn().mockImplementation((tag) => {
    const element = {
        className: '',
        textContent: '',
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        setAttribute: jest.fn(),
        disabled: false,
        classList: {
            add: jest.fn(),
        }
    };
    return element;
});

document.getElementById = jest.fn().mockImplementation(() => null);

describe('Button UI Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('createButton should create a button with correct properties', () => {
        const onClick = jest.fn();
        const button = createButton({
            text: 'Test Button',
            className: 'custom-class',
            onClick,
            type: 'primary'
        });

        expect(document.createElement).toHaveBeenCalledWith('button');
        expect(button.textContent).toBe('Test Button');
        expect(button.className).toContain('custom-class');
        expect(button.className).toContain('bg-blue-600'); // Primary button style
        expect(button.addEventListener).toHaveBeenCalledWith('click', onClick);
    });

    test('createButton should handle disabled state', () => {
        const button = createButton({
            text: 'Disabled Button',
            disabled: true
        });

        expect(button.disabled).toBe(true);
        expect(button.classList.add).toHaveBeenCalledWith('opacity-50', 'cursor-not-allowed');
    });

    test('createIconButton should create a button with an icon', () => {
        const iconHTML = '<svg>...</svg>';
        const onClick = jest.fn();

        const button = createIconButton({
            icon: iconHTML,
            ariaLabel: 'Delete',
            onClick
        });

        expect(document.createElement).toHaveBeenCalledWith('button');
        expect(button.innerHTML).toBe(iconHTML);
        expect(button.setAttribute).toHaveBeenCalledWith('aria-label', 'Delete');
        expect(button.addEventListener).toHaveBeenCalledWith('click', onClick);
    });
});
