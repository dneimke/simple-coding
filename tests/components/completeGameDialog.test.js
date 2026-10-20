import { openCompleteGameDialog } from '../../src/components/completeGameDialog.js';

describe('openCompleteGameDialog', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="completeGameModal" class="modal hidden" role="dialog">
                <form id="completeGameForm">
                    <p id="completeGameSummary"></p>
                    <input id="completeGameName">
                    <button id="completeGameCancel" type="button">Cancel</button>
                    <button type="submit">Complete</button>
                </form>
            </div>`;
    });

    const submit = () => document.getElementById('completeGameForm')
        .dispatchEvent(new Event('submit', { cancelable: true }));

    test('shows the capture summary, prefills the team name, and resolves with the edited name', async () => {
        const result = openCompleteGameDialog({
            summary: 'Save 2 events, clock at 01:12, to Saved Games. The capture will reset.',
            suggestedName: 'FIRE vs TIGERS'
        });
        const modal = document.getElementById('completeGameModal');

        expect(modal.classList.contains('hidden')).toBe(false);
        expect(document.getElementById('completeGameSummary').textContent)
            .toBe('Save 2 events, clock at 01:12, to Saved Games. The capture will reset.');
        expect(document.getElementById('completeGameName').value).toBe('FIRE vs TIGERS');

        document.getElementById('completeGameName').value = '  Perth vs Fire  ';
        submit();

        await expect(result).resolves.toEqual({ name: 'Perth vs Fire' });
        expect(modal.classList.contains('hidden')).toBe(true);
    });

    test('cancel closes the dialog and does not return a name to save', async () => {
        const result = openCompleteGameDialog({
            summary: 'Save 1 event, clock at 00:10, to Saved Games. The capture will reset.',
            suggestedName: 'FIRE vs TIGERS'
        });

        document.getElementById('completeGameCancel').click();

        await expect(result).resolves.toBeNull();
        expect(document.getElementById('completeGameModal').classList.contains('hidden')).toBe(true);
    });

    test('escape closes the dialog without a name to save', async () => {
        const result = openCompleteGameDialog({
            summary: 'Save 1 event, clock at 00:10, to Saved Games. The capture will reset.',
            suggestedName: 'FIRE vs TIGERS'
        });

        document.getElementById('completeGameModal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        await expect(result).resolves.toBeNull();
    });

    test('a blank name stays blank so the game can be saved without one', async () => {
        const result = openCompleteGameDialog({
            summary: 'Save 0 events, clock at 00:00, to Saved Games. The capture will reset.',
            suggestedName: 'FIRE vs TIGERS'
        });

        document.getElementById('completeGameName').value = '   ';
        submit();

        await expect(result).resolves.toEqual({ name: '' });
    });
});
