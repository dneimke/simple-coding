/**
 * Quick Tag Editor & Button UI Helper
 * Decomposes quick tag form management and button layout for Timeline Video Tagging.
 * Protects Friction 2 (Two-pass coding slog / single-pass compound tagging).
 */

/**
 * Resolves team selection from radio inputs.
 *
 * @param {HTMLInputElement|Object|null} radio1
 * @param {HTMLInputElement|Object|null} radio2
 * @returns {'team1'|'team2'|'none'}
 */
export function resolveSelectedTeamRadio(radio1, radio2) {
    if (radio1 && radio1.checked) return 'team1';
    if (radio2 && radio2.checked) return 'team2';
    return 'none';
}

/**
 * Updates color selector visibility and team color inheritance text.
 *
 * @param {'team1'|'team2'|'none'} team
 * @param {Array<{code: string, color: string}>} teams
 * @param {HTMLElement|Object|null} colorSelector
 * @param {HTMLElement|Object|null} inheritedNotice
 */
export function toggleTeamColorNotice(team, teams, colorSelector, inheritedNotice) {
    const isNone = team === 'none';
    if (colorSelector) {
        colorSelector.classList.toggle('hidden', !isNone);
    }
    if (!inheritedNotice) return;
    inheritedNotice.classList.toggle('hidden', isNone);
    if (!isNone) {
        const teamCode = team === 'team1' ? teams[0].code : teams[1].code;
        inheritedNotice.textContent = `Inherits ${teamCode} color`;
    }
}

/**
 * Populates tag edit form fields when editing an existing tag.
 *
 * @param {Object} tag
 * @param {Object} elements
 */
export function populateTagEditFormFields(tag, elements) {
    const { formTitle, labelInput, btnLabel, btnIcon, cancelBtn, zoneCheckbox } = elements;
    if (formTitle) formTitle.textContent = `Edit Tag: ${tag.label}`;
    if (labelInput) {
        labelInput.value = tag.label;
        if (labelInput.focus) labelInput.focus();
        if (labelInput.select) labelInput.select();
    }
    if (btnLabel) btnLabel.textContent = 'Save';
    if (btnIcon) btnIcon.className = 'fas fa-check text-xs';
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    if (zoneCheckbox) zoneCheckbox.checked = Boolean(tag.zoned);
}

/**
 * Applies team radio button selection for tag editor.
 *
 * @param {string|undefined} team
 * @param {Object} elements
 */
export function applyTagFormTeamSelection(team, elements) {
    const { radio1, radio2, radioNone } = elements;
    if (team === 'team1' && radio1) {
        radio1.checked = true;
    } else if (team === 'team2' && radio2) {
        radio2.checked = true;
    } else if (radioNone) {
        radioNone.checked = true;
    }
}

/**
 * Resets tag edit form fields to Add New Tag default state.
 *
 * @param {Object} elements
 */
export function resetTagFormFields(elements) {
    const { formTitle, labelInput, btnLabel, btnIcon, cancelBtn, radioNone, zoneCheckbox } = elements;
    if (formTitle) formTitle.textContent = 'Add New Tag';
    if (labelInput) labelInput.value = '';
    if (btnLabel) btnLabel.textContent = 'Add';
    if (btnIcon) btnIcon.className = 'fas fa-plus text-xs';
    if (cancelBtn) cancelBtn.classList.add('hidden');
    if (radioNone) radioNone.checked = true;
    if (zoneCheckbox) zoneCheckbox.checked = false;
}

function createTagTeamBadge(team, teams) {
    if (team !== 'team1' && team !== 'team2') return null;
    const badge = document.createElement('span');
    badge.className = 'quick-tag-team-badge';
    badge.textContent = team === 'team1' ? teams[0].code : teams[1].code;
    return badge;
}

function createTagLabelSpans(codeLabel, key) {
    const labelSpan = document.createElement('span');
    labelSpan.className = 'tag-label';
    labelSpan.textContent = codeLabel;

    const keySpan = document.createElement('span');
    keySpan.className = 'tag-shortcut';
    keySpan.textContent = key ? `[${key}]` : '';

    return [labelSpan, keySpan];
}

function createMoveButton(direction, displayLabel, isDisabled, onClick) {
    const isLeft = direction === 'left';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `quick-tag-move-btn move-${direction}`;
    btn.setAttribute('aria-label', `Move ${displayLabel} ${direction}`);
    btn.title = `Move ${direction}`;
    btn.innerHTML = `<i class="fas fa-chevron-${isLeft ? 'left' : 'right'}" aria-hidden="true"></i>`;
    if (isDisabled) {
        btn.disabled = true;
    } else {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            onClick();
        });
    }
    return btn;
}

function appendEditBadges(btn, tag, displayLabel, index, totalTags, callbacks) {
    const { onDelete, onMove } = callbacks;

    const delBadge = document.createElement('button');
    delBadge.type = 'button';
    delBadge.className = 'quick-tag-delete-badge';
    delBadge.setAttribute('aria-label', `Remove tag ${displayLabel}`);
    delBadge.title = `Remove ${displayLabel}`;
    delBadge.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
    delBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (onDelete) onDelete(tag.id);
    });
    btn.appendChild(delBadge);

    const moveLeft = createMoveButton('left', displayLabel, index === 0, () => {
        if (onMove) onMove(tag.id, 'left');
    });
    const moveRight = createMoveButton('right', displayLabel, index === totalTags - 1, () => {
        if (onMove) onMove(tag.id, 'right');
    });
    btn.append(moveLeft, moveRight);
}

/**
 * Creates a quick tag button element.
 *
 * @param {Object} tag
 * @param {number} index
 * @param {number} totalTags
 * @param {Object} options
 * @returns {HTMLButtonElement}
 */
export function createQuickTagElement(tag, index, totalTags, options) {
    const { isEditing, activeEditingId, teams, onTagClick, onDelete, onMove, resolveTagDisplay } = options;
    const resolved = resolveTagDisplay
        ? resolveTagDisplay(tag, teams)
        : { displayLabel: tag.label, codeLabel: tag.label, colorClass: tag.colorClass || 'btn-blue' };

    const btn = document.createElement('button');
    btn.type = 'button';
    const isEditClass = isEditing ? 'is-editing' : '';
    const isActiveClass = activeEditingId === tag.id ? 'is-active-edit' : '';
    btn.className = `quick-tag-btn ${resolved.colorClass} ${isEditClass} ${isActiveClass}`.trim();
    btn.setAttribute('data-quick-tag', resolved.displayLabel);
    btn.setAttribute('data-tag-id', tag.id);
    btn.setAttribute('aria-label', `Tag ${resolved.displayLabel} (Press ${tag.key || ''})`);

    const badge = createTagTeamBadge(tag.team, teams);
    if (badge) btn.appendChild(badge);

    const spans = createTagLabelSpans(resolved.codeLabel, tag.key);
    btn.append(...spans);

    if (isEditing) {
        appendEditBadges(btn, tag, resolved.displayLabel, index, totalTags, { onDelete, onMove });
    }

    btn.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('.quick-tag-delete-badge, .quick-tag-move-btn')) return;
        if (onTagClick) onTagClick(tag);
    });

    return btn;
}

/**
 * Commits a quick tag create or update action.
 *
 * @param {Object} payload
 * @param {string|null} activeId
 * @param {HTMLInputElement|Object|null} inputEl
 * @param {HTMLInputElement|Object|null} zoneCheckbox
 * @param {Object} deps
 */
export function commitSaveQuickTag(payload, activeId, inputEl, zoneCheckbox, deps) {
    const { onUpdate, onAdd, onReset } = deps;
    if (activeId) {
        if (onUpdate) onUpdate(activeId, payload);
        if (onReset) onReset();
        return;
    }
    if (onAdd) onAdd(payload);
    if (inputEl) {
        inputEl.value = '';
        if (inputEl.focus) inputEl.focus();
    }
    if (zoneCheckbox) {
        zoneCheckbox.checked = false;
    }
}
