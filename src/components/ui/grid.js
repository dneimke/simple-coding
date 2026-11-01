/**
 * Grid UI components
 * @module components/ui/grid
 */
import { createCodingButton } from './codingButton.js';

/**
 * Creates a grid specifically for button groups
 *
 * @param {Object} options - Button grid configuration
 * @param {string} [options.gridCols="grid-cols-4"] - Tailwind grid column classes
 * @param {Array<{event: string, text: string, color?: string, zoned?: boolean}>} options.buttons - Button configurations
 * @param {string} [options.className=""] - Additional CSS classes
 * @param {Function} [options.onButtonClick=null] - Click handler for buttons
 * @param {{slot: number, code: string, colorClass: string}} [options.team=null] - Team slot for the row; events are
 *   prefixed with the team code and buttons without a color use the team's colour class
 * @returns {HTMLDivElement} Created button grid
 */
export const createButtonGrid = ({
    gridCols = 'grid-cols-4',
    buttons = [],
    className = '',
    onButtonClick = null,
    team = null
}) => {
    const buttonGrid = document.createElement('div');
    // Dynamically adjust grid columns for mobile
    // Extract the number from gridCols (e.g., "grid-cols-4" -> 4)
    const colsMatch = gridCols.match(/grid-cols-(\d+)/);
    const colsNumber = colsMatch ? parseInt(colsMatch[1]) : 4;

    // Create responsive classes for different screen sizes
    const responsiveGridClass =
        `button-grid grid-cols-${Math.min(colsNumber, 4)} sm:${gridCols} ${className}`;

    buttonGrid.className = responsiveGridClass;

    buttons.forEach(buttonConfig => {
        const color = buttonConfig?.color || team?.colorClass;
        if (!buttonConfig || !buttonConfig.text || !color) {
            console.warn("Skipping invalid button config:", buttonConfig);
            return;
        }

        const button = createCodingButton({
            text: buttonConfig.text,
            event: buttonConfig.event,
            color: buttonConfig.color,
            team,
            teamColored: !buttonConfig.color,
            zoned: buttonConfig.zoned,
            lead: buttonConfig.lead,
            lag: buttonConfig.lag,
            onClick: onButtonClick ? () => onButtonClick(buttonConfig) : null
        });

        buttonGrid.appendChild(button);
    });

    return buttonGrid;
};
