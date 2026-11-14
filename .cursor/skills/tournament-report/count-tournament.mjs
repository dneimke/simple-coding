/**
 * Count tournament stats from raw Sportscode XML.
 *
 * Penalty corners are counted once: an award (ASC, PC Won) and the corner
 * taken (PC, PCA) within 90 seconds are the same corner.
 * Shots are SHOT / SHOTS / Shot only. GSO and shootout shots are reported
 * separately and are not added in.
 *
 * node .cursor/skills/tournament-report/count-tournament.mjs --team PRIDE --map NSW:PRIDE,QLD:BLAZE file.xml ...
 */

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const team = readFlag('--team');
const map = readMap('--map');
const files = args.filter(arg => !arg.startsWith('--') && arg !== team && arg !== map.raw);

if (!team || files.length === 0) {
    console.error('Usage: node count-tournament.mjs --team NAME [--map FROM:TO,...] <raw.xml> ...');
    process.exit(1);
}

const focus = team.toUpperCase();
const games = files.map(file => countFile(file, focus, map.pairs));
const totals = games.reduce((sum, game) => addSides(sum, game), emptySides());

process.stdout.write(`${JSON.stringify({ focus, games, totals }, null, 2)}\n`);

function countFile(file, focusTeam, pairs) {
    const rows = instances(decode(readFileSync(file))).map(row => annotate(row, pairs));
    const names = [...new Set(rows.map(row => row.team).filter(Boolean))];
    const ranked = names
        .filter(name => name !== focusTeam)
        .map(name => ({ name, weight: rows.filter(row => row.team === name && isStat(row)).length }))
        .sort((left, right) => right.weight - left.weight);
    const opponent = ranked[0] && ranked[0].weight > 0 ? ranked[0].name : null;
    const sides = {};
    for (const name of [focusTeam, opponent].filter(Boolean)) {
        sides[name] = countSide(rows.filter(row => row.team === name));
    }
    return {
        file,
        opponent,
        focus: sides[focusTeam] || empty(),
        opponentSide: opponent ? sides[opponent] : empty()
    };
}

function annotate(row, pairs) {
    let code = row.code.trim().replace(/\s+/g, ' ');
    for (const [from, to] of pairs) {
        code = code.replace(new RegExp(`\\b${from}\\b`, 'gi'), to);
    }
    const token = code.split(' ')[0] || '';
    const team = /^[A-Z][A-Z0-9]{1,11}$/.test(token) ? token : null;
    const action = team ? code.slice(token.length).trim() : code;
    return { ...row, team, action };
}

function countSide(rows) {
    const corners = rows.filter(row => cornerRole(row.action));
    const shots = rows.filter(row => /^(SHOT|SHOTS|Shot)$/i.test(row.action));
    return {
        fieldGoals: rows.filter(row => isFieldGoal(row)).length,
        shootoutGoals: rows.filter(row => isShootoutGoal(row)).length,
        shots: shots.length,
        gso: rows.filter(row => /^GSO$/i.test(row.action)).length,
        shootoutShots: rows.filter(row => /^Shootout-Shot$/i.test(row.action)).length,
        circleEntries: rows.filter(row => /^(CE|CIRCLE ENTRY|AC Entry)$/i.test(row.action)).length,
        entries25: rows.filter(row => /^(A25E|A25 ENTRY|25yd Entry)$/i.test(row.action)).length,
        penaltyCorners: countCorners(corners)
    };
}

function isFieldGoal(row) {
    return /^(GOAL|Goal)$/i.test(row.action) && !isShootoutGoal(row);
}

function isShootoutGoal(row) {
    if (/^Shootout-Goal$/i.test(row.action)) return true;
    const saysGoal = row.labels.some(label => /shootout/i.test(label) && /goal/i.test(label));
    if (/^(GOAL|Goal)$/i.test(row.action) && saysGoal) return true;
    return /^SHOOTOUT$/i.test(row.action) && row.labels.some(label => /goal/i.test(label));
}

function isStat(row) {
    return cornerRole(row.action)
        || isFieldGoal(row)
        || isShootoutGoal(row)
        || /^(SHOT|SHOTS|Shot|GSO|CE|CIRCLE ENTRY|AC Entry|A25E|A25 ENTRY|25yd Entry|Shootout-Shot)$/i.test(row.action);
}

function cornerRole(action) {
    if (/^(ASC|PC WON|PC Won)$/i.test(action)) return 'award';
    if (/^(PC|PCA)$/i.test(action)) return 'taken';
    return null;
}

function countCorners(rows) {
    const awards = rows.filter(row => cornerRole(row.action) === 'award').sort(byStart);
    const taken = rows.filter(row => cornerRole(row.action) === 'taken').sort(byStart);
    const used = new Set();
    let pairs = 0;
    for (const award of awards) {
        let best = null;
        let bestGap = 91;
        for (const corner of taken) {
            if (used.has(corner)) continue;
            const gap = corner.start - award.start;
            if (gap >= -5 && gap <= 90 && Math.abs(gap) < bestGap) {
                best = corner;
                bestGap = Math.abs(gap);
            }
        }
        if (best) {
            used.add(award);
            used.add(best);
            pairs += 1;
        }
    }
    const left = rows.filter(row => !used.has(row)).length;
    return pairs + left;
}

function instances(xml) {
    return [...xml.matchAll(/<instance\b[^>]*>([\s\S]*?)<\/instance>/gi)].map(match => {
        const block = match[1];
        const labels = [...block.matchAll(/<text>([^<]*)<\/text>/gi)].map(item => item[1].trim());
        return {
            code: ((block.match(/<code>([^<]*)<\/code>/i) || [])[1] || '').trim(),
            start: Number((block.match(/<start>([^<]*)<\/start>/i) || [])[1]),
            labels
        };
    }).filter(row => row.code && Number.isFinite(row.start));
}

function decode(buffer) {
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
        return buffer.toString('utf16le').replace(/^\uFEFF/, '');
    }
    if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
        const swapped = Buffer.alloc(buffer.length - (buffer.length % 2));
        for (let i = 0; i + 1 < buffer.length; i += 2) {
            swapped[i] = buffer[i + 1];
            swapped[i + 1] = buffer[i];
        }
        return swapped.toString('utf16le').replace(/^\uFEFF/, '');
    }
    return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function empty() {
    return { fieldGoals: 0, shootoutGoals: 0, shots: 0, gso: 0, shootoutShots: 0, circleEntries: 0, entries25: 0, penaltyCorners: 0 };
}

function emptySides() {
    return { focus: empty(), opponents: empty() };
}

function addSides(sum, game) {
    return {
        focus: add(sum.focus, game.focus),
        opponents: add(sum.opponents, game.opponentSide)
    };
}

function add(left, right) {
    const next = {};
    for (const key of Object.keys(left)) next[key] = left[key] + right[key];
    return next;
}

function byStart(left, right) {
    return left.start - right.start;
}

function readFlag(name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : '';
}

function readMap(name) {
    const raw = readFlag(name);
    const pairs = [];
    if (!raw) return { raw, pairs };
    for (const pair of raw.split(',')) {
        const [from, to] = pair.split(':');
        if (from && to) pairs.push([from.trim(), to.trim().toUpperCase()]);
    }
    return { raw, pairs };
}
