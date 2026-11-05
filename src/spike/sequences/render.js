/**
 * Renders sequence spike results with the site's existing classes.
 */

import { formatClock, sequenceCloseNote, sequenceCodes, sequenceTitle } from './copy.js';

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
    container.append(summarySection(game, stats, meta));
    appendTeamBlocks(container, sequences);
    appendIgnored(container, dispositions);
}

function summarySection(game, stats, meta) {
    const summary = section();
    summary.append(
        heading('Chains'),
        paragraph(summarySentence(stats)),
        paragraph(unchangedSentence(meta.mutated)),
        paragraph(timeSourceSentence(game.timeSource))
    );
    const counts = outcomeList(stats.circleEntriesByOutcome);
    if (counts.childElementCount) summary.append(counts);
    return summary;
}

function summarySentence(stats) {
    const circles = countLabel(stats.circleEntriesCoded, 'circle entry', 'circle entries');
    const sequences = countLabel(stats.sequenceCount, 'sequence', 'sequences');
    const events = countLabel(stats.eventCount, 'event', 'events');
    return `${circles} coded, ${stats.circleEntriesInSequences} placed in a chain. ${sequences} from ${events}.`;
}

function unchangedSentence(mutated) {
    return mutated
        ? 'The coded events changed while this report was built.'
        : 'The coded events were left unchanged.';
}

function timeSourceSentence(timeSource) {
    return timeSource === 'xml-clip-midpoint'
        ? 'Times come from the middle of each exported clip.'
        : 'Times come from the coded match.';
}

function outcomeList(byOutcome) {
    const counts = document.createElement('ul');
    counts.className = 'mt-4 flex flex-col gap-1';
    OUTCOME_ORDER.forEach(outcome => appendOutcomeCount(counts, outcome, byOutcome[outcome] || 0));
    return counts;
}

function appendOutcomeCount(list, outcome, count) {
    if (!count) return;
    const item = document.createElement('li');
    item.className = 'help-text';
    item.textContent = `${outcome}: ${countLabel(count, 'circle entry', 'circle entries')}`;
    list.append(item);
}

function appendTeamBlocks(container, sequences) {
    const teams = [...new Set(sequences.map(sequence => sequence.team))];
    teams.forEach(team => container.append(teamBlock(team, sequences)));
}

function teamBlock(team, sequences) {
    const block = document.createElement('section');
    block.className = 'mb-4';
    block.append(heading(team, 'h2'));
    const teamSequences = sequences.filter(sequence => sequence.team === team);
    OUTCOME_ORDER.forEach(outcome => appendOutcomeGroup(block, outcome, teamSequences));
    return block;
}

function appendOutcomeGroup(block, outcome, teamSequences) {
    const group = teamSequences.filter(sequence => sequence.outcome === outcome);
    if (!group.length) return;
    block.append(subheading(`${outcome} (${group.length})`));
    group.forEach(sequence => block.append(sequenceCard(sequence)));
}

function appendIgnored(container, dispositions) {
    const ignored = dispositions.filter(entry => entry.disposition === 'ignored');
    if (!ignored.length) return;
    const aside = section();
    aside.append(heading('Left out'), ignoredList(ignored));
    container.append(aside);
}

function ignoredList(ignored) {
    const list = document.createElement('ul');
    list.className = 'flex flex-col gap-1';
    ignored.forEach(entry => {
        const item = document.createElement('li');
        item.className = 'help-text';
        item.textContent = `${formatClock(entry.timeMs)} ${entry.code} — ${reasonLabel(entry.reason)}`;
        list.append(item);
    });
    return list;
}

function sequenceCard(sequence) {
    const card = document.createElement('article');
    card.className = 'surface surface-padded mb-3';
    const seek = `Seek ${formatClock(sequence.seekSeconds * 1000)}. ${sequenceCloseNote(sequence)}`.trim();
    card.append(heading(sequenceTitle(sequence), 'h3'), textLine(sequenceCodes(sequence)), paragraph(seek));
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

function reasonLabel(reason) {
    if (reason === 'quarter-marker') return 'quarter marker';
    if (reason === 'card-or-sub') return 'card or substitution';
    return 'not part of a chain';
}

function countLabel(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
}
