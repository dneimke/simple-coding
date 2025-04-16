import { formatTime, escapeXml } from '../src/utils';

describe('formatTime', () => {
    test('formats time correctly for 0 milliseconds', () => {
        expect(formatTime(0)).toBe('00:00');
    });

    test('formats time correctly for 61000 milliseconds', () => {
        expect(formatTime(61000)).toBe('01:01');
    });

    test('formats time correctly for 3600000 milliseconds', () => {
        expect(formatTime(3600000)).toBe('60:00');
    });
});

describe('escapeXml', () => {
    test('escapes special characters in a string', () => {
        expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
        expect(escapeXml('"quote"')).toBe('&quot;quote&quot;');
        expect(escapeXml("'single'")).toBe('&apos;single&apos;');
        expect(escapeXml('&')).toBe('&amp;');
    });

    test('returns non-string input as is', () => {
        expect(escapeXml(123)).toBe(123);
        expect(escapeXml(null)).toBe(null);
    });
});
