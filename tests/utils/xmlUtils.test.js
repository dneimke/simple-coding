/**
 * Tests for xmlUtils.js functionality
 */
import { parseXmlToEvents, validateXmlStructure, generateGameXml } from '../../src/utils/xmlUtils.js';

// Mock dependencies
jest.mock('../../src/utils/formatUtils.js', () => ({
    escapeXml: jest.fn(str => str),
    logger: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../src/services/notificationService.js', () => ({
    notificationService: {
        notify: jest.fn()
    }
}));

describe('XML Utils', () => {
    // Mock DOMParser for testing
    const originalDOMParser = global.DOMParser;

    beforeAll(() => {
        // Mock DOMParser implementation
        global.DOMParser = class {
            parseFromString(content) {
                if (content.includes('parsererror')) {
                    const mockDoc = {
                        querySelector: (selector) => selector === 'parsererror' ? {} : null
                    };
                    return mockDoc;
                }

                // Create a simple mock document based on the content
                if (content.includes('<event ')) {
                    // New format with <event> elements
                    const mockDoc = {
                        querySelector: (selector) => {
                            if (selector === 'game') {
                                return {
                                    hasAttribute: () => true,
                                    getAttribute: () => 'Test Teams'
                                };
                            }
                            return null;
                        },
                        getElementsByTagName: (tag) => {
                            if (tag === 'event') {
                                return [
                                    {
                                        getAttribute: (attr) => {
                                            if (attr === 'event') return 'GOAL_FOR';
                                            if (attr === 'timeMs') return '60000';
                                            return null;
                                        }
                                    },
                                    {
                                        getAttribute: (attr) => {
                                            if (attr === 'event') return 'FOUL';
                                            if (attr === 'timeMs') return '120000';
                                            return null;
                                        }
                                    }
                                ];
                            }
                            return [];
                        }
                    };
                    return mockDoc;
                } else {
                    // Legacy format with <instance> elements
                    const mockDoc = {
                        querySelector: (selector) => {
                            if (selector === 'game') {
                                return {
                                    hasAttribute: () => true,
                                    getAttribute: () => 'Legacy Teams'
                                };
                            }
                            return null;
                        },
                        getElementsByTagName: (tag) => {
                            if (tag === 'instance') {
                                return [
                                    {
                                        getElementsByTagName: (childTag) => {
                                            if (childTag === 'ID') return [{ textContent: '1' }];
                                            if (childTag === 'start') return [{ textContent: '55' }];
                                            if (childTag === 'end') return [{ textContent: '65' }];
                                            if (childTag === 'code') return [{ textContent: 'GOAL_FOR' }];
                                            return [];
                                        }
                                    },
                                    {
                                        getElementsByTagName: (childTag) => {
                                            if (childTag === 'ID') return [{ textContent: '2' }];
                                            if (childTag === 'start') return [{ textContent: '115' }];
                                            if (childTag === 'end') return [{ textContent: '125' }];
                                            if (childTag === 'code') return [{ textContent: 'FOUL' }];
                                            return [];
                                        }
                                    }
                                ];
                            }
                            return [];
                        }
                    };
                    return mockDoc;
                }
            }
        };
    });

    afterAll(() => {
        global.DOMParser = originalDOMParser;
    });

    describe('parseXmlToEvents', () => {
        test('should parse new format XML with <event> elements', () => {
            const xmlContent = `
                <?xml version="1.0" encoding="UTF-8"?>
                <game date="2025-05-10" teams="Team A vs Team B">
                    <events>
                        <event event="GOAL_FOR" timeMs="60000" />
                        <event event="FOUL" timeMs="120000" />
                    </events>
                </game>
            `;

            const events = parseXmlToEvents(xmlContent);

            expect(events.length).toBe(2);
            expect(events[0].event).toBe('GOAL_FOR');
            expect(events[0].timeMs).toBe(60000);
            expect(events[1].event).toBe('FOUL');
            expect(events[1].timeMs).toBe(120000);
            expect(events.teamsAttribute).toBe('Test Teams');
        });

        test('should parse legacy format XML with <instance> elements', () => {
            const xmlContent = `
                <instance><ID>1</ID><start>55</start><end>65</end><code>GOAL_FOR</code></instance>
                <instance><ID>2</ID><start>115</start><end>125</end><code>FOUL</code></instance>
            `;

            const events = parseXmlToEvents(xmlContent);

            expect(events.length).toBe(2);
            expect(events[0].event).toBe('GOAL_FOR');
            // Legacy format converts seconds to milliseconds and calculates average of start+end
            expect(events[0].timeMs).toBe(60000); // (55+65)/2 * 1000
            expect(events[1].event).toBe('FOUL');
            expect(events[1].timeMs).toBe(120000); // (115+125)/2 * 1000
            expect(events.teamsAttribute).toBe('Legacy Teams');
        });
    });

    describe('validateXmlStructure', () => {
        test('should validate new format XML with <event> elements', () => {
            const xmlContent = `
                <?xml version="1.0" encoding="UTF-8"?>
                <game date="2025-05-10" teams="Team A vs Team B">
                    <events>
                        <event event="GOAL_FOR" timeMs="60000" />
                        <event event="FOUL" timeMs="120000" />
                    </events>
                </game>
            `;

            expect(() => {
                validateXmlStructure(xmlContent);
            }).not.toThrow();
        });

        test('should validate legacy format XML with <instance> elements', () => {
            const xmlContent = `
                <instance><ID>1</ID><start>55</start><end>65</end><code>GOAL_FOR</code></instance>
                <instance><ID>2</ID><start>115</start><end>125</end><code>FOUL</code></instance>
            `;

            expect(() => {
                validateXmlStructure(xmlContent);
            }).not.toThrow();
        });

        test('should throw error for invalid XML', () => {
            const xmlContent = '<parsererror>Invalid XML</parsererror>';

            expect(() => {
                validateXmlStructure(xmlContent);
            }).toThrow('Invalid XML format.');
        });
    });

    describe('generateGameXml', () => {
        test('should generate correctly formatted XML for a game', () => {
            const mockGame = {
                teams: 'Team A vs Team B',
                timestamp: '2025-05-10T12:00:00Z',
                events: [
                    { event: 'GOAL_FOR', timeMs: 60000 },
                    { event: 'FOUL', timeMs: 120000 }
                ]
            };

            const result = generateGameXml(mockGame, 1);

            expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(result).toContain('<game date="2025-05-10" teams="Team A vs Team B">');
            expect(result).toContain('<event event="GOAL_FOR" timeMs="60000" />');
            expect(result).toContain('<event event="FOUL" timeMs="120000" />');
            expect(result).toContain('</events>');
            expect(result).toContain('</game>');
        });

        test('should use game index when teams name is not available', () => {
            const mockGame = {
                timestamp: '2025-05-10T12:00:00Z',
                events: [
                    { event: 'GOAL_FOR', timeMs: 60000 }
                ]
            };

            const result = generateGameXml(mockGame, 3);

            expect(result).toContain('teams="Game 3"');
        });
    });
});
