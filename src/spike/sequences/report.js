/**
 * Coach-readable rendering of attacking entry origins (Counter vs Build-Up).
 * The JSON file is the audit copy.
 */

import { entryCodes, entryDetail, entryTitle, splitSummaryText } from './copy.js';

const ENTRY_GROUPS = [
    ['CE', 'Circle entries (CE)'],
    ['A25E', '25m entries (A25E)']
];

/**
 * @param {{ name: string, timeSource: string }} game
 * @param {{ entries: Array<object>, stats: object }} result
 * @param {{ mutated?: boolean }} [meta]
 */
export function formatReport(game, result, meta = {}) {
    const entries = result.entries || result.sequences || [];
    const { stats } = result;
    const lines = headerLines(game, stats, meta);
    appendTeamLines(lines, entries);
    lines.push('');
    return lines.join('\n');
}

function headerLines(game, stats, meta) {
    return [
        `# Attacking entries — ${game.name}`,
        '',
        'Standalone spike. Classifies 25m entries (A25E) and circle entries (CE) as Counter or Build-Up without modifying the coded match.',
        '',
        '| Rule | Value |',
        '| --- | --- |',
        `| Gap that ends a possession window | ${stats.rules.gapMs / 1000}s |`,
        `| Counter window after Ball Won | ${stats.rules.counterMs / 1000}s |`,
        `| Event time | ${timeSourceLabel(game.timeSource)} |`,
        `| Source events modified | ${meta.mutated ? 'yes' : 'no'} |`,
        `| Built in | ${stats.elapsedMs}ms |`,
        '',
        `- ${splitSummaryText('Circle entries (CE)', stats.circleEntries)}`,
        `- ${splitSummaryText('25m entries (A25E)', stats.a25Entries)}`,
        '',
        '| Entry type | Total | Counter | Build-Up |',
        '| --- | ---: | ---: | ---: |',
        `| Circle entries (CE) | ${stats.circleEntries.total} | ${stats.circleEntries.counter} | ${stats.circleEntries.buildUp} |`,
        `| 25m entries (A25E) | ${stats.a25Entries.total} | ${stats.a25Entries.counter} | ${stats.a25Entries.buildUp} |`
    ];
}

function appendTeamLines(lines, entries) {
    const teams = [...new Set(entries.map(entry => entry.team))];
    teams.forEach(team => {
        lines.push('', `## ${team}`);
        const teamEntries = entries.filter(entry => entry.team === team);
        ENTRY_GROUPS.forEach(([entryType, label]) => appendEntryGroupLines(lines, entryType, label, teamEntries));
    });
}

function appendEntryGroupLines(lines, entryType, label, teamEntries) {
    const group = teamEntries.filter(entry => entry.entryType === entryType);
    if (!group.length) return;
    const counter = group.filter(entry => entry.originType === 'Counter').length;
    const buildUp = group.length - counter;
    lines.push('', `### ${label} — ${group.length} (${counter} Counter, ${buildUp} Build-Up)`);
    group.forEach(entry => lines.push('', formatEntry(entry)));
}

function formatEntry(entry) {
    return [
        `**${entryTitle(entry)}**`,
        '',
        entryCodes(entry),
        '',
        `${entryDetail(entry)}. Events ${entry.eventInstanceIds.join(', ')}.`
    ].join('\n');
}

function timeSourceLabel(timeSource) {
    if (timeSource === 'xml-clip-midpoint') return 'clip midpoint from Sportscode XML';
    return 'timeMs on the coded event';
}
