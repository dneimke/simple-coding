/**
 * Coach-readable rendering of a sequence spike. The JSON file is the audit copy.
 */

import { formatClock, sequenceCloseNote, sequenceCodes, sequenceTitle } from './copy.js';

const OUTCOME_ORDER = ['Goal', 'PC', 'Shot', 'Turnover', 'No shot', 'No circle', 'No entry'];

/**
 * @param {{ name: string, timeSource: string }} game
 * @param {{ sequences: Array<object>, dispositions: Array<object>, stats: object }} result
 * @param {{ mutated?: boolean }} [meta]
 */
export function formatReport(game, result, meta = {}) {
    const { sequences, dispositions, stats } = result;
    const lines = headerLines(game, stats, meta);
    appendOutcomeRows(lines, stats.circleEntriesByOutcome);
    appendTeamLines(lines, sequences);
    appendIgnoredLines(lines, dispositions);
    lines.push('');
    return lines.join('\n');
}

function headerLines(game, stats, meta) {
    return [
        `# Sequences — ${game.name}`,
        '',
        'Standalone spike. Chains are derived for review and are not written back onto the game.',
        '',
        '| Rule | Value |',
        '| --- | --- |',
        `| Gap that ends a chain | ${stats.rules.gapMs / 1000}s |`,
        `| Counter window after Ball Won | ${stats.rules.counterMs / 1000}s |`,
        `| Event time | ${timeSourceLabel(game.timeSource)} |`,
        `| Source events modified | ${meta.mutated ? 'yes' : 'no'} |`,
        `| Built in | ${stats.elapsedMs}ms |`,
        '',
        `${stats.circleEntriesCoded} circle entries coded, ${stats.circleEntriesInSequences} placed in a chain. ${stats.sequenceCount} sequences from ${stats.eventCount} events.`,
        '',
        '## Circle entries by outcome',
        '',
        '| Outcome | Circle entries |',
        '| --- | ---: |'
    ];
}

function appendOutcomeRows(lines, byOutcome) {
    OUTCOME_ORDER.forEach(outcome => {
        const count = byOutcome[outcome] || 0;
        if (count) lines.push(`| ${outcome} | ${count} |`);
    });
}

function appendTeamLines(lines, sequences) {
    const teams = [...new Set(sequences.map(sequence => sequence.team))];
    teams.forEach(team => {
        lines.push('', `## ${team}`);
        const teamSequences = sequences.filter(sequence => sequence.team === team);
        OUTCOME_ORDER.forEach(outcome => appendOutcomeLines(lines, outcome, teamSequences));
    });
}

function appendOutcomeLines(lines, outcome, teamSequences) {
    const group = teamSequences.filter(sequence => sequence.outcome === outcome);
    if (!group.length) return;
    lines.push('', `### ${outcome} (${group.length})`);
    group.forEach(sequence => lines.push('', formatSequence(sequence)));
}

function appendIgnoredLines(lines, dispositions) {
    const ignored = dispositions.filter(entry => entry.disposition === 'ignored');
    if (!ignored.length) return;
    lines.push('', '## Ignored events', '', '| Time | Code | Reason |', '| --- | --- | --- |');
    ignored.forEach(entry => {
        lines.push(`| ${formatClock(entry.timeMs)} | ${entry.code} | ${entry.reason} |`);
    });
}

function formatSequence(sequence) {
    const close = sequenceCloseNote(sequence);
    const detail = `Seek ${formatClock(sequence.seekSeconds * 1000)}. Events ${sequence.eventInstanceIds.join(', ')}.`;
    return [
        `**${sequenceTitle(sequence)}**`,
        '',
        sequenceCodes(sequence),
        '',
        close ? `${detail} ${close}` : detail
    ].join('\n');
}

function timeSourceLabel(timeSource) {
    if (timeSource === 'xml-clip-midpoint') return 'clip midpoint from Sportscode XML';
    return 'timeMs on the coded event';
}
