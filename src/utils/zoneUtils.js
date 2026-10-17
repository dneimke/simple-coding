/**
 * Sticky zone helpers. The active zone is always held from Team 1's perspective;
 * with a "mirrored" perspective Team 2's zone is the opposite end of the pitch.
 * @module utils/zoneUtils
 */

/**
 * Returns the zone at the opposite end of the list (e.g. 1 <-> 4, 2 <-> 3 for four zones)
 * @param {string} zone - Zone value from Team 1's perspective
 * @param {string[]} values - Ordered zone values
 * @returns {string} Mirrored zone, or the input when it is not in the list
 */
export function mirrorZone(zone, values) {
    const index = values.indexOf(String(zone));
    if (index === -1) return String(zone);
    return values[values.length - 1 - index];
}

/**
 * Returns the zone a team is in given the active (Team 1) zone
 * @param {string} zone - Active zone from Team 1's perspective
 * @param {number|string} slot - Team slot (1 or 2)
 * @param {{values: string[], perspective?: string}} zones - Zones block from the board config
 * @returns {string} Zone for that team
 */
export function zoneForTeam(zone, slot, zones) {
    const mirrored = (zones?.perspective ?? 'mirrored') === 'mirrored';
    if (mirrored && Number(slot) === 2) return mirrorZone(zone, zones.values);
    return String(zone);
}

/**
 * Builds the event name to log for a button, appending the team's zone for zoned buttons
 * @param {{event: string, zoned?: boolean, slot?: number|string}} button - Button event ("FIRE BS"), zoned flag and team slot
 * @param {{zone: string, zones: Object}} context - Active zone and the board's zones block
 * @returns {string} Event name, e.g. "FIRE BS2"
 */
export function resolveEventName({ event, zoned, slot }, { zone, zones }) {
    if (!zoned || !zones) return event;
    return `${event}${zoneForTeam(zone, slot ?? 1, zones)}`;
}
