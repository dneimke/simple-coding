/**
 * Returns an array of invalid events for a given game object.
 * An event is invalid if it is missing a non-empty event name or a valid timeMs.
 * @param {Object} game - Game data object containing events
 * @returns {Array} Array of invalid event objects (with their index in the original array)
 */
export const getInvalidEvents = (game) => {
    if (!game || !Array.isArray(game.events)) return [];
    return game.events
        .map((event, idx) => ({ event, idx }))
        .filter(({ event }) => !isValidEvent(event));
};

const isValidEvent = (event) => (
    !!event &&
    typeof event.event === 'string' &&
    !!event.event.trim() &&
    typeof event.timeMs === 'number' &&
    isFinite(event.timeMs)
);

// XML utility functions
import { escapeXml, logger } from './formatUtils.js';
import { notificationService } from '../services/notificationService.js';

const CLIP_LEAD_SECONDS = 5;
const CLIP_LAG_SECONDS = 5;

const formatSeconds = (seconds) => seconds.toFixed(2);

/**
 * Builds a complete Sportscode XML document from event data.
 * Each event becomes an instance with a clip window around the event time,
 * and each distinct code becomes a row referenced by the instance's code_id.
 * The clip window uses each event's lead and lag (in seconds) when present,
 * otherwise CLIP_LEAD_SECONDS and CLIP_LAG_SECONDS.
 * @param {Array} events - Array of event objects ({ event, timeMs, lead?, lag? })
 * @returns {string} Sportscode XML document
 */
export const generateSportscodeXml = (events) => {
    const validEvents = (Array.isArray(events) ? events : []).filter(isValidEvent);
    const rowIds = new Map();

    const instances = validEvents.map((logEntry, index) => {
        const code = logEntry.event;
        if (!rowIds.has(code)) {
            rowIds.set(code, rowIds.size + 1);
        }
        const eventSeconds = logEntry.timeMs / 1000;
        const start = Math.max(0, eventSeconds - (logEntry.lead ?? CLIP_LEAD_SECONDS));
        const end = eventSeconds + (logEntry.lag ?? CLIP_LAG_SECONDS);
        return [
            '    <instance>',
            `      <ID>${index + 1}</ID>`,
            `      <start>${formatSeconds(start)}</start>`,
            `      <end>${formatSeconds(end)}</end>`,
            `      <code_id>${rowIds.get(code)}</code_id>`,
            `      <code>${escapeXml(code)}</code>`,
            '    </instance>'
        ].join('\n');
    });

    const rows = Array.from(rowIds.entries()).map(([code, id]) => [
        '    <row>',
        `      <id>${id}</id>`,
        `      <name>${escapeXml(code)}</name>`,
        '    </row>'
    ].join('\n'));

    const section = (tag, items) => items.length > 0
        ? `  <${tag}>\n${items.join('\n')}\n  </${tag}>`
        : `  <${tag} />`;

    return [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<file>',
        section('ALL_INSTANCES', instances),
        section('ROWS', rows),
        '</file>'
    ].join('\n');
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

const childElements = (node, tagName) =>
    Array.from(node?.children || []).filter(child => child.nodeName === tagName);

const childText = (node, tagName) => {
    const child = childElements(node, tagName)[0];
    return child ? child.textContent.trim() : undefined;
};

/**
 * Returns the ALL_INSTANCES element if the document is a Sportscode file, otherwise null
 * @param {Document} xmlDoc - Parsed XML document
 * @returns {Element|null}
 */
const getSportscodeInstancesElement = (xmlDoc) => {
    const root = xmlDoc?.documentElement;
    if (!root || root.nodeName !== 'file') return null;
    return childElements(root, 'ALL_INSTANCES')[0] || null;
};

/**
 * Reads the raw fields of a Sportscode instance element
 * @param {Element} node - <instance> element
 * @returns {Object} Instance fields with numeric start/end
 */
const readSportscodeInstance = (node) => {
    const startText = childText(node, 'start');
    const endText = childText(node, 'end');
    return {
        id: childText(node, 'ID'),
        code: childText(node, 'code'),
        codeId: childText(node, 'code_id'),
        start: startText ? Number(startText) : NaN,
        end: endText ? Number(endText) : NaN
    };
};

const roundToMs = (seconds) => Math.round(seconds * 1000) / 1000;

/**
 * Converts an instance clip window back to an event.
 * Clips that start at 0 and are no longer than the default export window are treated as
 * clamped exports, so the event time is recovered from the end of the clip and the
 * default lead and lag apply.
 * Other clips are centred on the event, with lead and lag set so that exporting again
 * reproduces the same start and end. They are omitted when they match the defaults.
 * @param {string} code - Instance code
 * @param {number} start - Clip start in seconds
 * @param {number} end - Clip end in seconds
 * @returns {Object} Event object ({ event, timeMs, lead?, lag? })
 */
const instanceToEvent = (code, start, end) => {
    if (start === 0 && end <= CLIP_LEAD_SECONDS + CLIP_LAG_SECONDS) {
        return { event: code, timeMs: Math.round(Math.max(0, end - CLIP_LAG_SECONDS) * 1000) };
    }
    const timeMs = Math.round(((start + end) / 2) * 1000);
    const eventSeconds = timeMs / 1000;
    const lead = roundToMs(eventSeconds - start);
    const lag = roundToMs(end - eventSeconds);
    if (lead === CLIP_LEAD_SECONDS && lag === CLIP_LAG_SECONDS) {
        return { event: code, timeMs };
    }
    return { event: code, timeMs, lead, lag };
};

/**
 * Parses XML content to extract event data
 * @param {string} xmlContent - XML content to parse
 * @returns {Array} Array of event objects
 */
export const parseXmlToEvents = (xmlContent) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

    const instancesElement = getSportscodeInstancesElement(xmlDoc);
    if (instancesElement) {
        return childElements(instancesElement, 'instance')
            .map(readSportscodeInstance)
            .filter(({ code, start, end }) => code && isFinite(start) && isFinite(end))
            .map(({ code, start, end }) => instanceToEvent(code, start, end));
    }

    // Legacy custom export format: <game teams=".."><events><event event=".." timeMs=".." /></events></game>
    let teamsAttribute = null;
    const gameElement = xmlDoc.querySelector('game');
    if (gameElement && gameElement.hasAttribute('teams')) {
        teamsAttribute = gameElement.getAttribute('teams');
    }

    let events = [];

    const eventNodes = Array.from(xmlDoc.getElementsByTagName('event'));

    if (eventNodes.length > 0) {
        events = eventNodes.map(node => {
            const eventName = node.getAttribute('event');
            const timeMs = node.getAttribute('timeMs');
            const favouriteAttr = node.getAttribute('favourite');
            if (eventName && timeMs) {
                const eventObj = {
                    event: eventName,
                    timeMs: parseInt(timeMs, 10)
                };
                if (favouriteAttr === 'true') {
                    eventObj.favourite = true;
                }
                return eventObj;
            }
            return null;
        }).filter(Boolean);
    } else {
        // Loose <instance> elements without a <file> root
        const instanceNodes = Array.from(xmlDoc.getElementsByTagName('instance'));

        events = instanceNodes.map(node => {
            const code = node.getElementsByTagName('code')[0]?.textContent;
            const start = parseFloat(node.getElementsByTagName('start')[0]?.textContent);
            const end = parseFloat(node.getElementsByTagName('end')[0]?.textContent);

            if (code && isFinite(start) && isFinite(end)) {
                return instanceToEvent(code, start, end);
            }
            return null;
        }).filter(Boolean);
    }

    if (teamsAttribute) {
        events.teamsAttribute = teamsAttribute;
    }

    return events;
};

/**
 * Validates a Sportscode document's instances against its rows
 * @param {Document} xmlDoc - Parsed XML document
 * @param {Element} instancesElement - ALL_INSTANCES element
 * @throws {Error} If any instance is invalid or none are present
 */
const validateSportscodeDocument = (xmlDoc, instancesElement) => {
    const instanceNodes = childElements(instancesElement, 'instance');
    if (instanceNodes.length === 0) {
        throw new Error('No instances found in the Sportscode XML file.');
    }

    const rowsElement = childElements(xmlDoc.documentElement, 'ROWS')[0];
    const rowIds = new Set(
        childElements(rowsElement, 'row')
            .map(row => childText(row, 'id'))
            .filter(Boolean)
    );

    instanceNodes.forEach((node, index) => {
        const { id, code, codeId, start, end } = readSportscodeInstance(node);
        const label = id ? `instance ${id}` : `instance #${index + 1}`;

        if (!id || !code) {
            throw new Error(`Invalid ${label}: ID and code are required.`);
        }
        if (!isFinite(start) || !isFinite(end)) {
            throw new Error(`Invalid ${label}: start and end must be numbers.`);
        }
        if (end < start) {
            throw new Error(`Invalid ${label}: end must not be before start.`);
        }
        if (codeId !== undefined && !rowIds.has(codeId)) {
            throw new Error(`Invalid ${label}: code_id ${codeId} has no matching row.`);
        }
    });
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

    const instancesElement = getSportscodeInstancesElement(xmlDoc);
    if (instancesElement) {
        validateSportscodeDocument(xmlDoc, instancesElement);
        return xmlDoc;
    }

    // Legacy custom export format (<event> elements)
    const eventNodes = Array.from(xmlDoc.getElementsByTagName('event'));

    if (eventNodes.length > 0) {
        // Relaxed: skip invalid events, only fail if none are valid
        let validEventFound = false;
        eventNodes.forEach(node => {
            const eventName = node.getAttribute('event');
            const timeMs = node.getAttribute('timeMs');

            if (!eventName || !timeMs || isNaN(parseInt(timeMs, 10))) {
                return;
            }
            validEventFound = true;
        });
        if (!validEventFound) {
            throw new Error('No valid events found in XML.');
        }
    } else {
        // Loose <instance> elements without a <file> root
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
 * Generate Sportscode XML for a complete game suitable for export.
 * Game-level metadata (teams, date) and favourites are not part of the Sportscode format.
 * @param {Object} game - Game data object containing events
 * @param {string|number} [gameTitle] - Display name or index of the game (unused)
 * @returns {string} Sportscode XML document for the game
 */
export const generateGameXml = (game, gameTitle) => generateSportscodeXml(game?.events);
