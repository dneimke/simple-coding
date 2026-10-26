/**
 * Tactical event analysis and label schemas for field hockey.
 * Supports Channel tagging, Penalty Corner execution, Turnover classification,
 * and deterministic possession origin derivation (Counter-Attack vs Build-Up).
 */

export const LABEL_SCHEMAS = {
    channel: {
        group: 'Channel',
        description: 'Attack channel or flank entry',
        options: [
            { key: '1', text: 'Left', short: 'L' },
            { key: '2', text: 'Center', short: 'C' },
            { key: '3', text: 'Right', short: 'R' }
        ]
    },
    penaltyCorner: {
        group: 'Execution',
        description: 'Penalty corner routine execution type',
        options: [
            { key: '1', text: 'Direct', short: 'Direct' },
            { key: '2', text: 'Slip', short: 'Slip' },
            { key: '3', text: 'Broken', short: 'Broken' }
        ]
    },
    turnover: {
        group: 'Type',
        description: 'Turnover or duel resolution type',
        options: [
            { key: '1', text: 'Tackle', short: 'Tackle' },
            { key: '2', text: 'Intercept', short: 'Intercept' },
            { key: '3', text: 'Unforced', short: 'Unforced' }
        ]
    }
};

/**
 * Extracts team code prefix from an event name or object.
 * E.g. "FIRE CE" -> "FIRE", "TIGERS PC" -> "TIGERS".
 * @param {string|Object} eventOrCode 
 * @returns {string|null}
 */
export const extractTeamFromEvent = (eventOrCode) => {
    if (!eventOrCode) return null;
    if (typeof eventOrCode === 'object') {
        if (eventOrCode.team) return eventOrCode.team;
        eventOrCode = eventOrCode.event || '';
    }
    const parts = String(eventOrCode).trim().split(/\s+/);
    if (parts.length >= 2) {
        return parts[0];
    }
    return null;
};

/**
 * Returns matching built-in label schema for an event or code.
 * @param {string|Object} eventOrCode 
 * @returns {Object|null}
 */
export const getLabelSchemaForEvent = (eventOrCode) => {
    if (!eventOrCode) return null;
    const rawCode = typeof eventOrCode === 'object' ? (eventOrCode.event || '') : String(eventOrCode);
    const upper = rawCode.trim().toUpperCase();

    // Circle Entries & Attacking 25
    if (/\b(CE|A25E|CIRCLE\s*ENTRY|25M\s*ENTRY)\b/.test(upper)) {
        return LABEL_SCHEMAS.channel;
    }

    // Penalty Corners
    if (/\b(PC|PENALTY\s*CORNER)\b/.test(upper)) {
        return LABEL_SCHEMAS.penaltyCorner;
    }

    // Turnovers / Ball Won / Ball Lost
    if (/\b(BW|BL|TURNOVER|BALL\s*WON|BALL\s*LOST)\b/.test(upper)) {
        return LABEL_SCHEMAS.turnover;
    }

    return null;
};

/**
 * Determines if an event resulted from a rapid counter-attack (turnover won within windowSeconds).
 * @param {Object} targetEvent 
 * @param {Array<Object>} allEvents 
 * @param {number} windowSeconds 
 * @returns {boolean}
 */
export const isCounterAttack = (targetEvent, allEvents = [], windowSeconds = 10) => {
    if (!targetEvent || typeof targetEvent.timeMs !== 'number' || !Array.isArray(allEvents)) {
        return false;
    }

    const targetTeam = extractTeamFromEvent(targetEvent);
    const targetTimeMs = targetEvent.timeMs;
    const windowMs = windowSeconds * 1000;

    for (let i = allEvents.length - 1; i >= 0; i--) {
        const ev = allEvents[i];
        if (!ev || ev.id === targetEvent.id) continue;
        const diffMs = targetTimeMs - ev.timeMs;
        if (diffMs < 0) continue; // Event is after target
        if (diffMs > windowMs) break; // Exceeded lookback window

        const upper = String(ev.event || '').toUpperCase();
        const evTeam = extractTeamFromEvent(ev);

        // Check if preceding event was Ball Won (BW) for the SAME team
        const isBallWon = /\b(BW|BALL\s*WON)\b/.test(upper);
        if (isBallWon) {
            if (targetTeam && evTeam && targetTeam === evTeam) {
                return true;
            }
            if (!targetTeam && !evTeam) {
                return true;
            }
        }
    }

    return false;
};

/**
 * Computes derived labels for an event (e.g. Origin: Counter vs Build-Up).
 * @param {Object} event 
 * @param {Array<Object>} allEvents 
 * @returns {Array<{ group: string, text: string }>}
 */
export const getDerivedLabels = (event, allEvents = []) => {
    if (!event) return [];
    const upper = String(event.event || '').toUpperCase();
    const isAttackingEvent = /\b(CE|A25E|CIRCLE\s*ENTRY|SHOT|GOAL)\b/.test(upper);

    if (isAttackingEvent) {
        const counter = isCounterAttack(event, allEvents);
        return [{ group: 'Origin', text: counter ? 'Counter' : 'Build-Up' }];
    }

    return [];
};

/**
 * Formats a label object or array of labels into a readable string.
 * @param {Object|Array<Object>|null} labels 
 * @returns {string}
 */
export const formatLabelText = (labels) => {
    if (!labels) return '';
    if (!Array.isArray(labels)) {
        return labels.text || '';
    }
    return labels.map(l => l.text).filter(Boolean).join(' · ');
};
