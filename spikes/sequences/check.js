/**
 * Integrity checks for the sequence spike. Exits non-zero when a chain rule breaks.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSequences } from '../../src/spike/sequences/engine.js';
import { loadGameText } from '../../src/spike/sequences/load-game.js';

const fixturePath = new URL('../../src/spike/sequences/fixture.json', import.meta.url);
const fixtureText = readFileSync(fixturePath, 'utf8');
const fixture = JSON.parse(fixtureText);
const before = JSON.stringify(fixture);
const game = loadGameText(fixtureText);
const snapshot = JSON.stringify(game.events);
const result = buildSequences(game.events, { teams: game.teams });

assert.equal(JSON.stringify(fixture), before, 'fixture file object was modified');
assert.equal(JSON.stringify(game.events), snapshot, 'coded events were modified');

const byEvent = (id) => result.sequences.find(sequence => sequence.eventInstanceIds.includes(id));

const converted = byEvent('a1');
assert.equal(converted.originType, 'Counter');
assert.equal(converted.outcome, 'Shot');
assert.equal(converted.primaryChannel, 'Right');
assert.equal(converted.quarter, 'Q1');
assert.deepEqual(converted.eventInstanceIds, ['a1', 'a2', 'a3', 'a4']);
assert.equal(converted.seekSeconds, 55);

const entryOnly = byEvent('b1');
const lateCircle = byEvent('b2');
assert.notEqual(entryOnly.id, lateCircle.id);
assert.equal(entryOnly.outcome, 'No circle');
assert.equal(entryOnly.closedBecause, 'gap');
assert.equal(entryOnly.gapSeconds, 16);
assert.equal(lateCircle.outcome, 'No shot');
assert.equal(lateCircle.primaryChannel, null);

const card = result.dispositions.find(entry => entry.id === 'card');
assert.equal(card.disposition, 'ignored');
assert.equal(card.reason, 'card-or-sub');
assert.ok(result.sequences.every(sequence => !sequence.eventInstanceIds.includes('card')));

const restart = byEvent('c1');
assert.equal(restart.originType, 'Restart');
assert.equal(restart.outcome, 'No shot');
assert.deepEqual(restart.eventInstanceIds, ['c1', 'c2']);

const slowCounter = byEvent('d1');
assert.equal(slowCounter.originType, 'Build-Up');
assert.deepEqual(slowCounter.eventInstanceIds, ['d1', 'd2']);

const turnover = byEvent('e2');
assert.equal(turnover.outcome, 'Turnover');
assert.equal(turnover.primaryChannel, 'Left');
assert.equal(turnover.closedBecause, 'opponent-bw');
assert.ok(!turnover.eventInstanceIds.includes('e3'));

const loneWin = byEvent('e3');
assert.equal(loneWin.outcome, 'No entry');
assert.equal(loneWin.originType, null);

const goal = byEvent('f4');
assert.equal(goal.outcome, 'Goal');
assert.equal(goal.originType, 'Restart');
assert.equal(goal.closedBecause, 'goal');

const corner = byEvent('g3');
assert.equal(corner.outcome, 'PC');
assert.equal(corner.originType, 'Build-Up');

const secondQuarter = byEvent('h1');
assert.equal(secondQuarter.quarter, 'Q2');
assert.equal(secondQuarter.originType, 'Counter');
assert.equal(secondQuarter.outcome, 'Shot');
assert.equal(secondQuarter.matchClockStart, '01:00');
assert.equal(secondQuarter.videoStart, '16:00');

const circleEntries = result.dispositions.filter(entry => entry.attack === 'CE');
assert.equal(circleEntries.length, 8);
assert.ok(circleEntries.every(entry => entry.disposition === 'in-sequence'));
assert.deepEqual(result.stats.circleEntriesByOutcome, {
    Goal: 1,
    PC: 1,
    Shot: 2,
    Turnover: 1,
    'No shot': 3,
    'No circle': 0,
    'No entry': 0
});

const repeat = buildSequences(game.events, { teams: game.teams });
assert.deepEqual(repeat.sequences, result.sequences);

const many = Array.from({ length: 500 }, (_, index) => ({
    id: `e${index}`,
    event: index % 2 === 0 ? 'FIRE BW1' : 'FIRE CE',
    timeMs: index * 20000
}));
const timed = buildSequences(many);
assert.ok(timed.stats.elapsedMs < 50, `500 events took ${timed.stats.elapsedMs}ms`);
assert.equal(timed.stats.circleEntriesCoded, 250);
assert.equal(timed.stats.circleEntriesInSequences, 250);

const xml = `<?xml version="1.0" encoding="utf-8"?>
<file>
  <ALL_INSTANCES>
    <instance>
      <ID>1</ID>
      <start>55.00</start>
      <end>65.00</end>
      <code>FIRE BW1</code>
    </instance>
    <instance>
      <ID>2</ID>
      <start>59.00</start>
      <end>69.00</end>
      <code>FIRE CE</code>
      <label>
        <group>Channel</group>
        <text>Center</text>
      </label>
    </instance>
  </ALL_INSTANCES>
</file>`;
const exported = loadGameText(xml);
assert.equal(exported.timeSource, 'xml-clip-midpoint');
assert.equal(exported.events[0].timeMs, 60000);
assert.equal(exported.events[1].timeMs, 64000);
const fromXml = buildSequences(exported.events);
assert.equal(fromXml.sequences.length, 1);
assert.equal(fromXml.sequences[0].originType, 'Counter');
assert.equal(fromXml.sequences[0].primaryChannel, 'Center');
assert.deepEqual(fromXml.sequences[0].eventInstanceIds, ['1', '2']);

console.log(`ok — fixture ${result.stats.sequenceCount} sequences, 500 events in ${timed.stats.elapsedMs}ms`);
