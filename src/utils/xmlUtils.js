// XML utility functions
import { escapeXml, logger } from './formatUtils.js';
import { notificationService } from '../services/notificationService.js';

/**
 * Generates plain XML from event data
 * @param {Array} events - Array of event objects
 * @returns {string} Generated XML string
 */
export const generatePlainXml = (events) => {
    return events.map((logEntry, index) => {
        const eventTimeSeconds = Math.floor(logEntry.timeMs / 1000);
        const startSeconds = Math.max(0, eventTimeSeconds - 5);
        const endSeconds = eventTimeSeconds + 5;
        const eventCode = escapeXml(logEntry.event);
        return `<instance><ID>${index + 1}</ID><start>${startSeconds}</start><end>${endSeconds}</end><code>${eventCode}</code></instance>`;
    }).join('\n');
};

/**
 * Copies XML content to clipboard
 * @param {string} xmlContent - XML content to copy
 */
export const copyXmlToClipboard = (xmlContent) => {
    if (!xmlContent) {
        logger.warn('No XML content to copy.');
        return;
    }
    navigator.clipboard.writeText(xmlContent)
        .then(() => {
            logger.log('XML content copied to clipboard.');
            notificationService.notify('XML content copied to clipboard.', 'success');
        })
        .catch((err) => {
            logger.error('Failed to copy XML content to clipboard:', err);
            notificationService.notify('Failed to copy XML content to clipboard.', 'error');
        });
};

/**
 * Parses XML content to extract event data
 * @param {string} xmlContent - XML content to parse
 * @returns {Array} Array of event objects
 */
export const parseXmlToEvents = (xmlContent) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

    // Try to extract teams info from the game element if available
    let teamsAttribute = null;
    const gameElement = xmlDoc.querySelector('game');
    if (gameElement && gameElement.hasAttribute('teams')) {
        teamsAttribute = gameElement.getAttribute('teams');
    }

    let events = [];

    // First try to parse the new export format (<event> elements with attributes)
    const eventNodes = Array.from(xmlDoc.getElementsByTagName('event'));

    if (eventNodes.length > 0) {
        events = eventNodes.map(node => {
            const eventName = node.getAttribute('event');
            const timeMs = node.getAttribute('timeMs');

            if (eventName && timeMs) {
                return {
                    event: eventName,
                    timeMs: parseInt(timeMs, 10)
                };
            }
            return null;
        }).filter(Boolean);
    } else {
        // If no <event> elements, try the legacy format (<instance> elements with child tags)
        const instanceNodes = Array.from(xmlDoc.getElementsByTagName('instance'));

        events = instanceNodes.map(node => {
            const code = node.getElementsByTagName('code')[0]?.textContent;
            const start = node.getElementsByTagName('start')[0]?.textContent;
            const end = node.getElementsByTagName('end')[0]?.textContent;

            if (code && start && end) {
                const startMs = parseInt(start, 10) * 1000;
                const endMs = parseInt(end, 10) * 1000;
                const eventTimeInMilliseconds = (startMs + endMs) / 2;
                return {
                    event: code,
                    timeMs: eventTimeInMilliseconds
                };
            }
            return null;
        }).filter(Boolean);
    }

    // Attach the teams attribute to the events array for later use
    if (teamsAttribute) {
        events.teamsAttribute = teamsAttribute;
    }

    return events;
};

/**
 * Validates XML structure for correctness
 * @param {string} xmlContent - XML content to validate
 * @returns {Document} Parsed XML document if valid
 * @throws {Error} If XML structure is invalid
 */
export const validateXmlStructure = (xmlContent) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

    if (xmlDoc.querySelector('parsererror')) {
        throw new Error('Invalid XML format.');
    }

    // Check for new format (<event> elements)
    const eventNodes = Array.from(xmlDoc.getElementsByTagName('event'));

    if (eventNodes.length > 0) {
        // New format validation
        eventNodes.forEach(node => {
            const eventName = node.getAttribute('event');
            const timeMs = node.getAttribute('timeMs');

            if (!eventName || !timeMs) {
                throw new Error('Invalid event data in XML. Missing event name or time.');
            }

            if (isNaN(parseInt(timeMs, 10))) {
                throw new Error('Invalid time value in XML.');
            }
        });
    } else {
        // Legacy format validation (<instance> elements)
        const instanceNodes = Array.from(xmlDoc.getElementsByTagName('instance'));
        if (instanceNodes.length === 0) {
            throw new Error('No events or instances found in the XML file.');
        }

        instanceNodes.forEach(node => {
            const id = node.getElementsByTagName('ID')[0]?.textContent;
            const start = node.getElementsByTagName('start')[0]?.textContent;
            const end = node.getElementsByTagName('end')[0]?.textContent;
            const code = node.getElementsByTagName('code')[0]?.textContent;

            if (!id || !start || !end || !code) {
                throw new Error('Invalid instance data in XML.');
            }
        });
    }

    return xmlDoc;
};

/**
 * Generate XML for a complete game suitable for export
 * @param {Object} game - Game data object containing events, timestamp, etc.
 * @param {string|number} gameTitle - Display name or index of the game
 * @returns {string} Complete XML representation of the game
 */
export const generateGameXml = (game, gameTitle) => {
    const gameDate = new Date(game.timestamp).toISOString().split('T')[0];
    const gameTeams = game.teams || `Game ${gameTitle}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<game date="${gameDate}" teams="${escapeXml(gameTeams)}">
    <events>
${game.events.map(event => `        <event event="${escapeXml(event.event)}" timeMs="${event.timeMs}" />`).join('\n')}
    </events>
</game>`;
};
