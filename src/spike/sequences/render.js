/**
 * Renders attacking entry (A25E and CE) Counter vs Build-Up results with the site's existing classes.
 */

import { entryCodes, entryDetail, entryTitle, splitSummaryText } from './copy.js';

const ENTRY_GROUPS = [
    ['CE', 'Circle entries (CE)'],
    ['A25E', '25m entries (A25E)']
];

/**
 * @param {HTMLElement} container
 * @param {{ name: string, timeSource: string }} game
 * @param {{ entries: Array<object>, stats: object }} result
 * @param {{ mutated?: boolean }} [meta]
 */
export function renderReport(container, game, result, meta = {}) {
    const entries = result.entries || result.sequences || [];
    const { stats } = result;
    container.replaceChildren();
    container.append(summarySection(game, stats, meta));
    appendTeamBlocks(container, entries);
}

function summarySection(game, stats, meta) {
    const summary = section();
    summary.append(
        heading('Attacking entries'),
        paragraph(splitSummaryText('Circle entries (CE)', stats.circleEntries)),
        paragraph(splitSummaryText('25m entries (A25E)', stats.a25Entries)),
        paragraph(unchangedSentence(meta.mutated)),
        paragraph(timeSourceSentence(game.timeSource))
    );
    return summary;
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

function appendTeamBlocks(container, entries) {
    const teams = [...new Set(entries.map(entry => entry.team))];
    teams.forEach(team => container.append(teamBlock(team, entries)));
}

function teamBlock(team, entries) {
    const block = document.createElement('section');
    block.className = 'mb-4';
    const teamEntries = entries.filter(entry => entry.team === team);
    block.append(heading(team, 'h2'), paragraph(teamSummary(teamEntries)));
    ENTRY_GROUPS.forEach(([entryType, label]) => appendEntryGroup(block, entryType, label, teamEntries));
    return block;
}

function teamSummary(teamEntries) {
    const ce = teamGroupSummary(teamEntries, 'CE', 'circle entry', 'circle entries');
    const a25 = teamGroupSummary(teamEntries, 'A25E', '25m entry', '25m entries');
    return `${ce} · ${a25}`;
}

function teamGroupSummary(teamEntries, entryType, singular, plural) {
    const group = teamEntries.filter(entry => entry.entryType === entryType);
    const counter = group.filter(entry => entry.originType === 'Counter').length;
    const buildUp = group.length - counter;
    return `${countLabel(group.length, singular, plural)} (${counter} Counter, ${buildUp} Build-Up)`;
}

function appendEntryGroup(block, entryType, label, teamEntries) {
    const group = teamEntries.filter(entry => entry.entryType === entryType);
    if (!group.length) return;
    block.append(subheading(`${label} — ${group.length}`));
    group.forEach(entry => block.append(entryCard(entry)));
}

function entryCard(entry) {
    const card = document.createElement('article');
    card.className = 'surface surface-padded mb-3';
    card.append(
        heading(entryTitle(entry), 'h3'),
        textLine(entryCodes(entry)),
        paragraph(entryDetail(entry))
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
    node.className = 'help-text mt-3 mb-2';
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

function countLabel(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
}
