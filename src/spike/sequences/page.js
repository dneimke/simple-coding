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
    const fetchSample = options.fetchSample || (() => fetch('fixture.json').then(response => {
        if (!response.ok) throw new Error('Sample match is unavailable.');
        return response.text();
    }));

    function showStatus(message) {
        status.textContent = message;
    }

    function showAnalysis(analysed, label) {
        showStatus(label);
        renderReport(report, analysed.game, analysed.result, { mutated: analysed.mutated });
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

    savedRoot.replaceChildren();
    const games = readSavedGames(storage);
    if (!games.length) {
        const empty = doc.createElement('p');
        empty.className = 'help-text';
        empty.textContent = 'No matches are saved in this browser yet.';
        savedRoot.append(empty);
    } else {
        for (const game of games) {
            const button = doc.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-secondary';
            const count = game.events.length;
            button.textContent = `${gameLabel(game)} · ${count} ${count === 1 ? 'event' : 'events'}`;
            button.addEventListener('click', () => showText(JSON.stringify(game), gameLabel(game)));
            savedRoot.append(button);
        }
    }

    doc.getElementById('upload-button').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => showText(String(reader.result || ''), file.name);
        reader.onerror = () => showFailure('That file could not be read.');
        reader.readAsText(file);
    });

    doc.getElementById('sample-button').addEventListener('click', () => {
        showStatus('Opening the sample…');
        fetchSample().then(text => showText(text, 'Sample match')).catch(() => {
            showFailure('The sample match could not be opened.');
        });
    });
}

const root = typeof document !== 'undefined' ? document.getElementById('sequence-spike') : null;
if (root) mountSequenceSpike(document);
