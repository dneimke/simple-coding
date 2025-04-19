import { addVisualFeedbackToButtons, logger } from './utils.js';

export class EventButtonManager {
    constructor(gameState, eventLog, targetContainer) {
        this.gameState = gameState;
        this.eventLog = eventLog;
        this.targetContainer = targetContainer;
    }

    enableEventButtons() {
        const logIsEmpty = this.gameState.loggedEvents.length === 0;
        const eventButtons = document.querySelectorAll('.event-button[data-event]');
        const isRunning = this.gameState.isActive && this.gameState.isRunning;

        eventButtons.forEach(button => {
            button.disabled = !isRunning;
        });
        // copyXmlButton.disabled = logIsEmpty;
    }

    handleEventButtonClick(e) {
        const eventName = e.target.dataset.event;
        const currentElapsedTimeMs = this.gameState.isRunning ? this.gameState.elapsedTime + (Date.now() - this.gameState.startTime) : this.gameState.elapsedTime;
        this.gameState.addEvent({ event: eventName, timeMs: currentElapsedTimeMs });
        this.eventLog.render(this.gameState.loggedEvents);
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

        const eventButtons = document.querySelectorAll('.event-button[data-event]');
        eventButtons.forEach(button => {
            button.removeEventListener('click', this.handleEventButtonClick.bind(this));
            button.addEventListener('click', this.handleEventButtonClick.bind(this));
        });

        addVisualFeedbackToButtons(eventButtons);
        this.enableEventButtons();
    }
}