/**
 * Wires the sequence spike page. Capture and review do not load this module.
 */

import { analyseGameText, gameLabel, readSavedGames } from './games.js';
import { renderReport } from './render.js';

/**
 * @param {Document} doc
 * @param {{ storage?: Storage, fetchSample?: () => Promise<string> }} [options]
 */
export function mountSequenceSpike(doc, options = {}) {
    const storage = options.storage || window.localStorage;
    const savedRoot = doc.getElementById('saved-games');
    const status = doc.getElementById('status');
    const report = doc.getElementById('report');
    const fileInput = doc.getElementById('file-input');
    const matchDetails = doc.getElementById('match-selector-details');
    const matchTitle = doc.getElementById('match-selector-title');

    const fetchSample = options.fetchSample || (() => fetch('fixture.json').then(response => {
        if (!response.ok) throw new Error('Sample match is unavailable.');
        return response.text();
    }));

    function showStatus(message) {
        if (status) status.textContent = message;
    }

    function showAnalysis(analysed, label) {
        showStatus(label);
        if (matchTitle) matchTitle.textContent = `Match: ${label}`;
        if (matchDetails) matchDetails.open = false; // Collapse to let video & analysis take focus
        renderReport(report, analysed.game, analysed.result, { mutated: analysed.mutated, storage });
    }

    function showFailure(message) {
        showStatus(message);
        report.replaceChildren();
    }

    function showText(text, label) {
        try {
            showAnalysis(analyseGameText(text), label);
        } catch {
            showFailure('This file is not a coded match.');
        }
    }

    paintSavedGames(doc, savedRoot, readSavedGames(storage), showText);
    wireFileInput(doc, fileInput, showText, showFailure);
    wireSample(doc, fetchSample, showText, showStatus, showFailure);
}

const root = typeof document !== 'undefined' ? document.getElementById('sequence-spike') : null;
if (root) mountSequenceSpike(document);

function paintSavedGames(doc, savedRoot, games, showText) {
    if (!savedRoot) return;
    savedRoot.replaceChildren();
    if (!games.length) {
        const empty = doc.createElement('p');
        empty.className = 'help-text';
        empty.textContent = 'No matches are saved in this browser yet.';
        savedRoot.append(empty);
        return;
    }
    for (const game of games) {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-secondary text-left flex justify-between items-center';
        const count = game.events.length;
        button.innerHTML = `<span>${gameLabel(game)}</span><span class="text-xs text-muted tabular-nums">${count} ${count === 1 ? 'event' : 'events'}</span>`;
        button.addEventListener('click', () => showText(JSON.stringify(game), gameLabel(game)));
        savedRoot.append(button);
    }
}

function wireFileInput(doc, fileInput, showText, showFailure) {
    const uploadBtn = doc.getElementById('upload-button');
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => readChosenFile(fileInput, showText, showFailure));
    }
}

function readChosenFile(fileInput, showText, showFailure) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => showText(String(reader.result || ''), file.name);
    reader.onerror = () => showFailure('That file could not be read.');
    reader.readAsText(file);
}

function wireSample(doc, fetchSample, showText, showStatus, showFailure) {
    const sampleBtn = doc.getElementById('sample-button');
    if (sampleBtn) {
        sampleBtn.addEventListener('click', () => {
            showStatus('Opening the sample…');
            fetchSample().then(text => showText(text, 'Sample match')).catch(() => {
                showFailure('The sample match could not be opened.');
            });
        });
    }
}
