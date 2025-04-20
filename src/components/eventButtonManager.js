import { addVisualFeedbackToButtons, logger } from '../utils/utils.js';

export class EventButtonManager {
    constructor(gameState, targetContainer) {
        this.gameState = gameState;
        this.targetContainer = targetContainer;
    }

    setButtonState() {
        const eventButtons = this.targetContainer.querySelectorAll('.event-button[data-event]');
        const isRunning = this.gameState.isActive && this.gameState.isRunning;

        eventButtons.forEach(button => {
            button.disabled = !isRunning;
        });
    }

    renderEventButtons(config) {
        this.targetContainer.innerHTML = '';

        const renderGroup = (group) => {
            if (!group || !Array.isArray(group.buttons)) {
                logger.warn("Skipping invalid group in config:", group);
                return; // Skip invalid groups
            }
            const groupContainer = document.createElement('div');
            groupContainer.className = 'group-container';

            const gridColsClass = group.gridCols || 'grid-cols-4'; // Default if not specified
            const buttonGridHTML = `
            <div class="button-grid ${gridColsClass}">
                ${group.buttons.map(buttonConfig => {
                if (!buttonConfig || !buttonConfig.event || !buttonConfig.text || !buttonConfig.color) {
                    logger.warn("Skipping invalid button config:", buttonConfig);
                    return '';
                }
                return `
                        <button class="event-button ${buttonConfig.color}" style="padding: 0.5rem 1rem;" data-event="${buttonConfig.event}">
                            ${buttonConfig.text}
                        </button>
                    `;
            }).join('')}
            </div>
        `;

            groupContainer.innerHTML = buttonGridHTML;
            this.targetContainer.appendChild(groupContainer);
        };

        if (config.rowDefs && Array.isArray(config.rowDefs)) {
            config.rowDefs.forEach(renderGroup);
        }

        const eventButtons = this.targetContainer.querySelectorAll('.event-button[data-event]');
        addVisualFeedbackToButtons(eventButtons);
        this.setButtonState();
    }
}