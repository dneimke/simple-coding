/**
 * Button UI components
 * @module components/ui/button
 */

const BUTTON_VARIANTS = ['primary', 'secondary', 'success', 'warning', 'danger', 'ghost', 'dark'];

/**
 * Design language class for a button variant (see docs/design-language.md)
 * @param {string} type - Variant name; unknown values fall back to secondary
 * @returns {string} Class list, e.g. "btn btn-primary"
 */
export const buttonVariantClass = (type) =>
    `btn btn-${BUTTON_VARIANTS.includes(type) ? type : 'secondary'}`;

/**
 * Creates a button element with consistent styling
 *
 * @param {Object} options - Button configuration
 * @param {string} options.text - Button text content
 * @param {string} [options.className] - CSS classes for styling
 * @param {Function} [options.onClick] - Click event handler
 * @param {string} [options.id=null] - Optional button ID
 * @param {string} [options.type="default"] - Button variant (primary, secondary, success, warning, danger, ghost, dark)
 * @param {boolean} [options.disabled=false] - Whether the button is disabled
 * @param {string} [options.icon=null] - Optional icon HTML
 * @returns {HTMLButtonElement} The created button element
 */
export const createButton = ({
    text,
    className = '',
    onClick = null,
    id = null,
    type = 'default',
    disabled = false,
    icon = null
}) => {
    // Create button element or get existing one by ID
    let button = id ? document.getElementById(id) : null;
    if (!button) {
        button = document.createElement('button');
        if (id) button.id = id;
    }

    // Legacy board colour classes map onto the matching variant
    let buttonType = type;
    if (className.includes('btn-blue')) buttonType = 'primary';
    if (className.includes('btn-red')) buttonType = 'danger';
    if (className.includes('btn-yellow')) buttonType = 'warning';
    if (className.includes('btn-green')) buttonType = 'success';

    const buttonClasses = [buttonVariantClass(buttonType), className].filter(Boolean).join(' ');

    button.className = buttonClasses;
    button.textContent = text;

    // Add disabled state
    if (disabled) {
        button.disabled = true;
    } else {
        button.disabled = false;
    }

    // Add icon if provided
    if (icon) {
        // Clear the button content first
        button.innerHTML = '';

        // Create icon span
        const iconSpan = document.createElement('span');
        iconSpan.innerHTML = icon;

        // Create text span
        const textSpan = document.createElement('span');
        textSpan.textContent = text;

        // Add icon and text to button
        button.appendChild(iconSpan);
        button.appendChild(textSpan);
    }
    // Add click handler
    if (onClick) {
        // In the browser, we would use cloneNode to clear event listeners
        // but for Jest we need to handle this differently
        if (typeof button.replaceWith === 'function' && typeof button.cloneNode === 'function') {
            // In browser environment
            button.replaceWith(button.cloneNode(true));
            button = id ? document.getElementById(id) : button;
        }
        // Add the click event listener
        button.addEventListener('click', onClick);
    }

    return button;
};

/**
 * Creates an icon button with only an icon
 *
 * @param {Object} options - Button configuration
 * @param {string} options.icon - Icon HTML content
 * @param {string} [options.ariaLabel] - Accessible label for the button
 * @param {Function} [options.onClick] - Click event handler
 * @param {string} [options.className] - Additional CSS classes
 * @param {string} [options.type="default"] - Button type (default, primary, danger, etc)
 * @param {boolean} [options.disabled=false] - Whether the button is disabled
 * @returns {HTMLButtonElement} The created icon button
 */
export const createIconButton = ({
    icon,
    ariaLabel,
    onClick = null,
    className = '',
    type = 'default',
    disabled = false
}) => {
    const button = document.createElement('button');

    button.className = [buttonVariantClass(type), 'btn-icon', className].filter(Boolean).join(' ');

    // Add icon content
    button.innerHTML = icon;

    // Add accessibility attributes
    if (ariaLabel) {
        button.setAttribute('aria-label', ariaLabel);
    }

    // Apply disabled state if needed
    if (disabled) {
        button.disabled = true;
    }

    // Add click handler
    if (onClick) {
        button.addEventListener('click', onClick);
    }

    return button;
};
