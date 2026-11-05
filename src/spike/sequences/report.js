/**
 * Coach-readable rendering of a sequence spike. The JSON file is the audit copy.
 */

const OUTCOME_ORDER = ['Goal', 'PC', 'Shot', 'Turnover', 'No shot', 'No circle', 'No entry'];

/**
 * @param {{ name: string, timeSource: string }} game
 * @param {{ sequences: Array<object>, dispositions: Array<object>, stats: object }} result
 * @param {{ mutated?: boolean }} [meta]
 */
export function formatReport(game, result, meta = {}) {
    const { sequences, dispositions, stats } = result;
    const lines = [
        `# Sequences — ${game.name}`,
        '',
        'Standalone spike. Chains are derived for review and are not written back onto the game.',
        '',
        `| Rule | Value |`,
        `| --- | --- |`,
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

    for (const outcome of OUTCOME_ORDER) {
        const count = stats.circleEntriesByOutcome[outcome] || 0;
        if (count) lines.push(`| ${outcome} | ${count} |`);
    }

    const teams = [...new Set(sequences.map(sequence => sequence.team))];
    for (const team of teams) {
        const teamSequences = sequences.filter(sequence => sequence.team === team);
        lines.push('', `## ${team}`);
        for (const outcome of OUTCOME_ORDER) {
            const group = teamSequences.filter(sequence => sequence.outcome === outcome);
            if (group.length === 0) continue;
            lines.push('', `### ${outcome} (${group.length})`);
            for (const sequence of group) {
                lines.push('', formatSequence(sequence));
            }
        }
    }

    const ignored = dispositions.filter(entry => entry.disposition === 'ignored');
    if (ignored.length) {
        lines.push('', '## Ignored events', '', '| Time | Code | Reason |', '| --- | --- | --- |');
        for (const entry of ignored) {
            lines.push(`| ${formatClock(entry.timeMs)} | ${entry.code} | ${entry.reason} |`);
        }
    }

    lines.push('');
    return lines.join('\n');
}

function formatSequence(sequence) {
    const where = [
        `${sequence.videoStart}–${sequence.videoEnd} video`,
        sequence.quarter ? `${sequence.quarter} ${sequence.matchClockStart}` : `match ${sequence.matchClockStart}`,
        sequence.originType || 'origin not coded',
        sequence.primaryChannel || 'channel not coded'
    ].join(' · ');
    const codes = sequence.events.map(event => `${formatClock(event.timeMs)} ${event.code}`).join(' → ');
    const close = closeNote(sequence);
    return [
        `**${where}**`,
        '',
        codes,
        '',
        `Seek ${formatClock(sequence.seekSeconds * 1000)}. Events ${sequence.eventInstanceIds.join(', ')}.${close ? ` ${close}` : ''}`
    ].join('\n');
}

function closeNote(sequence) {
    if (sequence.closedBecause === 'opponent-bw') return 'Closed when the other team won the ball.';
    if (sequence.closedBecause === 'goal') return 'Ends at the goal.';
    if (sequence.closedBecause === 'gap') return `No same-team tag for ${sequence.gapSeconds}s.`;
    return '';
}

function timeSourceLabel(timeSource) {
    if (timeSource === 'xml-clip-midpoint') return 'clip midpoint from Sportscode XML';
    return 'timeMs on the coded event';
}

function formatClock(ms) {
    const total = Math.max(0, Math.round(Number(ms) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
