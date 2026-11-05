/**
 * Sequence spike. Used by the /spike/sequences page and the command-line check.
 * Match capture and review do not import it.
 *
 * A chain is one team's possession tags. Cards, substitutions, and the other
 * team's tags stay out of it. The same events always produce the same chains.
 */

export const DEFAULT_GAP_MS = 15000;
export const DEFAULT_COUNTER_MS = 10000;

const OUTCOME_RANK = { Shot: 1, PC: 2, Goal: 3 };

const CODE_START = /^(?:BW\d?|BS\d?|OH|PC|APC|A25E|CE|SHOT|GOAL|GREEN|YELLOW|RED|CARD|SUB|SUBSTITUTION|KICKOFF|Q[1-4]|START|QUARTER)\b/i;

/**
 * @param {object} event
 * @param {string[]} [teams]
 * @returns {{ team: string, code: string }}
 */
export function splitTeamAndCode(event, teams = []) {
    const raw = String(event?.event || event?.code || '').trim();
    const explicitTeam = explicitTeamOf(event, teams);
    if (explicitTeam) {
        return { team: explicitTeam, code: stripTeam(raw, explicitTeam).toUpperCase() };
    }
    const parts = raw.split(/\s+/);
    if (parts.length >= 2 && !CODE_START.test(parts[0])) {
        return { team: parts[0], code: parts.slice(1).join(' ').toUpperCase() };
    }
    return { team: 'Untagged', code: raw.toUpperCase() };
}

/**
 * @param {string} code
 * @returns {{ role: string, quarter?: string, attack?: string, reason?: string }}
 */
export function classifyCode(code) {
    const c = String(code || '').toUpperCase();
    const quarter = /^(?:Q([1-4])|QUARTER\s*([1-4])|START\s*Q([1-4]))$/.exec(c);
    if (quarter) {
        return { role: 'quarter', quarter: `Q${quarter[1] || quarter[2] || quarter[3]}` };
    }
    if (/\b(GREEN|YELLOW|RED|CARD|SUBSTITUTION|SUB)\b/.test(c)) {
        return { role: 'ignore', reason: 'card-or-sub' };
    }
    if (/\bGOAL\b/.test(c)) return { role: 'goal' };
    if (/\b(PC|PENALTY\s*CORNER)\b/.test(c)) return { role: 'pc' };
    if (/\bSHOT\b/.test(c)) return { role: 'shot' };
    if (/\b(BW\d?|BALL\s*WON)\b/.test(c)) return { role: 'bw' };
    if (/\b(BS\d?|OH|KICKOFF)\b/.test(c)) return { role: 'restart' };
    if (/\b(A25E|25M\s*ENTRY)\b/.test(c)) return { role: 'attack', attack: 'A25E' };
    if (/\b(CE|CIRCLE\s*ENTRY)\b/.test(c)) return { role: 'attack', attack: 'CE' };
    return { role: 'ignore', reason: 'unrecognized-code' };
}

/**
 * @param {Array<object>} events
 * @param {{ gapMs?: number, counterMs?: number, teams?: string[] }} [options]
 */
export function buildSequences(events, options = {}) {
    const started = performance.now();
    const gapMs = options.gapMs ?? DEFAULT_GAP_MS;
    const counterMs = options.counterMs ?? DEFAULT_COUNTER_MS;
    const teams = options.teams || [];
    const source = Array.isArray(events) ? events : [];

    const items = source.map((event, index) => prepareItem(event, index, teams));
    const ordered = [...items].sort((a, b) => a.timeMs - b.timeMs || a.index - b.index);

    /** @type {Map<string, object>} */
    const open = new Map();
    const sequences = [];
    const dispositions = [];
    let currentQuarter = null;
    let quarterStartMs = 0;

    for (const item of ordered) {
        expireStale(open, sequences, item.timeMs, gapMs, counterMs);

        if (item.role === 'quarter') {
            currentQuarter = item.quarter;
            quarterStartMs = item.timeMs;
            dispositions.push(disposition(item, 'ignored', { reason: 'quarter-marker' }));
            continue;
        }
        if (item.role === 'ignore') {
            dispositions.push(disposition(item, 'ignored', { reason: item.reason }));
            continue;
        }

        if (item.role === 'bw') {
            for (const [other, chain] of [...open.entries()]) {
                if (other !== item.team) {
                    closeChain(chain, 'opponent-bw', item.timeMs, counterMs);
                    open.delete(other);
                    sequences.push(chain);
                }
            }
        }

        let chain = open.get(item.team);
        if (!chain) {
            chain = startChain(item, item.quarterField || currentQuarter, quarterStartMs);
            open.set(item.team, chain);
        }
        appendItem(chain, item);
        dispositions.push(disposition(item, 'in-sequence', { sequenceId: chain.id }));
        if (chain.outcome === 'Goal') {
            closeChain(chain, 'goal', item.timeMs, counterMs);
            open.delete(item.team);
            sequences.push(chain);
        }
    }

    for (const chain of open.values()) {
        closeChain(chain, 'end', null, counterMs);
        sequences.push(chain);
    }

    const published = sequences.map(publishSequence);
    published.sort((a, b) => a.startTimeMs - b.startTimeMs || a.id.localeCompare(b.id));
    dispositions.sort((a, b) => a.index - b.index);

    const circleEntries = dispositions.filter(entry => entry.attack === 'CE');
    const circleEntriesByOutcome = {
        Goal: 0, PC: 0, Shot: 0, Turnover: 0, 'No shot': 0, 'No circle': 0, 'No entry': 0
    };
    for (const sequence of published) {
        const count = sequence.events.filter(event => event.attack === 'CE').length;
        if (count && circleEntriesByOutcome[sequence.outcome] !== undefined) {
            circleEntriesByOutcome[sequence.outcome] += count;
        }
    }

    return {
        sequences: published,
        dispositions,
        stats: {
            eventCount: source.length,
            sequenceCount: sequences.length,
            circleEntriesCoded: circleEntries.length,
            circleEntriesInSequences: circleEntries.filter(entry => entry.disposition === 'in-sequence').length,
            circleEntriesByOutcome,
            elapsedMs: Math.round((performance.now() - started) * 100) / 100,
            rules: { gapMs, counterMs }
        }
    };
}

function explicitTeamOf(event, teams) {
    if (event?.team) return String(event.team);
    if (event?.isTeam1 === true) return teamAt(teams, 0);
    if (event?.isTeam1 === false) return teamAt(teams, 1);
    return null;
}

function teamAt(teams, index) {
    const team = teams?.[index];
    if (!team) return null;
    if (typeof team === 'string') return team;
    return team.code || team.name || null;
}

function stripTeam(raw, team) {
    const prefix = `${team} `;
    return raw.toUpperCase().startsWith(prefix.toUpperCase()) ? raw.slice(prefix.length).trim() : raw;
}

function prepareItem(event, index, teams) {
    const { team, code } = splitTeamAndCode(event, teams);
    const classification = classifyCode(code);
    const timeMs = Number(event?.timeMs);
    return {
        id: event?.id != null ? String(event.id) : `i${index}`,
        index,
        team,
        code,
        timeMs: Number.isFinite(timeMs) ? timeMs : 0,
        lead: numberOrNull(event?.lead ?? event?.leadTime),
        labels: Array.isArray(event?.labels) ? event.labels.map(label => ({ ...label })) : [],
        quarterField: event?.quarter || null,
        channel: channelFromLabels(event?.labels),
        ...classification
    };
}

function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function channelFromLabels(labels) {
    if (!Array.isArray(labels)) return null;
    for (const label of labels) {
        const text = String(label?.text || '');
        if (/channel/i.test(String(label?.group || '')) && /^(left|center|right)$/i.test(text)) {
            return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
        }
    }
    return null;
}

function startChain(item, quarter, quarterStartMs) {
    return {
        id: `seq-${item.team}-${item.id}`,
        team: item.team,
        quarter,
        quarterStartMs,
        startTimeMs: item.timeMs,
        endTimeMs: item.timeMs,
        items: [],
        outcome: null,
        outcomeRank: 0,
        closedBecause: null,
        gapSeconds: null
    };
}

function appendItem(chain, item) {
    chain.items.push(item);
    chain.endTimeMs = item.timeMs;
    if (item.role === 'goal') assignOutcome(chain, 'Goal');
    if (item.role === 'pc') assignOutcome(chain, 'PC');
    if (item.role === 'shot') assignOutcome(chain, 'Shot');
}

function assignOutcome(chain, outcome) {
    const rank = OUTCOME_RANK[outcome] || 0;
    if (rank > chain.outcomeRank) {
        chain.outcomeRank = rank;
        chain.outcome = outcome;
    }
}

function expireStale(open, sequences, atTimeMs, gapMs, counterMs) {
    for (const [team, chain] of [...open.entries()]) {
        if (atTimeMs - chain.endTimeMs > gapMs) {
            closeChain(chain, 'gap', atTimeMs, counterMs);
            open.delete(team);
            sequences.push(chain);
        }
    }
}

function closeChain(chain, reason, atTimeMs, counterMs) {
    chain.closedBecause = reason;
    if (reason === 'gap' && Number.isFinite(atTimeMs)) {
        chain.gapSeconds = Math.round((atTimeMs - chain.endTimeMs) / 1000);
    }
        if (!chain.outcome) {
            if (reason === 'opponent-bw') chain.outcome = 'Turnover';
            else if (chain.items.some(item => item.attack === 'CE')) chain.outcome = 'No shot';
            else if (chain.items.some(item => item.attack === 'A25E')) chain.outcome = 'No circle';
            else chain.outcome = 'No entry';
        }
    chain.originType = originOf(chain, counterMs);
    chain.primaryChannel = channelOf(chain);
}

function originOf(chain, counterMs) {
    const first = chain.items[0];
    if (!first) return null;
    if (first.role === 'restart' || first.role === 'pc') return 'Restart';
    const attack = chain.items.find(item =>
        item.role === 'attack' || item.role === 'shot' || item.role === 'goal' || item.role === 'pc'
    );
    if (first.role === 'bw') {
        if (!attack) return null;
        return attack.timeMs - first.timeMs <= counterMs ? 'Counter' : 'Build-Up';
    }
    if (attack) return 'Build-Up';
    return null;
}

function channelOf(chain) {
    const circle = chain.items.find(item => item.attack === 'CE' && item.channel);
    if (circle) return circle.channel;
    const entry = chain.items.find(item => item.attack === 'A25E' && item.channel);
    return entry ? entry.channel : null;
}

function disposition(item, kind, extra) {
    return {
        id: item.id,
        index: item.index,
        team: item.team,
        code: item.code,
        timeMs: item.timeMs,
        attack: item.attack || null,
        disposition: kind,
        ...extra
    };
}

function publishSequence(chain) {
    const first = chain.items[0];
    const seekSeconds = Math.max(0, chain.startTimeMs / 1000 - (first?.lead ?? 0));
    return {
        id: chain.id,
        team: chain.team,
        quarter: chain.quarter,
        startTimeMs: chain.startTimeMs,
        endTimeMs: chain.endTimeMs,
        videoStart: formatClock(chain.startTimeMs),
        videoEnd: formatClock(chain.endTimeMs),
        matchClockStart: formatClock(chain.startTimeMs - chain.quarterStartMs),
        matchClockEnd: formatClock(chain.endTimeMs - chain.quarterStartMs),
        seekSeconds: Math.round(seekSeconds),
        originType: chain.originType,
        primaryChannel: chain.primaryChannel,
        outcome: chain.outcome,
        closedBecause: chain.closedBecause,
        gapSeconds: chain.gapSeconds,
        codes: chain.items.map(item => item.code),
        eventInstanceIds: chain.items.map(item => item.id),
        events: chain.items.map(item => ({
            id: item.id,
            index: item.index,
            code: item.code,
            timeMs: item.timeMs,
            attack: item.attack || null,
            channel: item.channel
        }))
    };
}

export function formatClock(ms) {
    const total = Math.max(0, Math.round(Number(ms) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
