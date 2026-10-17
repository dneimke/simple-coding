import { mirrorZone, zoneForTeam, resolveEventName } from '../../src/utils/zoneUtils.js';

const values = ['1', '2', '3', '4'];
const mirrored = { values, perspective: 'mirrored' };
const pitch = { values, perspective: 'pitch' };

describe('mirrorZone', () => {
    test('maps each zone to the opposite end of the pitch', () => {
        expect(values.map(zone => mirrorZone(zone, values))).toEqual(['4', '3', '2', '1']);
    });

    test('returns unknown zones unchanged', () => {
        expect(mirrorZone('9', values)).toBe('9');
    });
});

describe('zoneForTeam', () => {
    test('Team 1 always uses the active zone', () => {
        expect(zoneForTeam('2', 1, mirrored)).toBe('2');
    });

    test('Team 2 is mirrored by default and with a mirrored perspective', () => {
        expect(zoneForTeam('2', 2, mirrored)).toBe('3');
        expect(zoneForTeam('1', '2', { values })).toBe('4');
    });

    test('Team 2 shares the zone when zones are fixed to the pitch', () => {
        expect(zoneForTeam('2', 2, pitch)).toBe('2');
    });
});

describe('resolveEventName', () => {
    test('appends the team zone to zoned events', () => {
        expect(resolveEventName({ event: 'FIRE BS', zoned: true, slot: 1 }, { zone: '2', zones: mirrored })).toBe('FIRE BS2');
        expect(resolveEventName({ event: 'TIGERS BW', zoned: true, slot: 2 }, { zone: '2', zones: mirrored })).toBe('TIGERS BW3');
    });

    test('leaves events that are not zoned unchanged', () => {
        expect(resolveEventName({ event: 'FIRE GOAL', zoned: false, slot: 1 }, { zone: '2', zones: mirrored })).toBe('FIRE GOAL');
        expect(resolveEventName({ event: 'START' }, { zone: '2', zones: mirrored })).toBe('START');
    });

    test('ignores the zoned flag when the board has no zones', () => {
        expect(resolveEventName({ event: 'FIRE BS', zoned: true, slot: 1 }, { zone: null, zones: undefined })).toBe('FIRE BS');
    });
});
