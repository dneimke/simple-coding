/**
 * Renders attacking entry (A25E and CE) Counter vs Build-Up results
 * with a Coach Match Scoreboard, integrated 1-click filter lenses, and compact seekable rows.
 */

import { entryCodes, formatClock } from './copy.js';
import { createFeedbackStore, openFeedbackModal, wireFeedbackHeader } from './feedback.js';

/**
 * @typedef {Object} FilterState
 * @property {string} team - 'all' or team name
 * @property {string} entryType - 'all', 'CE', or 'A25E'
 * @property {string} originType - 'all', 'Counter', or 'Build-Up'
 * @property {string} [activeEntryId]
 */

/**
 * @param {HTMLElement} container
 * @param {{ name: string, timeSource: string, id?: string }} game
 * @param {{ entries: Array<object>, stats: object }} result
 * @param {{ mutated?: boolean, storage?: Storage, feedbackStore?: object, onSeek?: (seconds: number, entry: object) => void }} [meta]
 */
export function renderReport(container, game, result, meta = {}) {
    const allEntries = result.entries || result.sequences || [];
    const teams = [...new Set(allEntries.map(e => e.team))].filter(Boolean);
    const feedbackStore = meta.feedbackStore || createFeedbackStore(meta.storage, game.id || game.name);

    const state = {
        team: 'all',
        entryType: 'all',
        originType: 'all',
        activeEntryId: allEntries[0]?.id || null
    };

    container.replaceChildren();

    // Top: Coach Match Scoreboard
    const scoreboard = document.createElement('div');
    scoreboard.className = 'mb-2.5';
    container.append(scoreboard);

    // Two-column workspace: Entries List (left, 5 cols) + Large Sticky Video Player (right, 7 cols)
    const workspace = document.createElement('div');
    workspace.className = 'grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start';

    // Left Column: Filter Lens Header + Entry Rows (5 cols)
    const listCol = document.createElement('div');
    listCol.className = 'lg:col-span-5 flex flex-col gap-2.5 min-w-0 order-2 lg:order-1';

    const filterLensCard = document.createElement('div');
    filterLensCard.className = 'surface p-2.5 border rounded-lg';

    const listContainer = document.createElement('div');
    listContainer.className = 'flex flex-col gap-2';

    listCol.append(filterLensCard, listContainer);

    // Right Column: Large Sticky Video player (7 cols)
    const videoCol = document.createElement('div');
    videoCol.className = 'lg:col-span-7 lg:sticky lg:top-2 z-10 flex flex-col gap-2 order-1 lg:order-2';
    const videoCard = renderVideoCard((seekSec, entry) => {
        if (meta.onSeek) meta.onSeek(seekSec, entry);
    }, feedbackStore, {
        storage: meta.storage,
        storageKey: `sequence_spike_video_${game.id || game.name || 'default'}`,
        initialUrl: game.videoUrl || (game.metadata && game.metadata.videoUrl) || null
    });
    videoCol.append(videoCard);

    workspace.append(listCol, videoCol);
    container.append(workspace);

    function update() {
        renderCoachScoreboard(scoreboard, teams, allEntries, state, update);
        renderFilterLens(filterLensCard, teams, allEntries, state, update);
        renderEntryList(listContainer, allEntries, state, {
            feedbackStore,
            videoEl: videoCard.videoEl,
            onSelect: (entry) => {
                state.activeEntryId = entry.id;
                update();
                videoCard.seekTo(entry.seekSeconds, entry);
                if (meta.onSeek) meta.onSeek(entry.seekSeconds, entry);
            }
        });
    }

    feedbackStore.subscribe(update);
    wireFeedbackHeader(container.ownerDocument || document, feedbackStore, { gameLabel: game.name || 'Coded match' });
    update();
}

/**
 * Coach Scoreboard: Side-by-side comparative cards for CE, A25E, and Attack Threat
 */
function renderCoachScoreboard(container, teams, allEntries, state, onChange) {
    container.replaceChildren();

    const team1 = teams[0] || 'Team 1';
    const team2 = teams[1] || 'Team 2';

    const t1Entries = allEntries.filter(e => e.team === team1);
    const t2Entries = allEntries.filter(e => e.team === team2);

    const ce1 = t1Entries.filter(e => e.entryType === 'CE');
    const ce2 = t2Entries.filter(e => e.entryType === 'CE');

    const a251 = t1Entries.filter(e => e.entryType === 'A25E');
    const a252 = t2Entries.filter(e => e.entryType === 'A25E');

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-3';

    // Card 1: Circle Entries
    const isCeActive = state.entryType === 'CE';
    const totalCe = ce1.length + ce2.length;
    const ceCard = scoreboardCard({
        title: `Circle Entries (${totalCe})`,
        isActive: isCeActive,
        onClick: () => {
            state.entryType = isCeActive ? 'all' : 'CE';
            onChange();
        },
        team1,
        team2,
        val1: ce1.length,
        val2: ce2.length,
        sub1: `${ce1.filter(e => e.originType === 'Counter').length}⚡ · ${ce1.filter(e => e.originType === 'Build-Up').length}🛡️`,
        sub2: `${ce2.filter(e => e.originType === 'Counter').length}⚡ · ${ce2.filter(e => e.originType === 'Build-Up').length}🛡️`
    });

    // Card 2: 25m Entries
    const isA25Active = state.entryType === 'A25E';
    const totalA25 = a251.length + a252.length;
    const a25Card = scoreboardCard({
        title: `25m Entries (${totalA25})`,
        isActive: isA25Active,
        onClick: () => {
            state.entryType = isA25Active ? 'all' : 'A25E';
            onChange();
        },
        team1,
        team2,
        val1: a251.length,
        val2: a252.length,
        sub1: `${a251.filter(e => e.originType === 'Counter').length}⚡ · ${a251.filter(e => e.originType === 'Build-Up').length}🛡️`,
        sub2: `${a252.filter(e => e.originType === 'Counter').length}⚡ · ${a252.filter(e => e.originType === 'Build-Up').length}🛡️`
    });

    grid.append(ceCard, a25Card);
    container.append(grid);
}

function scoreboardCard({ title, isActive, onClick, team1, team2, val1, val2, sub1, sub2 }) {
    const card = document.createElement('div');
    const activeRing = isActive ? 'ring-2 ring-blue-600 bg-blue-50/30 border-blue-400' : 'hover:border-slate-300';
    card.className = `surface px-3 py-2 border rounded-lg cursor-pointer transition-all select-none ${activeRing}`;

    const total = val1 + val2;
    const p1 = total ? Math.round((val1 / total) * 100) : 50;
    const p2 = total ? 100 - p1 : 50;

    card.innerHTML = `
        <div class="flex items-center justify-between gap-1 mb-1">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 truncate">${title}</h3>
        </div>
        <div class="flex items-center justify-between gap-2 py-0.5">
            <div class="text-left flex items-baseline gap-1.5 min-w-0">
                <span class="text-xs font-semibold text-slate-700 truncate max-w-[75px]">${team1}</span>
                <span class="text-xl font-black text-slate-900 tabular-nums">${val1}</span>
                <span class="text-[10px] text-slate-500 hidden sm:inline truncate">${sub1}</span>
            </div>
            <div class="text-right flex items-baseline gap-1.5 min-w-0 justify-end">
                <span class="text-[10px] text-slate-500 hidden sm:inline truncate">${sub2}</span>
                <span class="text-xl font-black text-slate-900 tabular-nums">${val2}</span>
                <span class="text-xs font-semibold text-slate-700 truncate max-w-[75px]">${team2}</span>
            </div>
        </div>
        <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex mt-1">
            <div class="bg-blue-600 h-full" style="width: ${p1}%" title="${team1}: ${p1}%"></div>
            <div class="bg-amber-500 h-full" style="width: ${p2}%" title="${team2}: ${p2}%"></div>
        </div>
    `;

    card.addEventListener('click', onClick);
    return card;
}

/**
 * Filter Lens Bar with interactive pills
 */
function renderFilterLens(card, teams, allEntries, state, onChange) {
    card.replaceChildren();

    const isFiltered = state.team !== 'all' || state.entryType !== 'all' || state.originType !== 'all';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between pb-2 mb-2 border-b border-slate-200';
    header.innerHTML = `
        <div class="flex items-center gap-1.5">
            <i class="fas fa-filter text-slate-500 text-xs" aria-hidden="true"></i>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Filter Lens</span>
        </div>
        ${isFiltered ? '<button type="button" id="reset-filters" class="text-xs text-brand hover:underline font-semibold">Clear filters</button>' : '<span class="text-[11px] text-slate-400">Showing all</span>'}
    `;
    card.append(header);

    const resetBtn = card.querySelector('#reset-filters');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            state.team = 'all';
            state.entryType = 'all';
            state.originType = 'all';
            onChange();
        });
    }

    // Team Filter Row
    if (teams.length > 1) {
        const teamRow = document.createElement('div');
        teamRow.className = 'flex flex-wrap items-center gap-1.5 mb-2';
        teamRow.append(filterLabel('Team:'));
        teamRow.append(pill('All', state.team === 'all', () => { state.team = 'all'; onChange(); }, allEntries.length));
        teams.forEach(t => {
            const count = allEntries.filter(e => e.team === t).length;
            teamRow.append(pill(t, state.team === t, () => { state.team = t; onChange(); }, count));
        });
        card.append(teamRow);
    }

    // Entry Type Row
    const typeRow = document.createElement('div');
    typeRow.className = 'flex flex-wrap items-center gap-1.5 mb-2';
    typeRow.append(filterLabel('Entry:'));

    const ceCount = allEntries.filter(e => (state.team === 'all' || e.team === state.team) && e.entryType === 'CE').length;
    const a25Count = allEntries.filter(e => (state.team === 'all' || e.team === state.team) && e.entryType === 'A25E').length;

    typeRow.append(
        pill('All', state.entryType === 'all', () => { state.entryType = 'all'; onChange(); }, ceCount + a25Count),
        pill('Circle Entries (CE)', state.entryType === 'CE', () => { state.entryType = 'CE'; onChange(); }, ceCount),
        pill('25m Entries (A25E)', state.entryType === 'A25E', () => { state.entryType = 'A25E'; onChange(); }, a25Count)
    );
    card.append(typeRow);

    // Origin Type Row
    const originRow = document.createElement('div');
    originRow.className = 'flex flex-wrap items-center gap-1.5';
    originRow.append(filterLabel('Origin:'));

    const filteredPool = allEntries.filter(e =>
        (state.team === 'all' || e.team === state.team) &&
        (state.entryType === 'all' || e.entryType === state.entryType)
    );
    const counterCount = filteredPool.filter(e => e.originType === 'Counter').length;
    const buildUpCount = filteredPool.filter(e => e.originType === 'Build-Up').length;

    originRow.append(
        pill('All', state.originType === 'all', () => { state.originType = 'all'; onChange(); }, filteredPool.length),
        pill('⚡ Counter', state.originType === 'Counter', () => { state.originType = 'Counter'; onChange(); }, counterCount, 'amber'),
        pill('🛡️ Build-Up', state.originType === 'Build-Up', () => { state.originType = 'Build-Up'; onChange(); }, buildUpCount, 'blue')
    );
    card.append(originRow);
}

function filterLabel(text) {
    const span = document.createElement('span');
    span.className = 'text-xs font-semibold text-slate-500 w-12';
    span.textContent = text;
    return span;
}

function pill(label, isActive, onClick, count = null, color = null) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const baseClass = 'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border select-none inline-flex items-center gap-1';
    let stateClass = 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';

    if (isActive) {
        if (color === 'amber') {
            stateClass = 'bg-amber-100 text-amber-900 border-amber-300 font-semibold shadow-sm';
        } else if (color === 'blue') {
            stateClass = 'bg-blue-100 text-blue-900 border-blue-300 font-semibold shadow-sm';
        } else {
            stateClass = 'bg-slate-900 text-white border-slate-900 font-semibold shadow-sm';
        }
    }

    btn.className = `${baseClass} ${stateClass}`;
    btn.innerHTML = `${label}${count != null ? `<span class="opacity-70 text-[11px] tabular-nums">(${count})</span>` : ''}`;
    btn.addEventListener('click', onClick);
    return btn;
}

function renderVideoCard(onSeek, feedbackStore, options = {}) {
    const card = document.createElement('div');
    card.id = 'sequence-video-card';
    card.className = 'surface p-2.5 border rounded-lg flex flex-col gap-1.5';

    let currentEntry = null;

    const fileInput = document.createElement('input');
    fileInput.id = 'video-file-input';
    fileInput.type = 'file';
    fileInput.accept = 'video/*';
    fileInput.className = 'hidden';

    const videoEl = document.createElement('video');
    videoEl.className = 'w-full max-h-[60vh] aspect-video bg-black rounded border border-slate-800 object-contain shadow-inner';
    videoEl.controls = true;
    videoEl.playsInline = true;

    const header = createVideoHeader(
        () => fileInput.click(),
        () => toggleUrlBar(card),
        () => clearVideo(videoEl, card, options)
    );
    const urlBar = createVideoUrlBar((url) => setVideoUrl(url, videoEl, card, options), () => toggleUrlBar(card, false));
    const controlsRow = createVideoControlsRow(videoEl, feedbackStore, () => currentEntry);

    wireFileInput(fileInput, videoEl, card);
    card.append(header, urlBar, fileInput, videoEl, controlsRow);
    restoreInitialVideo(videoEl, card, options);

    card.videoEl = videoEl;
    card.seekTo = (seconds, entry) => {
        currentEntry = entry;
        controlsRow.updateFlag();
        seekVideo(videoEl, seconds);
    };

    return card;
}

function createVideoHeader(onFileClick, onUrlToggle, onClear) {
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between pb-1.5 border-b border-slate-200 text-xs';
    header.innerHTML = `
        <div class="flex items-center gap-1.5 min-w-0">
            <i class="fas fa-video text-slate-500 text-xs" aria-hidden="true"></i>
            <span class="font-bold uppercase tracking-wider text-slate-700">Video</span>
            <span id="video-filename" class="text-muted truncate max-w-[180px]" title="No video attached">No video attached</span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0" id="video-source-actions">
            <button type="button" id="btn-attach-file" class="btn btn-secondary btn-compact text-[11px] px-2" title="Attach local video file from disk">
                <i class="fas fa-folder-open mr-1 text-[10px]" aria-hidden="true"></i>Disk
            </button>
            <button type="button" id="btn-toggle-url" class="btn btn-secondary btn-compact text-[11px] px-2" title="Load video from cloud URL">
                <i class="fas fa-cloud mr-1 text-[10px]" aria-hidden="true"></i>Cloud URL
            </button>
            <button type="button" id="btn-clear-video" class="btn btn-ghost btn-compact text-xs text-slate-400 hover:text-rose-600 px-1.5 hidden" title="Detach video">
                <i class="fas fa-times text-xs" aria-hidden="true"></i>
            </button>
        </div>
    `;
    wireVideoHeaderEvents(header, onFileClick, onUrlToggle, onClear);
    return header;
}

function wireVideoHeaderEvents(header, onFileClick, onUrlToggle, onClear) {
    header.querySelector('#btn-attach-file').addEventListener('click', onFileClick);
    header.querySelector('#btn-toggle-url').addEventListener('click', onUrlToggle);
    header.querySelector('#btn-clear-video').addEventListener('click', onClear);
}

function updateVideoLoadedState(card, isLoaded) {
    const clearBtn = card.querySelector('#btn-clear-video');
    if (clearBtn) {
        clearBtn.classList.toggle('hidden', !isLoaded);
    }
}

function clearVideo(videoEl, card, options = {}) {
    videoEl.removeAttribute('src');
    videoEl.load();
    const nameEl = card.querySelector('#video-filename');
    if (nameEl) {
        nameEl.textContent = 'No video attached';
        nameEl.title = 'No video attached';
        nameEl.className = 'text-muted truncate max-w-[180px]';
    }
    updateVideoLoadedState(card, false);
    toggleUrlBar(card, false);
    if (options.storage && options.storageKey) {
        try { options.storage.removeItem(options.storageKey); } catch {}
    }
}

function createVideoUrlBar(onLoad, onCancel) {
    const bar = document.createElement('div');
    bar.id = 'video-url-bar';
    bar.className = 'hidden p-1.5 bg-slate-50 border border-slate-200 rounded flex items-center gap-1.5 text-xs';
    bar.innerHTML = `
        <i class="fas fa-link text-slate-400 text-xs ml-1" aria-hidden="true"></i>
        <input type="url" id="video-url-input" placeholder="Enter video stream URL (https://...)" class="input input-sm border rounded flex-1 px-2 py-0.5 text-xs bg-white">
        <button type="button" id="btn-load-url" class="btn btn-primary btn-compact text-xs font-semibold">Load</button>
        <button type="button" id="btn-cancel-url" class="btn btn-ghost btn-compact text-xs text-slate-500">✕</button>
    `;
    const input = bar.querySelector('#video-url-input');
    const submit = () => {
        if (input.value && input.value.trim()) onLoad(input.value.trim());
    };
    bar.querySelector('#btn-load-url').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    bar.querySelector('#btn-cancel-url').addEventListener('click', onCancel);
    return bar;
}

function toggleUrlBar(card, forceState) {
    const bar = card.querySelector('#video-url-bar');
    if (!bar) return;
    const shouldShow = forceState != null ? Boolean(forceState) : bar.classList.contains('hidden');
    bar.classList.toggle('hidden', !shouldShow);
    if (shouldShow) {
        const input = bar.querySelector('#video-url-input');
        if (input) setTimeout(() => input.focus(), 50);
    }
}

function setVideoUrl(url, videoEl, card, options) {
    try {
        const clean = url.trim();
        videoEl.src = clean;
        const nameEl = card.querySelector('#video-filename');
        if (nameEl) {
            const short = clean.split('/').pop().split('?')[0] || clean;
            nameEl.textContent = `cloud: ${short}`;
            nameEl.title = clean;
            nameEl.className = 'text-blue-700 font-medium truncate max-w-[180px]';
        }
        updateVideoLoadedState(card, true);
        toggleUrlBar(card, false);
        if (options.storage && options.storageKey) {
            try { options.storage.setItem(options.storageKey, clean); } catch {}
        }
        safePlay(videoEl);
    } catch {}
}

function wireFileInput(fileInput, videoEl, card) {
    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (file) {
            videoEl.src = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';
            const nameEl = card.querySelector('#video-filename');
            if (nameEl) {
                nameEl.textContent = file.name;
                nameEl.title = `Local file: ${file.name}`;
                nameEl.className = 'text-slate-800 font-medium truncate max-w-[180px]';
            }
            updateVideoLoadedState(card, true);
            toggleUrlBar(card, false);
            safePlay(videoEl);
        }
    });
}

function restoreInitialVideo(videoEl, card, options) {
    const initialUrl = options.initialUrl || (options.storage && options.storageKey ? options.storage.getItem(options.storageKey) : null);
    if (initialUrl) {
        setVideoUrl(initialUrl, videoEl, card, options);
    }
}

function createVideoControlsRow(videoEl, feedbackStore, getEntry) {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-100 text-xs';
    row.innerHTML = `
        <div class="flex items-center gap-1">
            <button type="button" class="btn btn-secondary btn-compact px-2" id="replay-btn" title="Replay current sequence">
                <i class="fas fa-rotate-left text-xs mr-1" aria-hidden="true"></i>Replay
            </button>
            <button type="button" class="btn btn-secondary btn-compact px-1.5" id="back-5s" title="Back 5s">-5s</button>
            <button type="button" class="btn btn-secondary btn-compact px-1.5" id="fwd-5s" title="Forward 5s">+5s</button>
            <button type="button" class="btn btn-secondary btn-compact px-2 flex items-center gap-1" id="video-flag-btn" title="Flag this clip for review" disabled>
                <i class="fas fa-flag text-xs" aria-hidden="true"></i><span id="video-flag-text">Flag</span>
            </button>
        </div>
        <div class="flex items-center gap-2">
            <div class="segmented segmented-compact" role="group">
                <button type="button" class="is-active" data-speed="1">1x</button>
                <button type="button" data-speed="1.5">1.5x</button>
                <button type="button" data-speed="2">2x</button>
            </div>
        </div>
    `;

    wirePlaybackButtons(row, videoEl, getEntry);
    wireFlagButton(row, videoEl, feedbackStore, getEntry);
    wireSpeedButtons(row, videoEl);

    row.updateFlag = () => updateFlagButton(row, feedbackStore, getEntry());
    return row;
}

function wirePlaybackButtons(row, videoEl, getEntry) {
    row.querySelector('#replay-btn').addEventListener('click', () => {
        const entry = getEntry();
        if (entry) {
            videoEl.currentTime = entry.seekSeconds;
            safePlay(videoEl);
        }
    });
    row.querySelector('#back-5s').addEventListener('click', () => {
        videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
    });
    row.querySelector('#fwd-5s').addEventListener('click', () => {
        videoEl.currentTime = Math.min(videoEl.duration || 999999, videoEl.currentTime + 5);
    });
}

function wireFlagButton(row, videoEl, feedbackStore, getEntry) {
    const flagBtn = row.querySelector('#video-flag-btn');
    if (flagBtn) {
        flagBtn.addEventListener('click', () => {
            const entry = getEntry();
            if (entry && feedbackStore) {
                openFeedbackModal(row.ownerDocument || document, entry, videoEl, feedbackStore);
            }
        });
    }
}

function updateFlagButton(row, feedbackStore, currentEntry) {
    const flagBtn = row.querySelector('#video-flag-btn');
    if (!flagBtn) return;
    if (!currentEntry) {
        flagBtn.disabled = true;
        return;
    }
    flagBtn.disabled = false;
    const isFlagged = feedbackStore && feedbackStore.has(currentEntry.id);
    const textSpan = flagBtn.querySelector('#video-flag-text');
    if (textSpan) textSpan.textContent = isFlagged ? 'Flagged' : 'Flag';
    if (isFlagged) {
        flagBtn.classList.add('bg-amber-100', 'text-amber-900', 'border-amber-300');
    } else {
        flagBtn.classList.remove('bg-amber-100', 'text-amber-900', 'border-amber-300');
    }
}

function wireSpeedButtons(row, videoEl) {
    row.querySelectorAll('[data-speed]').forEach(btn => {
        btn.addEventListener('click', () => {
            row.querySelectorAll('[data-speed]').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            videoEl.playbackRate = Number(btn.getAttribute('data-speed')) || 1;
        });
    });
}

function safePlay(videoEl) {
    try {
        const playPromise = videoEl.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
    } catch {}
}

function seekVideo(videoEl, seconds) {
    videoEl.currentTime = Math.max(0, seconds);
    safePlay(videoEl);
}

function renderEntryList(container, allEntries, state, options = {}) {
    const onSelect = typeof options === 'function' ? options : options.onSelect;
    const feedbackStore = options?.feedbackStore;
    const videoEl = options?.videoEl;
    container.replaceChildren();

    const filtered = allEntries.filter(entry => {
        if (state.team !== 'all' && entry.team !== state.team) return false;
        if (state.entryType !== 'all' && entry.entryType !== state.entryType) return false;
        if (state.originType !== 'all' && entry.originType !== state.originType) return false;
        return true;
    });

    if (!filtered.length) {
        const empty = document.createElement('div');
        empty.className = 'surface surface-padded text-center py-8 text-muted border rounded-lg';
        empty.innerHTML = allEntries.length
            ? `
            <i class="fas fa-filter text-2xl mb-2 opacity-50" aria-hidden="true"></i>
            <p class="font-medium text-slate-700">No matching entries</p>
            <p class="text-xs">Try clearing or adjusting the filter lens above.</p>
        `
            : `
            <p class="font-medium text-slate-700">No attacking entries</p>
            <p class="text-xs">This match has no circle or 25m entries.</p>
        `;
        container.append(empty);
        return;
    }

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between text-xs text-slate-500 px-1';
    header.innerHTML = `
        <span class="font-semibold uppercase tracking-wider">Showing ${filtered.length} of ${allEntries.length} entries</span>
        <span>Click row to seek video</span>
    `;
    container.append(header);

    filtered.forEach(entry => {
        container.append(createEntryRow(entry, state, { onSelect, feedbackStore, videoEl }));
    });
}

function createEntryRow(entry, state, options) {
    const isSelected = entry.id === state.activeEntryId;
    const isCounter = entry.originType === 'Counter';
    const isFlagged = options.feedbackStore ? options.feedbackStore.has(entry.id) : false;

    const row = document.createElement('div');
    row.className = `entry-row surface px-3 py-2 border rounded-lg cursor-pointer transition-all ${getEntryRowBorder(isSelected)}`;
    row.innerHTML = getEntryRowHtml(entry, isCounter, isFlagged);

    const flagBtn = row.querySelector('.btn-flag');
    if (flagBtn && options.feedbackStore) {
        flagBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openFeedbackModal(row.ownerDocument || document, entry, options.videoEl, options.feedbackStore);
        });
    }

    row.addEventListener('click', () => {
        if (options.onSelect) options.onSelect(entry);
    });
    return row;
}

function getEntryRowBorder(isSelected) {
    return isSelected ? 'ring-2 ring-blue-500 bg-blue-50/40' : 'hover:border-slate-300 hover:bg-slate-50/70';
}

function getEntryRowHtml(entry, isCounter, isFlagged) {
    const badgeClass = isCounter ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-100 text-blue-900 border-blue-300';
    const badgeIcon = isCounter ? '⚡ Counter' : '🛡️ Build-Up';
    const clockText = entry.quarter ? `${entry.quarter} ${entry.matchClock}` : `match ${entry.matchClock}`;
    const showVideoOffset = entry.videoTime && entry.videoTime !== entry.matchClock;
    const videoOffsetHtml = showVideoOffset ? `<span class="text-xs text-slate-400 tabular-nums hidden sm:inline">(video ${entry.videoTime})</span>` : '';
    const flagClass = isFlagged ? 'text-amber-600 bg-amber-100 border border-amber-300 font-semibold' : 'text-slate-400 hover:text-amber-600';

    const seekTime = formatClock(entry.seekSeconds * 1000);
    const eventSeconds = Math.round(entry.timeMs / 1000);
    const leadDiff = eventSeconds - entry.seekSeconds;
    const leadText = leadDiff > 0 ? `Starts ${seekTime} (-${leadDiff}s)` : `Starts ${seekTime}`;

    return `
        <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
                <span class="px-2 py-0.5 rounded text-[11px] font-bold border ${badgeClass}">
                    ${badgeIcon}
                </span>
                <strong class="text-sm text-slate-900 font-semibold">${entry.team} ${entry.entryType}</strong>
                <span class="text-xs text-slate-500 tabular-nums">· ${clockText}</span>
                ${videoOffsetHtml}
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <span class="text-xs text-slate-500 tabular-nums">${leadText}</span>
                <button type="button" class="btn-flag btn btn-ghost btn-compact text-xs px-2 ${flagClass}" title="${isFlagged ? 'Flagged (click to edit)' : 'Flag for review'}">
                    <i class="fas fa-flag text-[11px]" aria-hidden="true"></i>${isFlagged ? '<span class="ml-1 text-[11px]">Flagged</span>' : ''}
                </button>
            </div>
        </div>
        <div class="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] truncate max-w-full">
                ${entryCodes(entry)}
            </div>
            <div class="text-slate-500 text-[11px] flex-shrink-0">
                ${entry.reason}
            </div>
        </div>
    `;
}
