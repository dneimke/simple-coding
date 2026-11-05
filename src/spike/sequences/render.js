/**
 * Renders sequence spike results with the site's existing classes.
 */

const OUTCOME_ORDER = ['Goal', 'PC', 'Shot', 'Turnover', 'No shot', 'No circle', 'No entry'];

/**
 * @param {HTMLElement} container
 * @param {{ name: string, timeSource: string }} game
 * @param {{ sequences: Array<object>, dispositions: Array<object>, stats: object }} result
 * @param {{ mutated?: boolean }} [meta]
 */
export function renderReport(container, game, result, meta = {}) {
    const { sequences, dispositions, stats } = result;
    container.replaceChildren();

    const summary = section();
    summary.append(
        heading('Chains'),
        paragraph(`${countLabel(stats.circleEntriesCoded, 'circle entry', 'circle entries')} coded, ${stats.circleEntriesInSequences} placed in a chain. ${countLabel(stats.sequenceCount, 'sequence', 'sequences')} from ${countLabel(stats.eventCount, 'event', 'events')}.`),
        paragraph(meta.mutated
            ? 'The coded events changed while this report was built.'
            : 'The coded events were left unchanged.'),
        paragraph(game.timeSource === 'xml-clip-midpoint'
            ? 'Times come from the middle of each exported clip.'
            : 'Times come from the coded match.')
    );

    const counts = document.createElement('ul');
    counts.className = 'mt-4 flex flex-col gap-1';
    for (const outcome of OUTCOME_ORDER) {
        const count = stats.circleEntriesByOutcome[outcome] || 0;
        if (!count) continue;
        const item = document.createElement('li');
        item.className = 'help-text';
        item.textContent = `${outcome}: ${count} circle ${count === 1 ? 'entry' : 'entries'}`;
        counts.append(item);
    }
    if (counts.childElementCount) summary.append(counts);
    container.append(summary);

    const teams = [...new Set(sequences.map(sequence => sequence.team))];
    for (const team of teams) {
        const teamSequences = sequences.filter(sequence => sequence.team === team);
        const block = document.createElement('section');
        block.className = 'mb-4';
        block.append(heading(team, 'h2'));
        for (const outcome of OUTCOME_ORDER) {
            const group = teamSequences.filter(sequence => sequence.outcome === outcome);
            if (!group.length) continue;
            block.append(subheading(`${outcome} (${group.length})`));
            for (const sequence of group) block.append(sequenceCard(sequence));
        }
        container.append(block);
    }

    const ignored = dispositions.filter(entry => entry.disposition === 'ignored');
    if (ignored.length) {
        const aside = section();
        aside.append(heading('Left out'));
        const list = document.createElement('ul');
        list.className = 'flex flex-col gap-1';
        for (const entry of ignored) {
            const item = document.createElement('li');
            item.className = 'help-text';
            item.textContent = `${formatClock(entry.timeMs)} ${entry.code} — ${reasonLabel(entry.reason)}`;
            list.append(item);
        }
        aside.append(list);
        container.append(aside);
    }
}

function sequenceCard(sequence) {
    const card = document.createElement('article');
    card.className = 'surface surface-padded mb-3';
    const where = [
        `${sequence.videoStart}–${sequence.videoEnd}`,
        sequence.quarter ? `${sequence.quarter} ${sequence.matchClockStart}` : `match ${sequence.matchClockStart}`,
        sequence.originType || 'origin not coded',
        sequence.primaryChannel || 'channel not coded'
    ].join(' · ');
    const codes = sequence.events.map(event => `${formatClock(event.timeMs)} ${event.code}`).join(' → ');
    card.append(
        heading(where, 'h3'),
        textLine(codes),
        paragraph(`Seek ${formatClock(sequence.seekSeconds * 1000)}. ${closeNote(sequence)}`.trim())
    );
    return card;
}

function section() {
    const node = document.createElement('section');
    node.className = 'surface surface-padded mb-4';
    return node;
}

function heading(text, tag = 'h2') {
    const node = document.createElement(tag);
    node.className = 'section-title';
    node.textContent = text;
    return node;
}

function subheading(text) {
    const node = document.createElement('h3');
    node.className = 'help-text mb-2';
    node.textContent = text;
    return node;
}

function paragraph(text) {
    const node = document.createElement('p');
    node.className = 'help-text mt-2';
    node.textContent = text;
    return node;
}

function textLine(text) {
    const node = document.createElement('p');
    node.className = 'mt-2 font-medium';
    node.textContent = text;
    return node;
}

function closeNote(sequence) {
    if (sequence.closedBecause === 'opponent-bw') return 'Closed when the other team won the ball.';
    if (sequence.closedBecause === 'goal') return 'Ends at the goal.';
    if (sequence.closedBecause === 'gap') return `No same-team tag for ${sequence.gapSeconds}s.`;
    return '';
}

function reasonLabel(reason) {
    if (reason === 'quarter-marker') return 'quarter marker';
    if (reason === 'card-or-sub') return 'card or substitution';
    return 'not part of a chain';
}

function countLabel(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
}

function formatClock(ms) {
    const total = Math.max(0, Math.round(Number(ms) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
