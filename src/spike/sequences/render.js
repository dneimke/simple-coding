/**
 * Renders attacking entry (A25E and CE) Counter vs Build-Up results
 * with a Coach Match Scoreboard, integrated 1-click filter lenses, and compact seekable rows.
 */

import { entryCodes, formatClock } from './copy.js';

/**
 * @typedef {Object} FilterState
 * @property {string} team - 'all' or team name
 * @property {string} entryType - 'all', 'CE', or 'A25E'
 * @property {string} originType - 'all', 'Counter', or 'Build-Up'
 * @property {string} [activeEntryId]
 */

/**
 * @param {HTMLElement} container
 * @param {{ name: string, timeSource: string }} game
 * @param {{ entries: Array<object>, stats: object }} result
 * @param {{ mutated?: boolean, onSeek?: (seconds: number, entry: object) => void }} [meta]
 */
export function renderReport(container, game, result, meta = {}) {
    const allEntries = result.entries || result.sequences || [];
    const teams = [...new Set(allEntries.map(e => e.team))].filter(Boolean);

    const state = {
        team: 'all',
        entryType: 'all',
        originType: 'all',
        activeEntryId: allEntries[0]?.id || null
    };

    container.replaceChildren();

    // Top: Coach Match Scoreboard
    const scoreboard = document.createElement('div');
    scoreboard.className = 'mb-4';
    container.append(scoreboard);

    // Two-column workspace: Entries List (left, 5 cols) + Large Sticky Video Player (right, 7 cols)
    const workspace = document.createElement('div');
    workspace.className = 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start';

    // Left Column: Filter Lens Header + Entry Rows (5 cols)
    const listCol = document.createElement('div');
    listCol.className = 'lg:col-span-5 flex flex-col gap-3 min-w-0 order-2 lg:order-1';

    const filterLensCard = document.createElement('div');
    filterLensCard.className = 'surface surface-padded border rounded-lg';

    const listContainer = document.createElement('div');
    listContainer.className = 'flex flex-col gap-2';

    listCol.append(filterLensCard, listContainer);

    // Right Column: Large Sticky Video player (7 cols)
    const videoCol = document.createElement('div');
    videoCol.className = 'lg:col-span-7 lg:sticky lg:top-4 z-10 flex flex-col gap-2 order-1 lg:order-2';
    const videoCard = renderVideoCard((seekSec, entry) => {
        if (meta.onSeek) meta.onSeek(seekSec, entry);
    });
    videoCol.append(videoCard);

    workspace.append(listCol, videoCol);
    container.append(workspace);

    function update() {
        renderCoachScoreboard(scoreboard, teams, allEntries, state, update);
        renderFilterLens(filterLensCard, teams, allEntries, state, update);
        renderEntryList(listContainer, allEntries, state, (entry) => {
            state.activeEntryId = entry.id;
            update();
            videoCard.seekTo(entry.seekSeconds, entry);
            if (meta.onSeek) meta.onSeek(entry.seekSeconds, entry);
        });
    }

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

    const counter1 = t1Entries.filter(e => e.originType === 'Counter');
    const counter2 = t2Entries.filter(e => e.originType === 'Counter');

    const totalCounter = counter1.length + counter2.length;
    const totalEntries = allEntries.length;

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-3 gap-3';

    // Card 1: Circle Entries (CE) — Danger & Penetration
    const isCeActive = state.entryType === 'CE';
    const ceCard = scoreboardCard({
        title: 'Circle Entries (CE)',
        subtitle: 'D-Penetration & Danger',
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
        sub2: `${ce2.filter(e => e.originType === 'Counter').length}⚡ · ${ce2.filter(e => e.originType === 'Build-Up').length}🛡️`,
        badgeText: `${ce1.length + ce2.length} Total CE`,
        badgeColor: 'border-emerald-300 bg-emerald-50 text-emerald-900'
    });

    // Card 2: 25m Entries (A25E) — Midfield Control & Territory
    const isA25Active = state.entryType === 'A25E';
    const a25Card = scoreboardCard({
        title: '25m Entries (A25E)',
        subtitle: 'Territory & Midfield Control',
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
        sub2: `${a252.filter(e => e.originType === 'Counter').length}⚡ · ${a252.filter(e => e.originType === 'Build-Up').length}🛡️`,
        badgeText: `${a251.length + a252.length} Total 25m`,
        badgeColor: 'border-slate-300 bg-slate-100 text-slate-800'
    });

    // Card 3: Attack Origin (Counter vs Build-Up)
    const isCounterActive = state.originType === 'Counter';
    const originCard = scoreboardCard({
        title: 'Attack Origins',
        subtitle: '⚡ Counter (<10s) vs 🛡️ Build-Up',
        isActive: isCounterActive,
        onClick: () => {
            state.originType = isCounterActive ? 'all' : 'Counter';
            onChange();
        },
        team1,
        team2,
        val1: counter1.length,
        val2: counter2.length,
        sub1: `${t1Entries.length - counter1.length} Build-Up`,
        sub2: `${t2Entries.length - counter2.length} Build-Up`,
        badgeText: `${totalCounter} Counter (${percent(totalCounter, totalEntries)})`,
        badgeColor: 'border-amber-300 bg-amber-50 text-amber-900'
    });

    grid.append(ceCard, a25Card, originCard);
    container.append(grid);
}

function scoreboardCard({ title, subtitle, isActive, onClick, team1, team2, val1, val2, sub1, sub2, badgeText, badgeColor }) {
    const card = document.createElement('div');
    const activeRing = isActive ? 'ring-2 ring-blue-600 bg-blue-50/20' : 'hover:border-slate-300';
    card.className = `surface p-3.5 border rounded-lg cursor-pointer transition-all select-none ${activeRing}`;

    const total = val1 + val2;
    const p1 = total ? Math.round((val1 / total) * 100) : 50;
    const p2 = total ? 100 - p1 : 50;

    card.innerHTML = `
        <div class="flex items-center justify-between gap-1 mb-2">
            <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800">${title}</h3>
                <p class="text-[11px] text-slate-500">${subtitle}</p>
            </div>
            <span class="text-[11px] px-2 py-0.5 rounded font-bold border ${badgeColor}">${badgeText}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 my-2 py-1 border-y border-slate-100">
            <div class="text-left">
                <div class="text-xs font-semibold text-slate-600 truncate">${team1}</div>
                <div class="text-2xl font-black text-slate-900 tabular-nums">${val1}</div>
                <div class="text-[11px] text-slate-500 truncate">${sub1}</div>
            </div>
            <div class="text-right">
                <div class="text-xs font-semibold text-slate-600 truncate">${team2}</div>
                <div class="text-2xl font-black text-slate-900 tabular-nums">${val2}</div>
                <div class="text-[11px] text-slate-500 truncate">${sub2}</div>
            </div>
        </div>
        <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex mt-2">
            <div class="bg-blue-600 h-full" style="width: ${p1}%" title="${team1}: ${p1}%"></div>
            <div class="bg-amber-500 h-full" style="width: ${p2}%" title="${team2}: ${p2}%"></div>
        </div>
        <div class="mt-2 text-[11px] text-blue-700 font-medium text-right flex items-center justify-end gap-1">
            <span>${isActive ? 'Active filter' : 'Filter by this'}</span>
            <i class="fas fa-arrow-right text-[10px]" aria-hidden="true"></i>
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

function renderVideoCard(onSeek) {
    const card = document.createElement('div');
    card.className = 'surface surface-padded border rounded-lg';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between pb-2 mb-2 border-b border-slate-200';
    header.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas fa-video text-slate-500 text-sm" aria-hidden="true"></i>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Match Video</span>
        </div>
        <span id="video-filename" class="text-xs text-muted truncate max-w-[200px]">No video attached</span>
    `;

    const videoEl = document.createElement('video');
    videoEl.className = 'w-full aspect-video bg-black rounded border border-slate-800 object-contain shadow-inner';
    videoEl.controls = true;
    videoEl.playsInline = true;

    const attachRow = document.createElement('div');
    attachRow.className = 'mt-2 flex items-center justify-between gap-2';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/*';
    fileInput.className = 'hidden';

    const attachBtn = document.createElement('button');
    attachBtn.type = 'button';
    attachBtn.className = 'btn btn-secondary btn-compact';
    attachBtn.innerHTML = '<i class="fas fa-paperclip text-xs mr-1" aria-hidden="true"></i>Attach MP4';
    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            videoEl.src = url;
            const nameEl = card.querySelector('#video-filename');
            if (nameEl) nameEl.textContent = file.name;
            videoEl.play().catch(() => {});
        }
    });

    const activeInfo = document.createElement('div');
    activeInfo.id = 'active-entry-info';
    activeInfo.className = 'text-xs text-slate-600 truncate flex-1 text-right';
    activeInfo.textContent = 'Click an entry to seek';

    attachRow.append(attachBtn, fileInput, activeInfo);

    // Quick replay controls
    const controlsRow = document.createElement('div');
    controlsRow.className = 'mt-2 flex items-center justify-between gap-1 pt-2 border-t border-slate-100';
    controlsRow.innerHTML = `
        <div class="flex items-center gap-1">
            <button type="button" class="btn btn-secondary btn-compact px-2" id="replay-btn" title="Replay current sequence">
                <i class="fas fa-rotate-left text-xs mr-1" aria-hidden="true"></i>Replay
            </button>
            <button type="button" class="btn btn-secondary btn-compact px-2" id="back-5s" title="Back 5s">
                -5s
            </button>
            <button type="button" class="btn btn-secondary btn-compact px-2" id="fwd-5s" title="Forward 5s">
                +5s
            </button>
        </div>
        <div class="segmented segmented-compact" role="group">
            <button type="button" class="is-active" data-speed="1">1x</button>
            <button type="button" data-speed="1.5">1.5x</button>
            <button type="button" data-speed="2">2x</button>
        </div>
    `;

    let currentEntry = null;

    controlsRow.querySelector('#replay-btn').addEventListener('click', () => {
        if (currentEntry) {
            videoEl.currentTime = currentEntry.seekSeconds;
            videoEl.play().catch(() => {});
        }
    });
    controlsRow.querySelector('#back-5s').addEventListener('click', () => {
        videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
    });
    controlsRow.querySelector('#fwd-5s').addEventListener('click', () => {
        videoEl.currentTime = Math.min(videoEl.duration || 999999, videoEl.currentTime + 5);
    });

    controlsRow.querySelectorAll('[data-speed]').forEach(btn => {
        btn.addEventListener('click', () => {
            controlsRow.querySelectorAll('[data-speed]').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            videoEl.playbackRate = Number(btn.getAttribute('data-speed')) || 1;
        });
    });

    card.append(header, videoEl, attachRow, controlsRow);

    card.seekTo = (seconds, entry) => {
        currentEntry = entry;
        videoEl.currentTime = Math.max(0, seconds);
        try {
            const playPromise = videoEl.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        } catch {}
        const info = card.querySelector('#active-entry-info');
        if (info && entry) {
            info.innerHTML = `<strong>${entry.originType}</strong> · ${entry.team} ${entry.entryType} at ${entry.videoTime}`;
        }
    };

    return card;
}

function renderEntryList(container, allEntries, state, onSelect) {
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
        empty.innerHTML = `
            <i class="fas fa-filter text-2xl mb-2 opacity-50" aria-hidden="true"></i>
            <p class="font-medium text-slate-700">No matching entries</p>
            <p class="text-xs">Try clearing or adjusting the filter lens above.</p>
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
        const row = document.createElement('div');
        const isSelected = entry.id === state.activeEntryId;
        const isCounter = entry.originType === 'Counter';

        const borderClass = isSelected
            ? 'ring-2 ring-blue-500 bg-blue-50/40'
            : 'hover:border-slate-300 hover:bg-slate-50/70';

        row.className = `entry-row surface px-3 py-2.5 border rounded-lg cursor-pointer transition-all ${borderClass}`;

        const badgeClass = isCounter
            ? 'bg-amber-100 text-amber-900 border-amber-300'
            : 'bg-blue-100 text-blue-900 border-blue-300';

        const badgeIcon = isCounter ? '⚡ Counter' : '🛡️ Build-Up';
        const clockText = entry.quarter ? `${entry.quarter} ${entry.matchClock}` : `match ${entry.matchClock}`;

        row.innerHTML = `
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="px-2 py-0.5 rounded text-[11px] font-bold border ${badgeClass}">
                        ${badgeIcon}
                    </span>
                    <strong class="text-sm text-slate-900 font-semibold">${entry.team} ${entry.entryType}</strong>
                    <span class="text-xs text-slate-500 tabular-nums">· ${clockText}</span>
                    <span class="text-xs text-slate-400 tabular-nums hidden sm:inline">(video ${entry.videoTime})</span>
                </div>
                <button type="button" class="btn btn-ghost btn-compact text-xs text-brand font-semibold flex items-center gap-1 flex-shrink-0" title="Play from start of play">
                    <i class="fas fa-play text-[10px]" aria-hidden="true"></i>Seek ${formatClock(entry.seekSeconds * 1000)}
                </button>
            </div>
            <div class="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div class="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] truncate max-w-full">
                    ${entryCodes(entry)}
                </div>
                <div class="text-slate-500 text-[11px] flex-shrink-0">
                    ${entry.reason}
                </div>
            </div>
        `;

        row.addEventListener('click', () => onSelect(entry));
        container.append(row);
    });
}

function percent(part, total) {
    if (!total) return '0%';
    return `${Math.round((part / total) * 100)}%`;
}
