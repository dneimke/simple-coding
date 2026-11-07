/**
 * Read a coded game and write sequences next to the product, not into it.
 *
 *   node spikes/sequences/run.js src/spike/sequences/fixture.json --out spikes/sequences/out
 *   node spikes/sequences/run.js path/to/saved-game.json
 *   node spikes/sequences/run.js path/to/sportscode.xml --id game-id
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSequences } from '../../src/spike/sequences/engine.js';
import { loadGameText } from '../../src/spike/sequences/load-game.js';
import { formatReport } from '../../src/spike/sequences/report.js';

const args = process.argv.slice(2);
const fileArg = args.find(arg => !arg.startsWith('--'));
const outDir = readFlag('--out');
const gameId = readFlag('--id');

if (!fileArg) {
    console.error('Usage: node spikes/sequences/run.js <game.json|sportscode.xml> [--out dir] [--id gameId]');
    process.exit(1);
}

const filePath = resolve(fileArg);
const raw = readFileSync(filePath, 'utf8');
const game = loadGameText(raw, { gameId });
const snapshot = JSON.stringify(game.events);
const result = buildSequences(game.events, { teams: game.teams });
const mutated = JSON.stringify(game.events) !== snapshot;
const markdown = formatReport(game, result, { mutated });
const payload = {
    game: game.name,
    gameId: game.id,
    timeSource: game.timeSource,
    mutated,
    ...result
};

console.log(markdown);

if (outDir) {
    const directory = resolve(outDir);
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, 'sequences.md'), markdown);
    writeFileSync(resolve(directory, 'sequences.json'), `${JSON.stringify(payload, null, 2)}\n`);
    console.error(`Wrote ${resolve(directory, 'sequences.md')}`);
    console.error(`Wrote ${resolve(directory, 'sequences.json')}`);
}

if (mutated) process.exit(1);

function readFlag(name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}
