import { formatClock } from './copy.js';

/**
 * Sequence spike. Used by the /spike/sequences page and the command-line check.
 * Match capture and review do not import it.
 *
 * Classifies attacking 25m entries (A25E) and circle entries (CE) as
 * Counter or Build-Up from the preceding same-team possession tags.
 */

const DEFAULT_GAP_MS = 25000;
const DEFAULT_COUNTER_MS = 10000;

const CODE_START = /^(?:BW\d?|BS\d?|OH|PC|APC|A25E|CE|SHOT|GOAL|GREEN|YELLOW|RED|CARD|SUB|SUBSTITUTION|KICKOFF|Q[1-4]|START|QUARTER)\b/i;

const ROLE_RULES = [
    [/\b(GREEN|YELLOW|RED|CARD|SUBSTITUTION|SUB)\b/, { role: 'ignore' }],
    [/\bGOAL\b/, { role: 'goal' }],
    [/\b(PC|APC|PENALTY\s*CORNER)\b/, { role: 'pc' }],
    [/\bSHOT\b/, { role: 'shot' }],
    [/\b(BW\d?|BALL\s*WON)\b/, { role: 'bw' }],
    [/\b(BS\d?|OH|KICKOFF)\b/, { role: 'restart' }],
    [/\b(A25E|25M\s*ENTRY)\b/, { role: 'attack', attack: 'A25E' }],
    [/\b(CE|CIRCLE\s*ENTRY)\b/, { role: 'attack', attack: 'CE' }]
];

/**
 * @param {Array<object>} events
 * @param {{ gapMs?: number, counterMs?: number, teams?: Array<string|object> }} [options]
 */
export function buildSequences(events, options = {}) {
    const started = performance.now();
    const gapMs = options.gapMs ?? DEFAULT_GAP_MS;
    const counterMs = options.counterMs ?? DEFAULT_COUNTER_MS;
    const teamNames = normalizeTeamNames(options.teams);
    const source = Array.isArray(events) ? events : [];

    const ordered = source
        .map((event, index) => prepareItem(event, index, teamNames))
        .sort((a, b) => a.timeMs - b.timeMs || a.index - b.index);

    const state = {
        open: new Map(),
        entries: [],
        currentQuarter: null,
        quarterStartMs: 0,
        gapMs,
        counterMs
    };

    ordered.forEach(item => placeItem(state, item));

    const a25Entries = countSplit(state.entries, 'A25E');
    const circleEntries = countSplit(state.entries, 'CE');

    return {
        entries: state.entries,
        sequences: state.entries,
        stats: {
            eventCount: source.length,
            entryCount: state.entries.length,
            sequenceCount: state.entries.length,
            a25Entries,
            circleEntries,
            circleEntriesCoded: circleEntries.total,
            circleEntriesInSequences: circleEntries.total,
            elapsedMs: Math.round((performance.now() - started) * 100) / 100,
            rules: { gapMs, counterMs }
        }
    };
}

function countSplit(entries, entryType) {
    const group = entries.filter(entry => entry.entryType === entryType);
    const counter = group.filter(entry => entry.originType === 'Counter').length;
    return {
        total: group.length,
        counter,
        buildUp: group.length - counter
    };
}

function placeItem(state, item) {
    expireStale(state.open, item.timeMs, state.gapMs);
    if (recordMarker(state, item)) return;
    closeOtherTeams(state.open, item.team);
    const chain = ensureChain(state, item);
    chain.items.push(item);
    chain.endTimeMs = item.timeMs;
    if (item.attack) {
        state.entries.push(publishEntry(chain, item, state.counterMs, state.gapMs));
    }
    if (item.role === 'goal') {
        state.open.delete(item.team);
    }
}

function recordMarker(state, item) {
    if (item.role === 'quarter') {
        state.currentQuarter = item.quarter;
        state.quarterStartMs = item.timeMs;
        return true;
    }
    return item.role === 'ignore';
}

function expireStale(open, atTimeMs, gapMs) {
    for (const [team, chain] of [...open.entries()]) {
        if (atTimeMs - chain.endTimeMs > gapMs) {
            open.delete(team);
        }
    }
}

function closeOtherTeams(open, activeTeam) {
    for (const team of [...open.keys()]) {
        if (team !== activeTeam) open.delete(team);
    }
}

function ensureChain(state, item) {
    let chain = state.open.get(item.team);
    if (!chain) {
        chain = {
            team: item.team,
            quarter: item.quarterField || state.currentQuarter,
            quarterStartMs: state.quarterStartMs,
            startTimeMs: item.timeMs,
            endTimeMs: item.timeMs,
            items: []
        };
        state.open.set(item.team, chain);
    }
    return chain;
}

function publishEntry(chain, item, counterMs, gapMs) {
    const first = chain.items[0];
    const seekSeconds = Math.max(0, chain.startTimeMs / 1000 - (first?.lead ?? 0));
    const origin = classifyEntryOrigin(chain.items, item, counterMs, gapMs);
    return {
        id: `entry-${item.team}-${item.id}`,
        eventId: item.id,
        team: chain.team,
        entryType: item.attack,
        code: item.code,
        quarter: item.quarterField || chain.quarter,
        timeMs: item.timeMs,
        startTimeMs: chain.startTimeMs,
        endTimeMs: item.timeMs,
        videoTime: formatClock(item.timeMs),
        matchClock: formatClock(item.timeMs - chain.quarterStartMs),
        seekSeconds: Math.round(seekSeconds),
        originType: origin.originType,
        triggerCode: origin.triggerCode,
        secondsFromTrigger: origin.secondsFromTrigger,
        reason: origin.reason,
        codes: chain.items.map(step => step.code),
        eventInstanceIds: chain.items.map(step => step.id),
        events: chain.items.map(step => ({
            id: step.id,
            index: step.index,
            code: step.code,
            timeMs: step.timeMs,
            attack: step.attack || null
        }))
    };
}

function classifyEntryOrigin(items, entryItem, counterMs, gapMs) {
    const bwItem = findLastBallWon(items);
    if (bwItem) {
        return classifyFromBallWon(bwItem, entryItem, counterMs);
    }
    const first = items[0];
    if (first && first.id !== entryItem.id) {
        const seconds = Math.round((entryItem.timeMs - first.timeMs) / 1000);
        return {
            originType: 'Build-Up',
            triggerCode: first.code,
            secondsFromTrigger: seconds,
            reason: `${seconds}s after ${first.code}`
        };
    }
    return {
        originType: 'Build-Up',
        triggerCode: null,
        secondsFromTrigger: null,
        reason: `No prior same-team tag in ${gapMs / 1000}s`
    };
}

function findLastBallWon(items) {
    for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].role === 'bw') return items[i];
    }
    return null;
}

function classifyFromBallWon(bwItem, entryItem, counterMs) {
    const deltaMs = entryItem.timeMs - bwItem.timeMs;
    const seconds = Math.round(deltaMs / 1000);
    if (deltaMs <= counterMs) {
        return {
            originType: 'Counter',
            triggerCode: bwItem.code,
            secondsFromTrigger: seconds,
            reason: `${seconds}s after ${bwItem.code}`
        };
    }
    return {
        originType: 'Build-Up',
        triggerCode: bwItem.code,
        secondsFromTrigger: seconds,
        reason: `${seconds}s after ${bwItem.code} (over ${counterMs / 1000}s counter window)`
    };
}

function normalizeTeamNames(teams) {
    if (!Array.isArray(teams)) return [];
    return teams.map(teamNameOf).filter(Boolean);
}

function teamNameOf(team) {
    if (typeof team === 'string') return team;
    return team?.code || team?.name || '';
}

function splitTeamAndCode(event, teamNames) {
    const raw = String(event?.event || event?.code || '').trim();
    const explicitTeam = explicitTeamOf(event, teamNames);
    if (explicitTeam) {
        return { team: explicitTeam, code: stripTeam(raw, explicitTeam).toUpperCase() };
    }
    const parts = raw.split(/\s+/);
    if (parts.length >= 2 && !CODE_START.test(parts[0])) {
        return { team: parts[0], code: parts.slice(1).join(' ').toUpperCase() };
    }
    return { team: 'Untagged', code: raw.toUpperCase() };
}

function explicitTeamOf(event, teamNames) {
    if (event?.team) return String(event.team);
    if (event?.isTeam1 === true) return teamNames[0] || null;
    if (event?.isTeam1 === false) return teamNames[1] || null;
    return null;
}

function stripTeam(raw, team) {
    const prefix = `${team} `;
    return raw.toUpperCase().startsWith(prefix.toUpperCase()) ? raw.slice(prefix.length).trim() : raw;
}

function classifyCode(code) {
    const c = String(code || '').toUpperCase();
    const quarter = /^(?:Q([1-4])|QUARTER\s*([1-4])|START\s*Q([1-4]))$/.exec(c);
    if (quarter) {
        return { role: 'quarter', quarter: `Q${quarter[1] || quarter[2] || quarter[3]}` };
    }
    const match = ROLE_RULES.find(([pattern]) => pattern.test(c));
    return match ? { ...match[1] } : { role: 'ignore' };
}

function prepareItem(event, index, teamNames) {
    const source = event || {};
    const named = splitTeamAndCode(source, teamNames);
    return {
        ...itemIdentity(source, index, named),
        ...itemTiming(source),
        quarterField: source.quarter || null,
        ...classifyCode(named.code)
    };
}

function itemIdentity(source, index, named) {
    const id = source.id == null ? `i${index}` : String(source.id);
    return { id, index, team: named.team, code: named.code };
}

function itemTiming(source) {
    const timeMs = Number(source.timeMs);
    return {
        timeMs: Number.isFinite(timeMs) ? timeMs : 0,
        lead: numberOrNull(source.lead == null ? source.leadTime : source.lead)
    };
}

function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}
