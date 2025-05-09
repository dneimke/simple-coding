/**
 * Grid UI components
 * @module components/ui/grid
 */

/**
 * Creates a grid layout container with specified columns
 *
 * @param {Object} options - Grid configuration
 * @param {string} [options.columns="grid-cols-1"] - Tailwind grid column classes
 * @param {string} [options.gap="gap-4"] - Tailwind gap classes
 * @param {Array} [options.children=[]] - Child elements to add to the grid
 * @param {string} [options.className=""] - Additional CSS classes
 * @returns {HTMLDivElement} Created grid container
 */
export const createGrid = ({
    columns = 'grid-cols-1',
    gap = 'gap-4',
    children = [],
    className = ''
}) => {
    const grid = document.createElement('div');
    grid.className = `grid ${columns} ${gap} ${className}`;

    children.forEach(child => {
        if (child instanceof HTMLElement) {
            grid.appendChild(child);
        } else if (typeof child === 'string') {
            const div = document.createElement('div');
            div.innerHTML = child;
            grid.appendChild(div);
        }
    });

    return grid;
};

/**
 * Creates a grid specifically for button groups
 *
 * @param {Object} options - Button grid configuration
 * @param {string} [options.gridCols="grid-cols-4"] - Tailwind grid column classes
 * @param {Array<{event: string, text: string, color: string}>} options.buttons - Button configurations
 * @param {string} [options.className=""] - Additional CSS classes
 * @param {Function} [options.onButtonClick=null] - Click handler for buttons
 * @returns {HTMLDivElement} Created button grid
 */
export const createButtonGrid = ({
    gridCols = 'grid-cols-4',
    buttons = [],
    className = '',
    onButtonClick = null
}) => {
    const buttonGrid = document.createElement('div');
    buttonGrid.className = `button-grid ${gridCols} gap-2 ${className}`;

    buttons.forEach(buttonConfig => {
        if (!buttonConfig || !buttonConfig.text || !buttonConfig.color) {
            console.warn("Skipping invalid button config:", buttonConfig);
            return;
        }

        const button = document.createElement('button');
        button.className = `event-button ${buttonConfig.color} py-2 px-4 rounded text-center`;
        button.textContent = buttonConfig.text;

        if (buttonConfig.event) {
            button.dataset.event = buttonConfig.event;
        }

        if (onButtonClick) {
            button.addEventListener('click', () => onButtonClick(buttonConfig));
        }

        buttonGrid.appendChild(button);
    });

    return buttonGrid;
};

/**
 * Creates a responsive grid container that adjusts columns based on screen size
 *
 * @param {Object} options - Responsive grid configuration
 * @param {string} [options.sm="grid-cols-1"] - Columns for small screens
 * @param {string} [options.md="grid-cols-2"] - Columns for medium screens
 * @param {string} [options.lg="grid-cols-3"] - Columns for large screens
 * @param {string} [options.xl="grid-cols-4"] - Columns for extra large screens
 * @param {string} [options.gap="gap-4"] - Tailwind gap classes
 * @param {Array} [options.children=[]] - Child elements to add to the grid
 * @param {string} [options.className=""] - Additional CSS classes
 * @returns {HTMLDivElement} Created responsive grid container
 */
export const createResponsiveGrid = ({
    sm = 'grid-cols-1',
    md = 'grid-cols-2',
    lg = 'grid-cols-3',
    xl = 'grid-cols-4',
    gap = 'gap-4',
    children = [],
    className = ''
}) => {
    const grid = document.createElement('div');
    grid.className = `grid ${sm} md:${md} lg:${lg} xl:${xl} ${gap} ${className}`;

    children.forEach(child => {
        if (child instanceof HTMLElement) {
            grid.appendChild(child);
        } else if (typeof child === 'string') {
            const div = document.createElement('div');
            div.innerHTML = child;
            grid.appendChild(div);
        }
    });

    return grid;
};
