import { formatClock } from './copy.js';

const STORAGE_PREFIX = 'sequence_feedback_';

/**
 * @typedef {Object} FeedbackItem
 * @property {string} id - Entry ID
 * @property {string} eventId - Source event ID
 * @property {string} team - Team name
 * @property {string} entryType - 'CE' or 'A25E'
 * @property {string} clockText - Formatted clock
 * @property {string} videoTime - Video clock
 * @property {string} currentSeek - Formatted seek clock
 * @property {number} currentSeekSeconds - Seek seconds
 * @property {string} originType - 'Counter' or 'Build-Up'
 * @property {string} reason - Classification reason
 * @property {string} chain - Event code chain (e.g. 'BW2 -> A25E -> CE')
 * @property {string[]} issues - Array of issue tags
 * @property {string} suggestedSeek - Coach suggested seek clock
 * @property {string} suggestedOrigin - Coach suggested origin
 * @property {string} coachNotes - Coach observations
 * @property {number} createdAt - Timestamp
 */

/**
 * Creates an observable feedback store backed by storage
 * @param {Storage} [storage]
 * @param {string} [gameId]
 */
export function createFeedbackStore(storage = (typeof window !== 'undefined' ? window.localStorage : null), gameId = 'default') {
    const key = `${STORAGE_PREFIX}${gameId}`;
    const listeners = new Set();
    let items = loadItems(storage, key);

    function notify() {
        saveItems(storage, key, items);
        listeners.forEach(fn => fn(items));
    }

    return {
        getAll: () => [...items],
        get: (id) => items.find(it => it.id === id),
        has: (id) => items.some(it => it.id === id),
        count: () => items.length,
        set: (item) => {
            const idx = items.findIndex(it => it.id === item.id);
            if (idx >= 0) {
                items[idx] = { ...items[idx], ...item, updatedAt: Date.now() };
            } else {
                items.push({ ...item, createdAt: Date.now() });
            }
            notify();
        },
        remove: (id) => {
            items = items.filter(it => it.id !== id);
            notify();
        },
        clear: () => {
            items = [];
            notify();
        },
        subscribe: (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        }
    };
}

function loadItems(storage, key) {
    if (!storage) return [];
    try {
        const raw = storage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveItems(storage, key, items) {
    if (!storage) return;
    try {
        storage.setItem(key, JSON.stringify(items));
    } catch {}
}

/**
 * Formats a batch of feedback items into clean markdown for pasting to the AI assistant
 * @param {FeedbackItem[]} items
 * @param {string} [gameLabel]
 * @returns {string}
 */
export function formatFeedbackMarkdown(items, gameLabel = 'Coded match') {
    if (!items || items.length === 0) return 'No feedback items flagged.';

    const lines = [
        `### 🚩 Sequence Feedback Batch (${items.length} ${items.length === 1 ? 'item' : 'items'})`,
        `**Match:** ${gameLabel}`,
        ''
    ];

    items.forEach((item, index) => {
        lines.push(`${index + 1}. **${item.team} ${item.entryType}** · ${item.clockText} (video ${item.videoTime})`);
        lines.push(`   - **Current:** ${item.originType} (${item.reason}) · Seek ${item.currentSeek}`);
        if (item.issues && item.issues.length) {
            lines.push(`   - **Issues:** ${item.issues.join(', ')}`);
        }
        if (item.suggestedSeek && item.suggestedSeek !== item.currentSeek) {
            lines.push(`   - **Suggested Seek:** ${item.suggestedSeek}`);
        }
        if (item.suggestedOrigin && item.suggestedOrigin !== item.originType) {
            lines.push(`   - **Suggested Origin:** ${item.suggestedOrigin}`);
        }
        if (item.coachNotes && item.coachNotes.trim()) {
            lines.push(`   - **Coach Note:** ${item.coachNotes.trim()}`);
        }
        if (item.chain) {
            lines.push(`   - **Chain:** ${item.chain}`);
        }
        lines.push('');
    });

    return lines.join('\n');
}

/**
 * Exports feedback items as JSON
 * @param {FeedbackItem[]} items
 * @param {string} [gameLabel]
 * @returns {string}
 */
export function exportFeedbackJson(items, gameLabel = 'Coded match') {
    return JSON.stringify({
        match: gameLabel,
        exportedAt: new Date().toISOString(),
        count: items.length,
        items
    }, null, 2);
}

/**
 * Renders the top Feedback Batch banner
 * @param {HTMLElement} container
 * @param {ReturnType<typeof createFeedbackStore>} store
 * @param {{ gameLabel?: string, onCopy?: () => void }} [options]
 */
export function renderFeedbackBar(container, store, options = {}) {
    const gameLabel = options.gameLabel || 'Coded match';

    function render() {
        const count = store.count();
        const items = store.getAll();
        container.replaceChildren();

        const banner = document.createElement('div');
        banner.className = 'surface px-3 py-1.5 border rounded-lg mb-2.5 flex flex-wrap items-center justify-between gap-2 bg-amber-50/60 border-amber-200 text-xs';

        const left = document.createElement('div');
        left.className = 'flex items-center gap-2 min-w-0';
        left.innerHTML = `
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full ${count > 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'} font-bold text-[10px] flex-shrink-0">
                <i class="fas fa-flag" aria-hidden="true"></i>
            </span>
            <div class="min-w-0 flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-xs text-slate-900">Feedback Batch</span>
                <span class="px-1.5 py-0.2 rounded-full text-[11px] font-bold ${count > 0 ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'}" id="feedback-count-badge">
                    ${count} ${count === 1 ? 'item' : 'items'}
                </span>
                <span class="text-[11px] text-slate-500 hidden md:inline truncate">
                    ${count > 0 ? 'Review completed. Copy formatted batch or download JSON.' : 'Click 🚩 on any sequence card or video to flag issues.'}
                </span>
            </div>
        `;

        const actions = document.createElement('div');
        actions.className = 'flex items-center gap-2 flex-wrap';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.id = 'copy-feedback-btn';
        copyBtn.className = 'btn btn-primary btn-compact flex items-center gap-1.5 text-xs font-semibold';
        copyBtn.disabled = count === 0;
        copyBtn.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i>Copy Batch for AI';
        copyBtn.addEventListener('click', () => {
            const md = formatFeedbackMarkdown(items, gameLabel);
            copyToClipboard(md, copyBtn, 'Copied for AI!');
            if (options.onCopy) options.onCopy();
        });

        const jsonBtn = document.createElement('button');
        jsonBtn.type = 'button';
        jsonBtn.id = 'download-feedback-json-btn';
        jsonBtn.className = 'btn btn-secondary btn-compact flex items-center gap-1.5 text-xs';
        jsonBtn.disabled = count === 0;
        jsonBtn.innerHTML = '<i class="fas fa-download" aria-hidden="true"></i>JSON';
        jsonBtn.addEventListener('click', () => {
            downloadJsonFile(exportFeedbackJson(items, gameLabel), `sequence-feedback-${Date.now()}.json`);
        });

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.id = 'clear-feedback-btn';
        clearBtn.className = 'btn btn-ghost btn-compact text-xs text-slate-500 hover:text-red-700';
        clearBtn.disabled = count === 0;
        clearBtn.textContent = 'Clear';
        clearBtn.addEventListener('click', () => {
            if (window.confirm('Clear all flagged items in this batch?')) {
                store.clear();
            }
        });

        actions.append(copyBtn, jsonBtn, clearBtn);
        banner.append(left, actions);
        container.append(banner);
    }

    render();
    return store.subscribe(render);
}

function copyToClipboard(text, button, successLabel) {
    if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => flashButtonSuccess(button, successLabel)).catch(() => promptFallback(text));
    } else {
        promptFallback(text);
    }
}

function flashButtonSuccess(button, label) {
    const original = button.innerHTML;
    button.innerHTML = `<i class="fas fa-check" aria-hidden="true"></i>${label}`;
    button.classList.add('btn-success');
    setTimeout(() => {
        button.innerHTML = original;
        button.classList.remove('btn-success');
    }, 2000);
}

function promptFallback(text) {
    if (typeof window !== 'undefined' && window.prompt) {
        window.prompt('Copy feedback to clipboard:', text);
    }
}

function downloadJsonFile(content, fileName) {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Opens a modal dialog to flag or edit feedback for an entry
 * @param {Document} doc
 * @param {object} entry
 * @param {HTMLVideoElement} [videoEl]
 * @param {ReturnType<typeof createFeedbackStore>} store
 */
export function openFeedbackModal(doc, entry, videoEl, store) {
    const existing = store.get(entry.id);
    const modalId = 'sequence-feedback-modal';
    const old = doc.getElementById(modalId);
    if (old) old.remove();

    const overlay = doc.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto';

    const currentSeekText = formatClock(entry.seekSeconds * 1000);
    const videoCurrentText = formatVideoCurrent(videoEl);

    const card = renderModalCard(entry, existing, currentSeekText, videoCurrentText);
    overlay.append(card);
    doc.body.append(overlay);

    wireModalEvents(card, overlay, entry, store, currentSeekText);
}

function formatVideoCurrent(videoEl) {
    if (!videoEl || !Number.isFinite(videoEl.currentTime)) return null;
    return formatClock(Math.floor(videoEl.currentTime) * 1000);
}

function renderModalCard(entry, existing, currentSeekText, videoCurrentText) {
    const card = document.createElement('div');
    card.className = 'surface surface-padded bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 flex flex-col gap-4 text-slate-800 animate-in fade-in duration-150';

    const clockText = entry.quarter ? `${entry.quarter} ${entry.matchClock}` : `match ${entry.matchClock}`;

    card.innerHTML = `
        <div class="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
                <span class="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                    <i class="fas fa-flag" aria-hidden="true"></i>Coach Feedback
                </span>
                <h3 class="text-base font-bold text-slate-900 mt-0.5">
                    ${entry.team} ${entry.entryType} · ${clockText}
                </h3>
                <p class="text-xs text-slate-500">Video clip at ${entry.videoTime} · Current Seek: <strong>${currentSeekText}</strong></p>
            </div>
            <button type="button" class="btn-close text-slate-400 hover:text-slate-600 p-1" aria-label="Close">
                <i class="fas fa-times text-base" aria-hidden="true"></i>
            </button>
        </div>

        <form id="feedback-form" class="flex flex-col gap-4 text-xs">
            ${renderTimingField(currentSeekText, videoCurrentText, entry.seekSeconds, existing)}
            ${renderIssueCheckboxes(existing)}
            ${renderOriginSelect(entry, existing)}

            <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-slate-700">Coach Notes</label>
                <textarea name="coachNotes" rows="2" class="textarea border rounded p-2 text-xs" placeholder="e.g. Intercept happened at 15:55, need 5s lead to see Fire pass...">${existing?.coachNotes || ''}</textarea>
            </div>

            <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-1">
                <div>
                    ${existing ? '<button type="button" id="remove-flag-btn" class="btn btn-ghost btn-compact text-xs text-red-600 hover:text-red-800">Remove from Batch</button>' : ''}
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" class="btn btn-secondary btn-compact text-xs btn-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary btn-compact text-xs font-semibold">Save to Batch</button>
                </div>
            </div>
        </form>
    `;
    return card;
}

function renderTimingField(currentSeekText, videoCurrentText, seekSeconds, existing) {
    const m5 = formatClock(Math.max(0, (seekSeconds - 5) * 1000));
    const m10 = formatClock(Math.max(0, (seekSeconds - 10) * 1000));
    const videoBtnDisabled = !videoCurrentText ? 'disabled' : '';
    const videoBtnOpacity = !videoCurrentText ? 'opacity-50' : '';

    return `
        <div class="flex flex-col gap-1.5">
            <label class="font-semibold text-slate-700 flex items-center justify-between">
                <span>⏱️ Timing / Lead-In Offset</span>
                <span class="text-slate-400 font-normal">Current: ${currentSeekText}</span>
            </label>
            <div class="grid grid-cols-3 gap-2">
                <button type="button" class="btn btn-secondary btn-compact text-[11px] quick-time-btn" data-time="${m5}">
                    -5s earlier
                </button>
                <button type="button" class="btn btn-secondary btn-compact text-[11px] quick-time-btn" data-time="${m10}">
                    -10s earlier
                </button>
                <button type="button" class="btn btn-secondary btn-compact text-[11px] quick-time-btn ${videoBtnOpacity}" data-time="${videoCurrentText || currentSeekText}" ${videoBtnDisabled}>
                    Use Video (${videoCurrentText || '--:--'})
                </button>
            </div>
            <div class="flex items-center gap-2 mt-1">
                <span class="text-slate-500">Suggested Seek:</span>
                <input type="text" name="suggestedSeek" id="suggested-seek-input" class="input input-sm border rounded px-2 py-1 font-mono text-xs w-28 text-center" value="${existing?.suggestedSeek || currentSeekText}">
                <span class="text-[11px] text-slate-400">(mm:ss)</span>
            </div>
        </div>
    `;
}

function renderIssueCheckboxes(existing) {
    const issues = [
        ['Timing too late (missed turnover / leadup)', 'Seek too late — missed the turnover / ball win'],
        ['Timing too early', 'Seek too early — excessive dead time'],
        ['Wrong origin: Should be Counter', 'Classification wrong — should be ⚡ Counter (<10s)'],
        ['Wrong origin: Should be Build-Up', 'Classification wrong — should be 🛡️ Build-Up'],
        ['False entry / Invalid tag', 'False positive — not an attacking entry']
    ];

    const checks = issues.map(([val, label]) => `
        <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="issue" value="${val}" ${hasIssue(existing, val) ? 'checked' : ''} class="rounded text-brand">
            <span>${label}</span>
        </label>
    `).join('');

    return `
        <div class="flex flex-col gap-1.5">
            <label class="font-semibold text-slate-700">Flagged Issues</label>
            <div class="flex flex-col gap-1 text-[11px]">
                ${checks}
            </div>
        </div>
    `;
}

function renderOriginSelect(entry, existing) {
    const selectedOrigin = existing?.suggestedOrigin || entry.originType;
    const isSelected = (val) => selectedOrigin === val ? 'selected' : '';

    return `
        <div class="flex flex-col gap-1.5">
            <label class="font-semibold text-slate-700">Suggested Classification</label>
            <select name="suggestedOrigin" class="select select-sm border rounded px-2 py-1 text-xs">
                <option value="${entry.originType}" ${isSelected(entry.originType)}>Keep current (${entry.originType})</option>
                <option value="Counter" ${isSelected('Counter')}>⚡ Counter</option>
                <option value="Build-Up" ${isSelected('Build-Up')}>🛡️ Build-Up</option>
                <option value="Exclude" ${isSelected('Exclude')}>❌ Exclude / Invalid</option>
            </select>
        </div>
    `;
}

function wireModalEvents(card, overlay, entry, store, currentSeekText) {
    const close = () => overlay.remove();
    card.querySelector('.btn-close').addEventListener('click', close);
    card.querySelector('.btn-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    const removeBtn = card.querySelector('#remove-flag-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            store.remove(entry.id);
            close();
        });
    }

    const seekInput = card.querySelector('#suggested-seek-input');
    card.querySelectorAll('.quick-time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const time = btn.getAttribute('data-time');
            if (time && seekInput) seekInput.value = time;
        });
    });

    const form = card.querySelector('#feedback-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveFeedbackFromForm(form, entry, store, currentSeekText);
        close();
    });
}

function saveFeedbackFromForm(form, entry, store, currentSeekText) {
    const formData = new FormData(form);
    const issues = formData.getAll('issue').map(String);
    const suggestedSeek = String(formData.get('suggestedSeek') || currentSeekText).trim();
    const suggestedOrigin = String(formData.get('suggestedOrigin') || entry.originType);
    const coachNotes = String(formData.get('coachNotes') || '').trim();

    store.set({
        id: entry.id,
        eventId: entry.eventId,
        team: entry.team,
        entryType: entry.entryType,
        clockText: entry.quarter ? `${entry.quarter} ${entry.matchClock}` : `match ${entry.matchClock}`,
        videoTime: entry.videoTime,
        currentSeek: currentSeekText,
        currentSeekSeconds: entry.seekSeconds,
        originType: entry.originType,
        reason: entry.reason,
        chain: entry.codes ? entry.codes.join(' → ') : '',
        issues,
        suggestedSeek,
        suggestedOrigin,
        coachNotes
    });
}

function hasIssue(existing, needle) {
    if (!existing || !Array.isArray(existing.issues)) return false;
    return existing.issues.some(iss => iss.includes(needle));
}

export function wireFeedbackHeader(doc, store, options = {}) {
    const badgeBtn = doc.getElementById('feedback-badge-btn');
    const badgeCount = doc.getElementById('feedback-badge-count');
    const modal = doc.getElementById('feedback-modal');
    if (!badgeBtn || !modal) return;

    const gameLabel = options.gameLabel || 'Coded match';
    const closeBtn = doc.getElementById('close-feedback-modal');
    const copyBtn = doc.getElementById('copy-feedback-batch-btn');
    const jsonBtn = doc.getElementById('download-feedback-batch-json');
    const clearBtn = doc.getElementById('clear-feedback-batch-btn');
    const copyStatus = doc.getElementById('feedback-copy-status');
    const listEl = doc.getElementById('feedback-items-list');
    const countBadge = doc.getElementById('feedback-modal-count-badge');

    function sync() {
        const items = store.getAll();
        const count = items.length;
        if (badgeCount) badgeCount.textContent = `${count} Flagged`;
        if (countBadge) countBadge.textContent = String(count);

        if (count > 0) {
            badgeBtn.classList.remove('hidden');
        } else {
            badgeBtn.classList.add('hidden');
            modal.classList.add('hidden');
        }
        renderFeedbackItemsList(listEl, items, store);
    }

    badgeBtn.onclick = () => {
        sync();
        modal.classList.remove('hidden');
    };

    if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');

    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    };

    if (copyBtn) {
        copyBtn.onclick = () => {
            const md = formatFeedbackMarkdown(store.getAll(), gameLabel);
            copyTextToClipboard(md, copyStatus);
        };
    }

    if (jsonBtn) {
        jsonBtn.onclick = () => {
            const jsonStr = exportFeedbackJson(store.getAll(), gameLabel);
            downloadJsonBlob(jsonStr, 'sequence-feedback.json');
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            store.clear();
        };
    }

    store.subscribe(sync);
    sync();
}

function renderFeedbackItemsList(container, items, store) {
    if (!container) return;
    container.replaceChildren();
    if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'text-xs text-slate-400 text-center py-2';
        empty.textContent = 'No flagged clips yet.';
        container.append(empty);
        return;
    }
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'p-2 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between gap-2';
        const issuesText = item.issues && item.issues.length ? `<span class="text-[11px] text-amber-800">(${item.issues.join(', ')})</span>` : '';
        card.innerHTML = `
            <div class="min-w-0 flex flex-col">
                <span class="font-bold text-slate-800 truncate">${item.team} ${item.entryType} · ${item.clockText}</span>
                <span class="text-[11px] text-slate-500 truncate">${item.originType} · Seek ${item.currentSeek || item.suggestedSeek || ''} ${issuesText}</span>
            </div>
            <button type="button" class="btn btn-ghost btn-compact text-slate-400 hover:text-rose-600 text-xs px-1.5" title="Remove flag">✕</button>
        `;
        card.querySelector('button').onclick = () => store.remove(item.id);
        container.append(card);
    });
}

function copyTextToClipboard(text, statusEl) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            if (statusEl) {
                statusEl.classList.remove('hidden');
                setTimeout(() => statusEl.classList.add('hidden'), 2500);
            }
        }).catch(() => {});
    }
}

function downloadJsonBlob(jsonStr, filename) {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof document === 'undefined') return;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
