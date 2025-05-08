/**
 * Notification Service - Handles all user notifications
 *
 * This service provides a centralized way to show consistent notifications to users.
 * It supports different types of notifications and provides a unified interface for
 * alerts, confirmations, and temporary notifications.
 */

// Import logger if available in the project
let logger;
try {
    // Attempt to import logger - adapt this import based on actual project structure
    logger = console;
} catch (error) {
    // Fallback to console if logger is not available
    logger = console;
}

/**
 * Notification Service - Handles all user notifications
 */
export const notificationService = {
    /**
     * Shows a temporary notification to the user
     * @param {string} message - Message to display
     * @param {string} type - Notification type ('success', 'error', 'warning')
     * @param {number} duration - Duration in ms to show notification
     * @returns {HTMLElement} The notification element that was created
     */
    notify(message, type = 'success', duration = 3000) {
        try {
            // Remove any existing notifications with the same message to prevent duplicates
            const existingNotifications = document.querySelectorAll('.notification');
            existingNotifications.forEach(notification => {
                if (notification.textContent === message) {
                    document.body.removeChild(notification);
                }
            });

            const notification = document.createElement('div');
            notification.className = 'notification fixed top-4 right-4 py-2 px-4 rounded-md shadow-lg z-50 transition-opacity duration-300';

            // Apply appropriate styling based on notification type
            switch (type) {
                case 'error':
                    notification.classList.add('bg-red-600', 'text-white');
                    break;
                case 'warning':
                    notification.classList.add('bg-yellow-500', 'text-white');
                    break;
                default: // success
                    notification.classList.add('bg-green-600', 'text-white');
            }

            notification.textContent = message;
            document.body.appendChild(notification);

            // Fade out and remove after duration
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, duration);

            return notification;
        } catch (error) {
            logger.error('Error showing notification:', error);
            // Fallback to alert if notification fails
            alert(message);
            return null;
        }
    },

    /**
     * Show a confirmation dialog with OK/Cancel buttons
     * @param {string} message - Confirmation message
     * @returns {boolean} True if confirmed, false if canceled
     */
    confirm(message) {
        try {
            return window.confirm(message);
        } catch (error) {
            logger.error('Error showing confirmation dialog:', error);
            return false;
        }
    },

    /**
     * Show a prompt dialog to get user input
     * @param {string} message - Prompt message
     * @param {string} defaultValue - Default input value
     * @returns {string|null} User input or null if canceled
     */
    prompt(message, defaultValue = '') {
        try {
            return window.prompt(message, defaultValue);
        } catch (error) {
            logger.error('Error showing prompt dialog:', error);
            return null;
        }
    },

    /**
     * Show an alert message
     * @param {string} message - Alert message
     */
    alert(message) {
        try {
            window.alert(message);
        } catch (error) {
            logger.error('Error showing alert:', error);
            // No fallback for alert - it is the fallback
        }
    },

    /**
     * Display a message in a specified element (for inline notifications)
     * @param {HTMLElement} element - Element to show the message in
     * @param {string} message - Message to display
     * @param {boolean} isError - Whether this is an error message
     * @param {number} duration - How long to show the message (ms)
     */
    showMessage(element, message, isError = false, duration = 5000) {
        if (!element) {
            this.notify(message, isError ? 'error' : 'success');
            return;
        }

        element.textContent = message;
        element.className = 'config-message';

        if (isError) {
            element.classList.add('config-error');
        } else {
            element.classList.add('config-success');
        }

        element.classList.remove('hidden');

        setTimeout(() => {
            element.classList.add('hidden');
        }, duration);
    }
};

export default notificationService;
