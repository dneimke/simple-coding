import { resolveEventName } from './zoneUtils.js';
import { formatTime } from './formatUtils.js';

/**
 * Determine if an event button corresponds to a penalty corner
 * @param {HTMLElement} button
 * @returns {boolean}
 */
export function isPenaltyCornerButton(button) {
    if (!button) return false;
    const ds = button.dataset || {};
    return ds.baseEvent === 'PC' ||
        Boolean(ds.event?.endsWith('PC')) ||
        Boolean(button.textContent?.includes('Penalty Corner'));
}

/**
 * Extract team code for a given button team slot
 * @param {string|number} teamSlot
 * @param {Array<{code?: string}>} teams
 * @returns {string|null}
 */
export function getButtonTeamCode(teamSlot, teams) {
    if (!teamSlot || !Array.isArray(teams)) return null;
    const index = Number(teamSlot) - 1;
    return teams[index]?.code || null;
}

/**
 * Build capture event payload from clicked button and current match telemetry
 * @param {HTMLElement} button
 * @param {Object} options
 * @param {string|null} [options.zone]
 * @param {Object} [options.zones]
 * @param {Array<{code?: string}>} [options.teams]
 * @param {number} [options.elapsedTime]
 * @returns {Object}
 */
export function createCaptureEventPayload(button, options = {}) {
    const ds = button.dataset || {};
    const {
        zone = null,
        zones = null,
        teams = null,
        elapsedTime = 0
    } = options;

    const eventName = resolveEventName(
        { event: ds.event, zoned: ds.zoned === 'true', slot: ds.teamSlot },
        { zone, zones }
    );
    const clip = {};
    if (ds.lead !== undefined) clip.lead = Number(ds.lead);
    if (ds.lag !== undefined) clip.lag = Number(ds.lag);

    const timeMs = Number(elapsedTime) || 0;
    const isPC = isPenaltyCornerButton(button);
    const teamCode = getButtonTeamCode(ds.teamSlot, teams);

    return {
        id: `pc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        event: eventName,
        timeMs,
        timestamp: formatTime(timeMs),
        eventCode: isPC ? 'PC' : (ds.baseEvent || ds.event || eventName),
        team: teamCode,
        leadTime: isPC ? 10 : (clip.lead ?? 10),
        lagTime: isPC ? 15 : (clip.lag ?? 15),
        ...clip
    };
}
