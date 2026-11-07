/**
 * Integrity checks for the sequence spike. Exits non-zero when an entry origin rule breaks.
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

const byEvent = (id) => result.entries.find(entry => entry.eventId === id);

assert.deepEqual(result.stats.circleEntries, {
    total: 8,
    counter: 2,
    buildUp: 6
});
assert.deepEqual(result.stats.a25Entries, {
    total: 1,
    counter: 0,
    buildUp: 1
});

// a2 (A25E) is consolidated into a3 (CE) because the attack penetrated into the circle
assert.equal(byEvent('a2'), undefined);

const counterCe = byEvent('a3');
assert.equal(counterCe.entryType, 'CE');
assert.equal(counterCe.originType, 'Counter');
assert.equal(counterCe.triggerCode, 'BW1');
assert.equal(counterCe.secondsFromTrigger, 8);
assert.equal(counterCe.quarter, 'Q1');
assert.deepEqual(counterCe.eventInstanceIds, ['a1', 'a2', 'a3']);
assert.equal(counterCe.seekSeconds, 50);

assert.equal(byEvent('card'), undefined);
assert.equal(byEvent('e3'), undefined);

const entryOnly = byEvent('b1');
const lateCircle = byEvent('b2');
assert.equal(entryOnly.originType, 'Build-Up');
assert.equal(entryOnly.triggerCode, null);
assert.equal(lateCircle.originType, 'Build-Up');
assert.equal(lateCircle.triggerCode, null);
assert.deepEqual(lateCircle.eventInstanceIds, ['b2']);

const fromRestart = byEvent('c2');
assert.equal(fromRestart.originType, 'Build-Up');
assert.equal(fromRestart.triggerCode, 'BS3');
assert.equal(fromRestart.secondsFromTrigger, 8);
assert.deepEqual(fromRestart.eventInstanceIds, ['c1', 'c2']);

const slowBallWon = byEvent('d2');
assert.equal(slowBallWon.originType, 'Build-Up');
assert.equal(slowBallWon.triggerCode, 'BW2');
assert.equal(slowBallWon.secondsFromTrigger, 12);
assert.deepEqual(slowBallWon.eventInstanceIds, ['d1', 'd2']);

const fromA25 = byEvent('e2');
assert.equal(fromA25.originType, 'Build-Up');
assert.equal(fromA25.triggerCode, 'A25E');
assert.deepEqual(fromA25.eventInstanceIds, ['e1', 'e2']);

const fromOverhead = byEvent('f3');
assert.equal(fromOverhead.originType, 'Build-Up');
assert.equal(fromOverhead.triggerCode, 'OH');
assert.deepEqual(fromOverhead.eventInstanceIds, ['f1', 'f2', 'f3']);

const secondQuarter = byEvent('h2');
assert.equal(secondQuarter.quarter, 'Q2');
assert.equal(secondQuarter.originType, 'Counter');
assert.equal(secondQuarter.triggerCode, 'BW1');
assert.equal(secondQuarter.matchClock, '01:04');
assert.equal(secondQuarter.videoTime, '16:04');

const repeat = buildSequences(game.events, { teams: game.teams });
assert.deepEqual(repeat.entries, result.entries);

const many = Array.from({ length: 500 }, (_, index) => ({
    id: `e${index}`,
    event: index % 2 === 0 ? 'FIRE BW1' : 'FIRE CE',
    timeMs: index * 20000
}));
const timed = buildSequences(many);
assert.ok(timed.stats.elapsedMs < 50, `500 events took ${timed.stats.elapsedMs}ms`);
assert.equal(timed.stats.circleEntries.total, 250);

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
    </instance>
  </ALL_INSTANCES>
</file>`;
const exported = loadGameText(xml);
assert.equal(exported.timeSource, 'xml-clip-midpoint');
assert.equal(exported.events[0].timeMs, 60000);
assert.equal(exported.events[1].timeMs, 64000);
const fromXml = buildSequences(exported.events);
assert.equal(fromXml.entries.length, 1);
assert.equal(fromXml.entries[0].originType, 'Counter');
assert.equal(fromXml.entries[0].triggerCode, 'BW1');
assert.deepEqual(fromXml.entries[0].eventInstanceIds, ['1', '2']);

console.log(`ok — fixture ${result.stats.entryCount} entries, 500 events in ${timed.stats.elapsedMs}ms`);
