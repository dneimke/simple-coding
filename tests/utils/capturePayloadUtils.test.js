import {
    isPenaltyCornerButton,
    getButtonTeamCode,
    createCaptureEventPayload
} from '../../src/utils/capturePayloadUtils.js';

describe('capturePayloadUtils', () => {
    describe('isPenaltyCornerButton', () => {
        test('returns true when dataset.baseEvent is PC', () => {
            const btn = { dataset: { baseEvent: 'PC' } };
            expect(isPenaltyCornerButton(btn)).toBe(true);
        });

        test('returns true when dataset.event ends with PC', () => {
            const btn = { dataset: { event: 'Fire PC' } };
            expect(isPenaltyCornerButton(btn)).toBe(true);
        });

        test('returns true when button text content contains Penalty Corner', () => {
            const btn = { dataset: {}, textContent: 'Team 1 Penalty Corner' };
            expect(isPenaltyCornerButton(btn)).toBe(true);
        });

        test('returns false for standard non-PC event buttons', () => {
            const btn = { dataset: { event: 'Shot', baseEvent: 'SHOT' }, textContent: 'Shot' };
            expect(isPenaltyCornerButton(btn)).toBe(false);
            expect(isPenaltyCornerButton(null)).toBe(false);
            expect(isPenaltyCornerButton({})).toBe(false);
        });
    });

    describe('getButtonTeamCode', () => {
        const teams = [{ code: 'FIRE' }, { code: 'TIGERS' }];

        test('extracts correct team code for team slots 1 and 2', () => {
            expect(getButtonTeamCode('1', teams)).toBe('FIRE');
            expect(getButtonTeamCode(2, teams)).toBe('TIGERS');
        });

        test('returns null when teamSlot is missing, out of range, or teams is empty', () => {
            expect(getButtonTeamCode(null, teams)).toBeNull();
            expect(getButtonTeamCode('3', teams)).toBeNull();
            expect(getButtonTeamCode('1', null)).toBeNull();
            expect(getButtonTeamCode('1', [])).toBeNull();
        });
    });

    describe('createCaptureEventPayload', () => {
        const teams = [{ code: 'FIRE' }, { code: 'TIGERS' }];

        test('creates payload with correct metadata, timing, and non-PC defaults', () => {
            const button = {
                dataset: {
                    event: 'Circle Entry',
                    teamSlot: '1'
                }
            };
            const payload = createCaptureEventPayload(button, {
                teams,
                elapsedTime: 65400
            });

            expect(payload.id).toMatch(/^pc-\d+-[a-z0-9]+$/);
            expect(payload.event).toBe('Circle Entry');
            expect(payload.timeMs).toBe(65400);
            expect(payload.timestamp).toBe('01:05');
            expect(payload.team).toBe('FIRE');
            expect(payload.eventCode).toBe('Circle Entry');
            expect(payload.leadTime).toBe(10);
            expect(payload.lagTime).toBe(15);
        });

        test('enforces pre-baked 10/15 clip lead/lag for Penalty Corner events', () => {
            const button = {
                dataset: {
                    baseEvent: 'PC',
                    event: 'PC',
                    teamSlot: '2',
                    lead: '5',
                    lag: '5'
                }
            };
            const payload = createCaptureEventPayload(button, {
                teams,
                elapsedTime: 120000
            });

            expect(payload.eventCode).toBe('PC');
            expect(payload.team).toBe('TIGERS');
            // For PC, rules enforce 10s lead and 15s lag regardless of dataset clip
            expect(payload.leadTime).toBe(10);
            expect(payload.lagTime).toBe(15);
        });

        test('respects custom dataset lead and lag for non-PC events', () => {
            const button = {
                dataset: {
                    event: 'Shot',
                    teamSlot: '1',
                    lead: '8',
                    lag: '12'
                }
            };
            const payload = createCaptureEventPayload(button, {
                teams,
                elapsedTime: 30000
            });

            expect(payload.lead).toBe(8);
            expect(payload.lag).toBe(12);
            expect(payload.leadTime).toBe(8);
            expect(payload.lagTime).toBe(12);
        });

        test('applies zone resolution when button is zoned', () => {
            const button = {
                dataset: {
                    event: 'BS',
                    zoned: 'true',
                    teamSlot: '2'
                }
            };
            const zones = { values: ['1', '2', '3', '4'] };

            // Team 2 mirrors zone: active zone 1 becomes zone 4 from Team 2 perspective
            const payload = createCaptureEventPayload(button, {
                zone: '1',
                zones,
                teams,
                elapsedTime: 45000
            });

            expect(payload.event).toBe('BS4');
            expect(payload.team).toBe('TIGERS');
        });
    });
});
