/**
 * Tactical event analysis and label schemas for field hockey.
 * Supports Channel tagging, Penalty Corner execution, Turnover classification,
 * and deterministic possession origin derivation (Counter-Attack vs Build-Up).
 */

export const LABEL_SCHEMAS = {
    channel: {
        group: 'Channel',
        prompt: 'Which channel did they enter?',
        description: 'Attack channel or flank entry',
        options: [
            { key: '1', text: 'Left', short: 'L' },
            { key: '2', text: 'Center', short: 'C' },
            { key: '3', text: 'Right', short: 'R' }
        ]
    },
    penaltyCorner: {
        group: 'Execution',
        prompt: 'How was the penalty corner executed?',
        description: 'Penalty corner routine execution type',
        options: [
            { key: '1', text: 'Direct', short: 'Direct' },
            { key: '2', text: 'Slip', short: 'Slip' },
            { key: '3', text: 'Broken', short: 'Broken' }
        ]
    },
    turnover: {
        group: 'Type',
        prompt: 'How was the ball won?',
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

/**
 * Returns a user-friendly plain English name for an event code or string.
 * E.g. 'PRIDE CE' -> 'Circle Entry', 'THUNDER A25E' -> 'Attacking 25m Entry'.
 * @param {string|Object} eventOrCode 
 * @returns {string}
 */
export const getFriendlyEventName = (eventOrCode) => {
    if (!eventOrCode) return '';
    let raw = typeof eventOrCode === 'object' ? (eventOrCode.event || '') : String(eventOrCode);
    raw = raw.trim();

    const mapCode = (str) => {
        const upper = str.trim().toUpperCase();
        if (/^CE\b|CIRCLE\s*ENTRY/i.test(upper)) return 'Circle Entry';
        if (/^A25E\b|25M\s*ENTRY/i.test(upper)) return 'Attacking 25m Entry';
        if (/^BW\b|BALL\s*WON/i.test(upper)) return 'Ball Won';
        if (/^BL\b|BALL\s*LOST/i.test(upper)) return 'Ball Lost';
        if (/^(PC|APC)\b|PENALTY\s*CORNER/i.test(upper)) return 'Penalty Corner';
        if (/^SHOT\b/i.test(upper)) return 'Shot';
        if (/^GOAL\b/i.test(upper)) return 'Goal';
        if (/^BS1\b/i.test(upper)) return 'Build-Up Zone 1';
        if (/^BS2\b/i.test(upper)) return 'Build-Up Zone 2';
        if (/^BS3\b/i.test(upper)) return 'Build-Up Zone 3';
        if (/^BS4\b/i.test(upper)) return 'Build-Up Zone 4';
        return null;
    };

    const direct = mapCode(raw);
    if (direct) return direct;

    const parts = raw.split(/\s+/);
    if (parts.length >= 2) {
        const withoutTeam = parts.slice(1).join(' ');
        const matched = mapCode(withoutTeam);
        if (matched) return matched;
    }

    return raw;
};

/**
 * Calculates grouped sweep scope options (presets) for a list of timeline events.
 * Enables 1-tap focused sweeps (e.g. Pride Circle Entries) vs full match audits.
 * @param {Array<Object>} timelineEvents 
 * @returns {Array<Object>}
 */
export const getSweepScopeOptions = (timelineEvents = []) => {
    if (!Array.isArray(timelineEvents)) return [];

    const candidates = timelineEvents.filter(e => Boolean(getLabelSchemaForEvent(e)));
    if (candidates.length === 0) return [];

    const unlabelled = candidates.filter(e => !Array.isArray(e.labels) || e.labels.length === 0);
    const targetPool = unlabelled.length > 0 ? unlabelled : candidates;

    const options = [];
    const teamMap = new Map();

    targetPool.forEach(ev => {
        const team = extractTeamFromEvent(ev) || 'Unassigned';
        if (!teamMap.has(team)) {
            teamMap.set(team, []);
        }
        teamMap.get(team).push(ev);
    });

    teamMap.forEach((teamEvents, team) => {
        // Circle Entries
        const ceEvents = teamEvents.filter(e => /\b(CE|CIRCLE\s*ENTRY)\b/i.test(e.event));
        if (ceEvents.length > 0) {
            options.push({
                id: `${team}-CE`,
                team,
                type: 'CE',
                label: `${team} Circle Entries (${ceEvents.length})`,
                description: 'Categorize entry channels (Left, Center, Right)',
                count: ceEvents.length,
                estTime: ceEvents.length <= 20 ? `~${Math.max(15, ceEvents.length * 3)}s pass` : `~${Math.round(ceEvents.length * 3 / 60)}m pass`,
                filter: (e) => (extractTeamFromEvent(e) || 'Unassigned') === team && /\b(CE|CIRCLE\s*ENTRY)\b/i.test(e.event)
            });
        }

        // Attacking 25s
        const a25Events = teamEvents.filter(e => /\b(A25E|25M\s*ENTRY)\b/i.test(e.event));
        if (a25Events.length > 0) {
            options.push({
                id: `${team}-A25E`,
                team,
                type: 'A25E',
                label: `${team} Attacking 25s (${a25Events.length})`,
                description: 'Categorize 25m entry channels',
                count: a25Events.length,
                estTime: `~${Math.max(1, Math.round(a25Events.length * 3.5 / 60))}m pass`,
                filter: (e) => (extractTeamFromEvent(e) || 'Unassigned') === team && /\b(A25E|25M\s*ENTRY)\b/i.test(e.event)
            });
        }

        // Ball Won / Turnovers
        const bwEvents = teamEvents.filter(e => /\b(BW|BALL\s*WON|TURNOVER)\b/i.test(e.event));
        if (bwEvents.length > 0) {
            options.push({
                id: `${team}-BW`,
                team,
                type: 'BW',
                label: `${team} Turnovers / Ball Won (${bwEvents.length})`,
                description: 'Classify tackle vs intercept vs unforced',
                count: bwEvents.length,
                estTime: `~${Math.max(1, Math.round(bwEvents.length * 3.5 / 60))}m pass`,
                filter: (e) => (extractTeamFromEvent(e) || 'Unassigned') === team && /\b(BW|BALL\s*WON|TURNOVER)\b/i.test(e.event)
            });
        }

        // All for this team
        if (teamEvents.length > 0) {
            options.push({
                id: `${team}-ALL`,
                team,
                type: 'ALL',
                label: `All ${team} Events (${teamEvents.length})`,
                description: `Complete sweep for ${team}`,
                count: teamEvents.length,
                estTime: `~${Math.max(1, Math.round(teamEvents.length * 3.5 / 60))}m pass`,
                filter: (e) => (extractTeamFromEvent(e) || 'Unassigned') === team
            });
        }
    });

    // All match events
    options.push({
        id: 'all',
        label: `All Match Events (${targetPool.length})`,
        description: 'Full sweep across all teams and schemas',
        count: targetPool.length,
        estTime: `~${Math.max(1, Math.round(targetPool.length * 3.5 / 60))}m full audit`,
        filter: () => true
    });

    return options;
};
