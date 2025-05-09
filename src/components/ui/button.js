/**
 * Button UI components
 * @module components/ui/button
 */

/**
 * Creates a button element with consistent styling
 *
 * @param {Object} options - Button configuration
 * @param {string} options.text - Button text content
 * @param {string} [options.className] - CSS classes for styling
 * @param {Function} [options.onClick] - Click event handler
 * @param {string} [options.id=null] - Optional button ID
 * @param {string} [options.type="default"] - Button type (default, primary, danger, warning, success)
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

    // Apply base Tailwind classes
    const baseClasses = 'inline-flex items-center justify-center px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors';

    // Apply type-specific Tailwind classes
    const typeClasses = {
        default: 'bg-gray-200 hover:bg-gray-300 focus:ring-gray-400 text-gray-800',
        primary: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white',
        danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
        warning: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400 text-white',
        success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white',
    };

    // Special case for legacy btn-* classes in className
    let buttonType = type;
    if (className.includes('btn-blue')) buttonType = 'primary';
    if (className.includes('btn-red')) buttonType = 'danger';
    if (className.includes('btn-yellow')) buttonType = 'warning';
    if (className.includes('btn-green')) buttonType = 'success';

    // Combine all classes
    const buttonClasses = [
        baseClasses,
        typeClasses[buttonType] || typeClasses.default,
        className
    ].filter(Boolean).join(' ');

    button.className = buttonClasses;
    button.textContent = text;

    // Add disabled state
    if (disabled) {
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-not-allowed');
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
        iconSpan.className = 'mr-2';

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

    // Apply Tailwind classes for icon button
    const baseClasses = 'p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-opacity-50';

    // Apply type-specific classes
    const typeClasses = {
        default: 'bg-gray-200 hover:bg-gray-300 focus:ring-gray-400 text-gray-800',
        primary: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white',
        danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
        warning: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400 text-white',
        success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white',
    };

    // Combine all classes
    button.className = `${baseClasses} ${typeClasses[type] || typeClasses.default} ${className}`;

    // Add icon content
    button.innerHTML = icon;

    // Add accessibility attributes
    if (ariaLabel) {
        button.setAttribute('aria-label', ariaLabel);
    }

    // Apply disabled state if needed
    if (disabled) {
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // Add click handler
    if (onClick) {
        button.addEventListener('click', onClick);
    }

    return button;
};
