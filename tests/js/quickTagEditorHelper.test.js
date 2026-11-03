/**
 * @jest-environment jsdom
 */

import {
    resolveSelectedTeamRadio,
    toggleTeamColorNotice,
    applyTagFormTeamSelection,
    populateTagEditFormFields,
    resetTagFormFields,
    createQuickTagElement,
    commitSaveQuickTag
} from '../../src/js/quickTagEditorHelper.js';

describe('quickTagEditorHelper', () => {
    describe('resolveSelectedTeamRadio', () => {
        test('returns team1 when radio1 is checked', () => {
            const r1 = { checked: true };
            const r2 = { checked: false };
            expect(resolveSelectedTeamRadio(r1, r2)).toBe('team1');
        });

        test('returns team2 when radio2 is checked', () => {
            const r1 = { checked: false };
            const r2 = { checked: true };
            expect(resolveSelectedTeamRadio(r1, r2)).toBe('team2');
        });

        test('returns none when neither is checked or null', () => {
            expect(resolveSelectedTeamRadio(null, null)).toBe('none');
            expect(resolveSelectedTeamRadio({ checked: false }, { checked: false })).toBe('none');
        });
    });

    describe('toggleTeamColorNotice', () => {
        test('shows color selector and hides notice when team is none', () => {
            const colorSelector = { classList: { toggle: jest.fn() } };
            const notice = { classList: { toggle: jest.fn() }, textContent: '' };
            toggleTeamColorNotice('none', [{ code: 'FIRE' }, { code: 'TIGERS' }], colorSelector, notice);

            expect(colorSelector.classList.toggle).toHaveBeenCalledWith('hidden', false);
            expect(notice.classList.toggle).toHaveBeenCalledWith('hidden', true);
        });

        test('hides color selector and sets notice text when team is selected', () => {
            const colorSelector = { classList: { toggle: jest.fn() } };
            const notice = { classList: { toggle: jest.fn() }, textContent: '' };
            toggleTeamColorNotice('team1', [{ code: 'FIRE' }, { code: 'TIGERS' }], colorSelector, notice);

            expect(colorSelector.classList.toggle).toHaveBeenCalledWith('hidden', true);
            expect(notice.classList.toggle).toHaveBeenCalledWith('hidden', false);
            expect(notice.textContent).toBe('Inherits FIRE color');
        });
    });

    describe('populateTagEditFormFields and resetTagFormFields', () => {
        let elements;
        beforeEach(() => {
            elements = {
                formTitle: { textContent: '' },
                labelInput: { value: '', focus: jest.fn(), select: jest.fn() },
                btnLabel: { textContent: '' },
                btnIcon: { className: '' },
                cancelBtn: { classList: { remove: jest.fn(), add: jest.fn() } },
                radio1: { checked: false },
                radio2: { checked: false },
                radioNone: { checked: false },
                zoneCheckbox: { checked: false }
            };
        });

        test('populates form for editing existing tag', () => {
            const tag = { id: 't1', label: 'Shot', zoned: true, team: 'team2' };
            populateTagEditFormFields(tag, elements);
            applyTagFormTeamSelection(tag.team, elements);

            expect(elements.formTitle.textContent).toBe('Edit Tag: Shot');
            expect(elements.labelInput.value).toBe('Shot');
            expect(elements.btnLabel.textContent).toBe('Save');
            expect(elements.btnIcon.className).toBe('fas fa-check text-xs');
            expect(elements.cancelBtn.classList.remove).toHaveBeenCalledWith('hidden');
            expect(elements.zoneCheckbox.checked).toBe(true);
            expect(elements.radio2.checked).toBe(true);
        });

        test('resets form to default Add New Tag state', () => {
            resetTagFormFields(elements);

            expect(elements.formTitle.textContent).toBe('Add New Tag');
            expect(elements.labelInput.value).toBe('');
            expect(elements.btnLabel.textContent).toBe('Add');
            expect(elements.btnIcon.className).toBe('fas fa-plus text-xs');
            expect(elements.cancelBtn.classList.add).toHaveBeenCalledWith('hidden');
            expect(elements.radioNone.checked).toBe(true);
            expect(elements.zoneCheckbox.checked).toBe(false);
        });
    });

    describe('createQuickTagElement', () => {
        const teams = [{ code: 'FIRE', color: 'red' }, { code: 'TIGERS', color: 'blue' }];

        test('creates regular 1-tap tag button with label and shortcut', () => {
            const tag = { id: 't1', label: 'Circle Entry', team: 'none', colorClass: 'btn-blue', key: '3' };
            const onTagClick = jest.fn();

            const btn = createQuickTagElement(tag, 0, 1, {
                isEditing: false,
                activeEditingId: null,
                teams,
                onTagClick,
                onDelete: jest.fn(),
                onMove: jest.fn()
            });

            expect(btn.tagName).toBe('BUTTON');
            expect(btn.className).toContain('quick-tag-btn');
            expect(btn.className).toContain('btn-blue');
            expect(btn.querySelector('.tag-label').textContent).toBe('Circle Entry');
            expect(btn.querySelector('.tag-shortcut').textContent).toBe('[3]');

            btn.click();
            expect(onTagClick).toHaveBeenCalledWith(tag);
        });

        test('creates editing tag button with delete and move badges', () => {
            const tag = { id: 't1', label: 'Goal', team: 'team1', colorClass: 'btn-green', key: '1' };
            const onDelete = jest.fn();
            const onMove = jest.fn();

            const btn = createQuickTagElement(tag, 0, 2, {
                isEditing: true,
                activeEditingId: 't1',
                teams,
                onTagClick: jest.fn(),
                onDelete,
                onMove
            });

            expect(btn.className).toContain('is-editing');
            expect(btn.className).toContain('is-active-edit');
            expect(btn.querySelector('.quick-tag-team-badge').textContent).toBe('FIRE');

            const delBadge = btn.querySelector('.quick-tag-delete-badge');
            expect(delBadge).not.toBeNull();
            delBadge.click();
            expect(onDelete).toHaveBeenCalledWith('t1');

            const moveLeft = btn.querySelector('.quick-tag-move-btn.move-left');
            expect(moveLeft.disabled).toBe(true); // index 0 disabled

            const moveRight = btn.querySelector('.quick-tag-move-btn.move-right');
            expect(moveRight.disabled).toBe(false);
            moveRight.click();
            expect(onMove).toHaveBeenCalledWith('t1', 'right');
        });
    });

    describe('commitSaveQuickTag', () => {
        test('updates tag and calls reset when activeId is present', () => {
            const onUpdate = jest.fn();
            const onReset = jest.fn();
            commitSaveQuickTag({ label: 'Goal' }, 't1', null, null, { onUpdate, onReset });

            expect(onUpdate).toHaveBeenCalledWith('t1', { label: 'Goal' });
            expect(onReset).toHaveBeenCalled();
        });

        test('adds tag and clears form inputs when activeId is null', () => {
            const onAdd = jest.fn();
            const inputEl = { value: 'Goal', focus: jest.fn() };
            const checkboxEl = { checked: true };
            commitSaveQuickTag({ label: 'Goal' }, null, inputEl, checkboxEl, { onAdd });

            expect(onAdd).toHaveBeenCalledWith({ label: 'Goal' });
            expect(inputEl.value).toBe('');
            expect(inputEl.focus).toHaveBeenCalled();
            expect(checkboxEl.checked).toBe(false);
        });
    });
});
