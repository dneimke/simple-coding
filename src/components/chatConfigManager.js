// ChatConfigManager.js - A chat interface for configuring event buttons
import { loadConfiguration, saveConfiguration } from './config.js';
import { logger } from '../utils/formatUtils.js';
import { showMessage } from '../utils/utils.js';

export class ChatConfigManager {
    constructor(configJsonInput, configMessage, eventButtons) {
        // Store references to existing components
        this.configJsonInput = configJsonInput;
        this.configMessage = configMessage;
        this.eventButtons = eventButtons;

        // Chat interface elements
        this.chatMessages = document.getElementById('chat-messages');
        this.chatForm = document.getElementById('chat-form');
        this.chatInput = document.getElementById('chat-input');
        this.configPreview = document.getElementById('config-preview');
        this.applyConfigButton = document.getElementById('applyConfigButton');

        // Tab buttons
        this.textConfigTabButton = document.getElementById('textConfigTabButton');
        this.chatConfigTabButton = document.getElementById('chatConfigTabButton');
        this.configView = document.getElementById('config-view');
        this.chatConfigView = document.getElementById('chat-config-view');

        // Configuration state
        this.currentConfig = loadConfiguration();
        this.pendingChanges = null;

        // Initialize
        this.setupEventListeners();
        this.displayWelcomeMessage();
        this.updateConfigPreview(this.currentConfig);

        logger.log('ChatConfigManager initialized');
    }

    setupEventListeners() {
        // Handle chat form submission
        this.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userMessage = this.chatInput.value.trim();
            if (userMessage) {
                this.addUserMessage(userMessage);
                this.processUserInput(userMessage);
                this.chatInput.value = '';
            }
        });

        // Handle suggestion chips
        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.chatInput.value = chip.textContent;
                this.chatForm.dispatchEvent(new Event('submit'));
            });
        });

        // Handle apply configuration button
        this.applyConfigButton.addEventListener('click', () => {
            if (this.pendingChanges) {
                const isSaved = saveConfiguration(this.pendingChanges);

                if (isSaved) {
                    this.currentConfig = this.pendingChanges;
                    this.pendingChanges = null;
                    this.addBotMessage("Configuration has been applied and saved!");

                    // Update the text editor with the new configuration
                    this.configJsonInput.value = JSON.stringify(this.currentConfig, null, 2);

                    // Update event buttons
                    this.eventButtons.initialize(this.currentConfig);

                    // Show success message
                    showMessage(this.configMessage, "Configuration saved successfully!", false);
                } else {
                    this.addBotMessage("Failed to save the configuration. Please check the console for errors.");
                    showMessage(this.configMessage, "Failed to save configuration.", true);
                }
            } else {
                this.addBotMessage("There are no changes to apply.");
            }
        });

        // Handle tab switching
        this.textConfigTabButton.addEventListener('click', () => {
            this.showTextEditor();
        });

        this.chatConfigTabButton.addEventListener('click', () => {
            this.showChatInterface();
        });
    }

    showTextEditor() {
        this.configView.classList.remove('hidden');
        this.chatConfigView.classList.add('hidden');
        this.textConfigTabButton.classList.add('tab-button-active');
        this.chatConfigTabButton.classList.remove('tab-button-active');
    }

    showChatInterface() {
        this.configView.classList.add('hidden');
        this.chatConfigView.classList.remove('hidden');
        this.textConfigTabButton.classList.remove('tab-button-active');
        this.chatConfigTabButton.classList.add('tab-button-active');
    }

    displayWelcomeMessage() {
        this.addBotMessage(
            "Hi there! I can help you configure your event buttons. You can ask me to:<br>" +
            "- Create specific buttons or button groups<br>" +
            "- Modify existing buttons<br>" +
            "- Change button colors or layout<br>" +
            "Just tell me what you need in natural language, and I'll translate it to the required configuration."
        );
    }

    addUserMessage(message) {
        const userDiv = document.createElement('div');
        userDiv.className = 'flex justify-end mb-2';
        userDiv.innerHTML = `
            <div class="bg-blue-100 rounded-lg px-4 py-2 max-w-[80%]">
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
        this.chatMessages.appendChild(userDiv);
        this.scrollToBottom();
    }

    addBotMessage(message) {
        const botDiv = document.createElement('div');
        botDiv.className = 'flex justify-start mb-2';
        botDiv.innerHTML = `
            <div class="bg-gray-100 rounded-lg px-4 py-2 max-w-[80%]">
                <p>${message}</p>
            </div>
        `;
        this.chatMessages.appendChild(botDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    processUserInput(message) {
        // In a real implementation, this would connect to an LLM API
        // For now, we'll simulate with some basic pattern matching

        // Show thinking indicator
        this.addBotMessage("<em>Thinking...</em>");

        setTimeout(() => {
            // Remove the thinking message
            this.chatMessages.removeChild(this.chatMessages.lastChild);

            // Process the message
            if (message.toLowerCase().includes('show') &&
                (message.toLowerCase().includes('configuration') || message.toLowerCase().includes('config'))) {
                this.showCurrentConfig();
            }
            else if (this.detectAddButtonIntent(message)) {
                this.handleAddButton(message);
            }
            else if (this.detectChangeColorIntent(message)) {
                this.handleChangeColor(message);
            }
            else {
                this.addBotMessage(
                    "I understand you want to make changes to your configuration. Could you be more specific? " +
                    "For example, you can say:<br>" +
                    "- \"Add a red button for Goal Scored\"<br>" +
                    "- \"Change the color of the Penalty button to green\"<br>" +
                    "- \"Show me my current configuration\""
                );
            }
        }, 500); // Simulate API delay
    }

    detectAddButtonIntent(message) {
        const addKeywords = ['add', 'create', 'make', 'new', 'include'];
        const buttonKeywords = ['button', 'event', 'key', 'action'];

        const lowercaseMsg = message.toLowerCase();
        return addKeywords.some(word => lowercaseMsg.includes(word)) &&
            buttonKeywords.some(word => lowercaseMsg.includes(word));
    }

    detectChangeColorIntent(message) {
        const changeKeywords = ['change', 'modify', 'update', 'set'];
        const colorKeywords = ['color', 'red', 'blue', 'green', 'yellow', 'gray', 'grey'];

        const lowercaseMsg = message.toLowerCase();
        return changeKeywords.some(word => lowercaseMsg.includes(word)) &&
            colorKeywords.some(word => lowercaseMsg.includes(word));
    }

    handleAddButton(message) {
        // Extract button details (very basic implementation)
        const buttonText = this.extractButtonText(message);
        const buttonColor = this.extractButtonColor(message);

        if (!buttonText) {
            this.addBotMessage("I need to know what text to put on the button. Could you specify that?");
            return;
        }

        // Create a deep copy of the current config
        const updatedConfig = JSON.parse(JSON.stringify(this.currentConfig));

        // Add the new button to the first row
        if (updatedConfig.rowDefs && updatedConfig.rowDefs.length > 0) {
            if (!updatedConfig.rowDefs[0].buttons) {
                updatedConfig.rowDefs[0].buttons = [];
            }

            // Create the new button object
            const newButton = {
                event: buttonText.toUpperCase().replace(/\s+/g, '_'),
                text: buttonText.toUpperCase(),
                color: buttonColor || "btn-blue"
            };

            updatedConfig.rowDefs[0].buttons.push(newButton);
            this.pendingChanges = updatedConfig;
            this.updateConfigPreview(updatedConfig);

            this.addBotMessage(
                `I've added a new ${buttonColor || "blue"} button with the text "${buttonText.toUpperCase()}" to your configuration. ` +
                `You can see it in the preview below. Click "Apply Changes" to save this configuration.`
            );
        } else {
            this.addBotMessage("I couldn't find a proper place to add the button in your configuration structure.");
        }
    }

    handleChangeColor(message) {
        // Extract the button to modify and the new color
        const buttonToChange = this.extractButtonToModify(message);
        const newColor = this.extractButtonColor(message);

        if (!buttonToChange) {
            this.addBotMessage("I need to know which button you want to change. Could you specify that?");
            return;
        }

        if (!newColor) {
            this.addBotMessage("I need to know what color you want to use. Please specify red, blue, green, yellow, or gray.");
            return;
        }

        // Create a deep copy of the current config
        const updatedConfig = JSON.parse(JSON.stringify(this.currentConfig));
        let foundButton = false;

        // Search for the button in all rows
        if (updatedConfig.rowDefs) {
            for (const row of updatedConfig.rowDefs) {
                if (row.buttons) {
                    for (const button of row.buttons) {
                        if (button.text && button.text.toLowerCase().includes(buttonToChange.toLowerCase())) {
                            button.color = newColor;
                            foundButton = true;
                        }
                    }
                }
            }
        }

        if (foundButton) {
            this.pendingChanges = updatedConfig;
            this.updateConfigPreview(updatedConfig);

            this.addBotMessage(
                `I've updated the color of buttons containing "${buttonToChange}" to ${newColor}. ` +
                `You can see the changes in the preview below. Click "Apply Changes" to save this configuration.`
            );
        } else {
            this.addBotMessage(`I couldn't find any button containing "${buttonToChange}" in your configuration.`);
        }
    }

    showCurrentConfig() {
        this.updateConfigPreview(this.currentConfig);
        this.pendingChanges = null;

        this.addBotMessage(
            "Here's your current configuration. You can ask me to modify specific parts of it. " +
            "For example, you can ask me to add a new button or change the color of an existing one."
        );
    }

    extractButtonText(message) {
        // This is a very simple extractor - in a real implementation, LLM would handle this
        const forMatch = message.match(/(?:for|called|named|with text|labeled)\s+["']?([^"']+?)["']?(?:\s|$)/i);
        if (forMatch) {
            return forMatch[1].trim();
        }

        // Look for phrases that might be button text
        const words = message.split(/\s+/);
        const buttonIndex = words.findIndex(word =>
            word.toLowerCase() === 'button' ||
            word.toLowerCase() === 'event'
        );

        if (buttonIndex >= 0 && buttonIndex < words.length - 1) {
            return words[buttonIndex + 1].trim();
        }

        return null;
    }

    extractButtonColor(message) {
        const lowercaseMsg = message.toLowerCase();
        if (lowercaseMsg.includes('red')) return 'btn-red';
        if (lowercaseMsg.includes('green')) return 'btn-green';
        if (lowercaseMsg.includes('blue')) return 'btn-blue';
        if (lowercaseMsg.includes('yellow')) return 'btn-yellow';
        if (lowercaseMsg.includes('gray') || lowercaseMsg.includes('grey')) return 'btn-gray';
        return null;
    }

    extractButtonToModify(message) {
        // Very basic extraction - in a real implementation, LLM would do better
        const words = message.split(/\s+/);
        const changeIndex = words.findIndex(word =>
            word.toLowerCase() === 'change' ||
            word.toLowerCase() === 'modify' ||
            word.toLowerCase() === 'update'
        );

        if (changeIndex >= 0 && changeIndex < words.length - 3) {
            // Look for "the X button" pattern
            if (words[changeIndex + 1].toLowerCase() === 'the' &&
                words[changeIndex + 3].toLowerCase() === 'button') {
                return words[changeIndex + 2];
            }

            // Look for "button X" pattern
            if (words[changeIndex + 1].toLowerCase() === 'button') {
                return words[changeIndex + 2];
            }
        }

        return null;
    }

    updateConfigPreview(config) {
        this.configPreview.innerHTML = `<pre class="text-xs">${this.escapeHtml(JSON.stringify(config, null, 2))}</pre>`;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
