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
const buttonVariantClass = (type) =>
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
const LEGACY_COLOR_VARIANT_MAP = [
    ['btn-blue', 'primary'],
    ['btn-red', 'danger'],
    ['btn-yellow', 'warning'],
    ['btn-green', 'success']
];

function resolveButtonType(className, type) {
    for (const [cls, variant] of LEGACY_COLOR_VARIANT_MAP) {
        if (className.includes(cls)) return variant;
    }
    return type;
}

function applyButtonContent(button, text, icon) {
    if (!icon) {
        button.textContent = text;
        return;
    }
    button.innerHTML = '';
    const iconSpan = document.createElement('span');
    iconSpan.innerHTML = icon;
    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    button.append(iconSpan, textSpan);
}

function attachButtonClickHandler(button, id, onClick) {
    if (!onClick) return button;
    let target = button;
    if (typeof button.replaceWith === 'function' && typeof button.cloneNode === 'function') {
        button.replaceWith(button.cloneNode(true));
        target = id ? document.getElementById(id) : button;
    }
    target.addEventListener('click', onClick);
    return target;
}

export const createButton = ({
    text,
    className = '',
    onClick = null,
    id = null,
    type = 'default',
    disabled = false,
    icon = null
}) => {
    let button = id ? document.getElementById(id) : null;
    if (!button) {
        button = document.createElement('button');
        if (id) button.id = id;
    }

    const buttonType = resolveButtonType(className, type);
    button.className = [buttonVariantClass(buttonType), className].filter(Boolean).join(' ');
    button.disabled = Boolean(disabled);

    applyButtonContent(button, text, icon);
    return attachButtonClickHandler(button, id, onClick);
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
