import { addVisualFeedbackToButtons } from '../utils/domUtils.js';
import { logger } from '../utils/formatUtils.js';
import { createButtonGrid } from './ui/index.js';

export class EventButtons {
    constructor(targetContainer) {
        this.targetContainer = targetContainer;
    }

    setState(gameState) {
        const eventButtons = this.targetContainer.querySelectorAll('.event-button[data-event]');
        const isRunning = gameState.isActive && gameState.isRunning;

        eventButtons.forEach(button => {
            button.disabled = !isRunning;
        });
    } initialize(config) {
        this.targetContainer.innerHTML = '';

        const renderGroup = (group) => {
            if (!group || !Array.isArray(group.buttons)) {
                logger.warn("Skipping invalid group in config:", group);
                return; // Skip invalid groups
            }

            const groupContainer = document.createElement('div');
            groupContainer.className = 'group-container';

            // Use the createButtonGrid component from our UI library
            const gridColsClass = group.gridCols || 'grid-cols-4'; // Default if not specified
            const buttonGrid = createButtonGrid({
                gridCols: gridColsClass,
                buttons: group.buttons,
                className: 'gap-2'
            });

            groupContainer.appendChild(buttonGrid);
            this.targetContainer.appendChild(groupContainer);
        };

        if (config.rowDefs && Array.isArray(config.rowDefs)) {
            config.rowDefs.forEach(renderGroup);
        }

        const eventButtons = this.targetContainer.querySelectorAll('.event-button[data-event]');
        addVisualFeedbackToButtons(eventButtons);
        this.setState({ isActive: false, isRunning: false });
    }
}