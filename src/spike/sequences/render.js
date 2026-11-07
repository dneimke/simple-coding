/**
 * Renders attacking entry (A25E and CE) Counter vs Build-Up results
 * with KPI metric tiles, interactive filter pills, and compact seekable rows.
 */

import { entryCodes, entryDetail, formatClock } from './copy.js';

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
    const { stats } = result;

    const state = {
        team: 'all',
        entryType: 'all',
        originType: 'all',
        activeEntryId: allEntries[0]?.id || null
    };

    const teams = [...new Set(allEntries.map(e => e.team))].filter(Boolean);

    container.replaceChildren();

    // Top: KPI Cards
    const kpiSection = renderKpis(stats);
    container.append(kpiSection);

    // Two-column workspace: Sticky Video Player (left) + Filter & Entry Table (right)
    const workspace = document.createElement('div');
    workspace.className = 'grid grid-cols-1 lg:grid-cols-12 gap-4 items-start';

    // Left Column: Sticky Video player
    const videoCol = document.createElement('div');
    videoCol.className = 'lg:col-span-5 lg:sticky lg:top-4 z-10 flex flex-col gap-2';
    const videoCard = renderVideoCard((seekSec, entry) => {
        if (meta.onSeek) meta.onSeek(seekSec, entry);
    });
    videoCol.append(videoCard);

    // Right Column: Filters + Entry Rows
    const listCol = document.createElement('div');
    listCol.className = 'lg:col-span-7 flex flex-col gap-3 min-w-0';

    const filterCard = document.createElement('div');
    filterCard.className = 'surface surface-padded';

    const listContainer = document.createElement('div');
    listContainer.className = 'flex flex-col gap-2';

    function update() {
        renderFilterControls(filterCard, teams, allEntries, state, () => {
            update();
        });
        renderEntryList(listContainer, allEntries, state, (entry) => {
            state.activeEntryId = entry.id;
            update();
            videoCard.seekTo(entry.seekSeconds, entry);
            if (meta.onSeek) meta.onSeek(entry.seekSeconds, entry);
        });
    }

    listCol.append(filterCard, listContainer);
    workspace.append(videoCol, listCol);
    container.append(workspace);

    update();
}

function renderKpis(stats) {
    const kpiWrap = document.createElement('div');
    kpiWrap.className = 'grid grid-cols-2 md:grid-cols-4 gap-3 mb-4';

    const ce = stats.circleEntries || { total: 0, counter: 0, buildUp: 0 };
    const a25 = stats.a25Entries || { total: 0, counter: 0, buildUp: 0 };
    const totalEntries = ce.total + a25.total;
    const totalCounter = ce.counter + a25.counter;
    const totalBuildUp = ce.buildUp + a25.buildUp;

    kpiWrap.append(
        kpiTile('Attacking Entries', totalEntries, `${totalCounter} Counter · ${totalBuildUp} Build-Up`, 'bg-blue-50 border-blue-200 text-blue-950'),
        kpiTile('Circle Entries (CE)', ce.total, `${ce.counter} Counter (${percent(ce.counter, ce.total)}) · ${ce.buildUp} Build-Up`, 'bg-emerald-50 border-emerald-200 text-emerald-950'),
        kpiTile('25m Entries (A25E)', a25.total, `${a25.counter} Counter (${percent(a25.counter, a25.total)}) · ${a25.buildUp} Build-Up`, 'bg-purple-50 border-purple-200 text-purple-950'),
        kpiTile('Counter Threat', percent(totalCounter, totalEntries), `${totalCounter} rapid breaks in 10s`, 'bg-amber-50 border-amber-200 text-amber-950')
    );

    return kpiWrap;
}

function kpiTile(title, value, subtitle, accentClasses) {
    const tile = document.createElement('div');
    tile.className = `surface p-3 border rounded-lg ${accentClasses}`;
    tile.innerHTML = `
        <div class="text-xs font-semibold uppercase tracking-wider opacity-75">${title}</div>
        <div class="text-2xl font-bold my-0.5 tabular-nums">${value}</div>
        <div class="text-xs opacity-80 truncate">${subtitle}</div>
    `;
    return tile;
}

function renderVideoCard(onSeek) {
    const card = document.createElement('div');
    card.className = 'surface surface-padded';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between pb-2 mb-2 border-b border-slate-200';
    header.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas fa-video text-slate-500 text-sm" aria-hidden="true"></i>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Match Video</span>
        </div>
        <span id="video-filename" class="text-xs text-muted truncate max-w-[160px]">No video attached</span>
    `;

    const videoEl = document.createElement('video');
    videoEl.className = 'w-full aspect-video bg-black rounded border border-slate-800 object-contain';
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

function renderFilterControls(card, teams, allEntries, state, onChange) {
    card.replaceChildren();

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between pb-2 mb-2 border-b border-slate-200';
    header.innerHTML = `
        <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Filter Entries</span>
        <button type="button" id="reset-filters" class="text-xs text-brand hover:underline font-medium">Reset all</button>
    `;
    card.append(header);

    card.querySelector('#reset-filters').addEventListener('click', () => {
        state.team = 'all';
        state.entryType = 'all';
        state.originType = 'all';
        onChange();
    });

    // Filter Group 1: Teams
    if (teams.length > 1) {
        const teamRow = document.createElement('div');
        teamRow.className = 'flex flex-wrap items-center gap-1.5 mb-2';
        teamRow.append(filterLabel('Team:'));

        const allCount = allEntries.length;
        teamRow.append(pill('All', state.team === 'all', () => { state.team = 'all'; onChange(); }, allCount));

        teams.forEach(t => {
            const count = allEntries.filter(e => e.team === t).length;
            teamRow.append(pill(t, state.team === t, () => { state.team = t; onChange(); }, count));
        });
        card.append(teamRow);
    }

    // Filter Group 2: Entry Type (CE vs A25E)
    const typeRow = document.createElement('div');
    typeRow.className = 'flex flex-wrap items-center gap-1.5 mb-2';
    typeRow.append(filterLabel('Entry:'));

    const ceCount = allEntries.filter(e => (state.team === 'all' || e.team === state.team) && e.entryType === 'CE').length;
    const a25Count = allEntries.filter(e => (state.team === 'all' || e.team === state.team) && e.entryType === 'A25E').length;
    const typeTotal = ceCount + a25Count;

    typeRow.append(
        pill('All', state.entryType === 'all', () => { state.entryType = 'all'; onChange(); }, typeTotal),
        pill('Circle Entries (CE)', state.entryType === 'CE', () => { state.entryType = 'CE'; onChange(); }, ceCount),
        pill('25m Entries (A25E)', state.entryType === 'A25E', () => { state.entryType = 'A25E'; onChange(); }, a25Count)
    );
    card.append(typeRow);

    // Filter Group 3: Origin (Counter vs Build-Up)
    const originRow = document.createElement('div');
    originRow.className = 'flex flex-wrap items-center gap-1.5';
    originRow.append(filterLabel('Origin:'));

    const filteredForOrigin = allEntries.filter(e =>
        (state.team === 'all' || e.team === state.team) &&
        (state.entryType === 'all' || e.entryType === state.entryType)
    );
    const counterCount = filteredForOrigin.filter(e => e.originType === 'Counter').length;
    const buildUpCount = filteredForOrigin.filter(e => e.originType === 'Build-Up').length;

    originRow.append(
        pill('All', state.originType === 'all', () => { state.originType = 'all'; onChange(); }, filteredForOrigin.length),
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
        empty.className = 'surface surface-padded text-center py-8 text-muted';
        empty.innerHTML = `
            <i class="fas fa-filter text-2xl mb-2 opacity-50" aria-hidden="true"></i>
            <p class="font-medium text-slate-700">No matching entries</p>
            <p class="text-xs">Try adjusting the filter pills above.</p>
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
