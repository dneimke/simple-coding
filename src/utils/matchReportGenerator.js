/**
 * Match Report Generator for Field Hockey Event Tracker.
 * Transforms Sportscode XML or logged game events into an executive match analytics dossier.
 * Fully client-side, zero external dependencies, Sportscode XML fidelity.
 */

import { parseXmlToEvents } from './xmlUtils.js';

const STRUCTURAL_CODES = new Set(['Q1', 'Q2', 'Q3', 'Q4', 'PERIOD1', 'PERIOD2', 'UMP', 'UMPIRE', 'TIMEOUT', 'HALF', 'HALFTIME', 'MATCH']);

const KPI_TYPES = ['GOAL', 'SHOT', 'PC', 'CE', 'A25E', 'BW', 'BS1', 'BS4', 'CARD'];

function extractFallbackTeamCodes(fallbackTeams) {
    if (Array.isArray(fallbackTeams) && fallbackTeams.length >= 2) {
        return fallbackTeams
            .slice(0, 2)
            .map(t => (typeof t === 'object' ? t.code : String(t)).trim().toUpperCase())
            .filter(Boolean);
    }
    if (typeof fallbackTeams === 'string' && fallbackTeams.trim()) {
        const split = fallbackTeams.split(/\s+(?:vs\.?|v|-)\s+/i);
        if (split.length >= 2) {
            return [split[0].trim(), split[1].trim()];
        }
    }
    return [];
}

function orderTeamsByFallback(detectedTeams, fallbackTeams) {
    if (Array.isArray(fallbackTeams) && fallbackTeams.length >= 2) {
        const codes = extractFallbackTeamCodes(fallbackTeams);
        if (codes.length === 2 && detectedTeams.includes(codes[0]) && detectedTeams.includes(codes[1])) {
            return codes;
        }
    } else if (typeof fallbackTeams === 'string' && fallbackTeams.trim()) {
        const upper = fallbackTeams.toUpperCase();
        const positioned = detectedTeams
            .map(code => {
                const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const match = new RegExp(`\\b${escaped}\\b`).exec(upper);
                return match ? { code, index: match.index } : null;
            })
            .filter(Boolean)
            .sort((a, b) => a.index - b.index);

        if (positioned.length >= 2) {
            return [positioned[0].code, positioned[1].code];
        }
    }
    return [detectedTeams[0], detectedTeams[1]];
}

/**
 * Infers the two competing team codes from the event stream.
 * Looks for common prefixes in event codes like 'THUNDER SHOT', 'BLAZE CE'.
 * @param {Array<Object>} events
 * @param {string|Array<string>} [fallbackTeams]
 * @returns {[string, string]} [team1, team2]
 */
export function inferTeamsFromEvents(events = [], fallbackTeams = '') {
    const counts = new Map();

    events.forEach(e => {
        const raw = (typeof e === 'string' ? e : e.event || e.code || '').trim();
        if (!raw) return;
        const parts = raw.split(/\s+/);
        if (parts.length >= 2) {
            const prefix = parts[0].toUpperCase();
            if (!STRUCTURAL_CODES.has(prefix) && !/^\d+$/.test(prefix)) {
                counts.set(prefix, (counts.get(prefix) || 0) + 1);
            }
        }
    });

    const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

    if (sorted.length >= 2) {
        return orderTeamsByFallback(sorted, fallbackTeams);
    }

    const fallbackCodes = extractFallbackTeamCodes(fallbackTeams);
    if (fallbackCodes.length >= 2) {
        return [fallbackCodes[0], fallbackCodes[1]];
    }

    return [sorted[0] || 'Team 1', sorted[1] || 'Team 2'];
}

function extractInstanceLabels(block) {
    const labels = [];
    const labelRegex = /<label>([\s\S]*?)<\/label>/g;
    let lMatch;
    while ((lMatch = labelRegex.exec(block)) !== null) {
        const inner = lMatch[1];
        const g = inner.match(/<group>(.*?)<\/group>/);
        const t = inner.match(/<text>(.*?)<\/text>/);
        if (t && t[1]) {
            labels.push({ group: g ? g[1] : '', text: t[1] });
        }
    }
    return labels;
}

function parseInstanceBlock(block) {
    const sMatch = block.match(/<start>(.*?)<\/start>/);
    const eMatch = block.match(/<end>(.*?)<\/end>/);
    const cMatch = block.match(/<code>(.*?)<\/code>/);
    const start = sMatch ? parseFloat(sMatch[1]) : 0;
    const end = eMatch ? parseFloat(eMatch[1]) : 0;
    return {
        event: cMatch ? cMatch[1] : '',
        timeMs: Math.round(start * 1000),
        lead: 0,
        lag: Math.round((end - start) * 10) / 10,
        labels: extractInstanceLabels(block)
    };
}

/**
 * Parses raw XML instances if DOMParser is unavailable (e.g. pure Node CLI).
 */
export function parseXmlFallback(xmlContent) {
    const instances = [];
    const instanceRegex = /<instance>([\s\S]*?)<\/instance>/g;
    let match;
    while ((match = instanceRegex.exec(xmlContent)) !== null) {
        instances.push(parseInstanceBlock(match[1]));
    }
    return instances;
}

function classifyEventTeam(rawCode, team1, team2) {
    if (rawCode.startsWith(`${team1} `)) {
        return { team: 'team1', type: rawCode.replace(`${team1} `, '').trim() };
    }
    if (rawCode.startsWith(`${team2} `)) {
        return { team: 'team2', type: rawCode.replace(`${team2} `, '').trim() };
    }
    if (/^Q[1-4]$/i.test(rawCode)) {
        return { team: 'MATCH', type: 'QUARTER_START' };
    }
    return { team: 'MATCH', type: rawCode };
}

function normalizeKpiType(type) {
    const upper = (type || '').trim().toUpperCase();
    if (/^BW\d*$/.test(upper)) return 'BW';
    if (upper === 'GREEN' || upper === 'YELLOW' || upper === 'CARD') return 'CARD';
    return upper;
}

function getEventWeight(type) {
    const kpiType = normalizeKpiType(type);
    if (kpiType === 'GOAL') return 8;
    if (kpiType === 'SHOT') return 4;
    if (kpiType === 'PC') return 3.5;
    if (kpiType === 'CE') return 2.5;
    if (kpiType === 'A25E') return 1.5;
    if (kpiType === 'BW') return 1.2;
    return 1;
}

function recordEventKpi(team, type, quarter, kpis, quarters) {
    const kpiType = normalizeKpiType(type);
    if (kpis[team] && kpis[team][kpiType] !== undefined) {
        kpis[team][kpiType]++;
        kpis.total[kpiType]++;
        quarters[quarter].kpis[team][kpiType]++;
        if (kpiType === 'GOAL') {
            quarters[quarter].score[team]++;
        }
    }
}

function formatTimestampSeconds(startSec) {
    const min = Math.floor(startSec / 60);
    const sec = Math.floor(startSec % 60);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function buildQuarterResolver(events) {
    const explicitMarkers = events
        .filter(e => /^Q[1-4]$/i.test((e.event || '').trim()))
        .sort((a, b) => a.timeMs - b.timeMs)
        .map(e => ({ timeMs: e.timeMs, quarter: e.event.trim().toUpperCase() }));

    const markers = explicitMarkers.length > 0
        ? explicitMarkers
        : events
            .filter(e => /^(?:MATCH\s+)?START$/i.test((e.event || '').trim()))
            .sort((a, b) => a.timeMs - b.timeMs)
            .map((e, idx) => ({ timeMs: e.timeMs, quarter: `Q${Math.min(idx + 1, 4)}` }));

    return function getQuarter(timeMs) {
        if (markers.length === 0) return 'Q1';
        let currentQ = 'Q1';
        for (const marker of markers) {
            if (timeMs >= marker.timeMs) {
                currentQ = marker.quarter;
            } else {
                break;
            }
        }
        return currentQ;
    };
}

/**
 * Parses match data and computes KPIs, momentum, and quarter statistics.
 */
export function parseMatchReportData({ events = [], xmlContent = '', title = '' } = {}) {
    let parsedEvents = events;
    if ((!parsedEvents || parsedEvents.length === 0) && xmlContent) {
        try {
            if (typeof DOMParser !== 'undefined') {
                parsedEvents = parseXmlToEvents(xmlContent);
            } else {
                parsedEvents = parseXmlFallback(xmlContent);
            }
        } catch {
            parsedEvents = parseXmlFallback(xmlContent);
        }
    }

    const safeEvents = Array.isArray(parsedEvents) ? parsedEvents : [];
    const teams = inferTeamsFromEvents(safeEvents, title);
    const [team1, team2] = teams;

    const getQuarter = buildQuarterResolver(safeEvents);

    function createKpiStore() {
        const store = {};
        KPI_TYPES.forEach(t => { store[t] = 0; });
        return store;
    }

    const kpis = {
        team1: createKpiStore(),
        team2: createKpiStore(),
        total: createKpiStore()
    };

    const quarters = {
        Q1: { score: { team1: 0, team2: 0 }, kpis: { team1: createKpiStore(), team2: createKpiStore() } },
        Q2: { score: { team1: 0, team2: 0 }, kpis: { team1: createKpiStore(), team2: createKpiStore() } },
        Q3: { score: { team1: 0, team2: 0 }, kpis: { team1: createKpiStore(), team2: createKpiStore() } },
        Q4: { score: { team1: 0, team2: 0 }, kpis: { team1: createKpiStore(), team2: createKpiStore() } }
    };

    const maxSec = safeEvents.reduce((max, e) => Math.max(max, (e.timeMs || 0) / 1000), 0);
    const maxMin = Math.max(84, Math.ceil(maxSec / 60));
    const momentum = Array.from({ length: maxMin + 1 }, () => ({ team1: 0, team2: 0 }));

    const enrichedEvents = safeEvents.map((e, index) => {
        const rawCode = (e.event || '').trim();
        const startSec = (e.timeMs || 0) / 1000;
        const quarter = getQuarter(e.timeMs || 0);
        const { team, type } = classifyEventTeam(rawCode, team1, team2);

        if (team === 'team1' || team === 'team2') {
            recordEventKpi(team, type, quarter, kpis, quarters);
            const m = Math.min(Math.floor(startSec / 60), maxMin);
            momentum[m][team] += getEventWeight(type);
        }

        return {
            id: index + 1,
            start: startSec,
            timeStr: formatTimestampSeconds(startSec),
            quarter,
            team: team === 'team1' ? team1 : team === 'team2' ? team2 : 'MATCH',
            type,
            rawCode,
            labels: Array.isArray(e.labels) ? e.labels : []
        };
    });

    return {
        title: title || `${team1} vs ${team2}`,
        teams: [team1, team2],
        score: {
            team1: kpis.team1.GOAL,
            team2: kpis.team2.GOAL
        },
        kpis,
        quarters,
        momentum,
        events: enrichedEvents,
        totalEvents: enrichedEvents.length,
        durationSeconds: maxSec
    };
}

/**
 * Generates standalone, responsive HTML report.
 */
export function generateMatchReportHtml(data) {
    const { teams, score, kpis, quarters, momentum, events, title } = data;
    const [team1, team2] = teams;

    // Compact dataset for table
    const compactEvents = events.map(e => [
        e.id,
        Math.round(e.start * 10) / 10,
        e.timeStr,
        e.quarter,
        e.team,
        e.type,
        e.labels.length > 0 ? e.labels[0].text : ''
    ]);

    const kpiMetrics = [
        { label: 'Goals', t1: kpis.team1.GOAL, t2: kpis.team2.GOAL },
        { label: 'Shots on Goal', t1: kpis.team1.SHOT, t2: kpis.team2.SHOT },
        { label: 'Penalty Corners (PC)', t1: kpis.team1.PC, t2: kpis.team2.PC },
        { label: 'Circle Entries (CE)', t1: kpis.team1.CE, t2: kpis.team2.CE },
        { label: 'Attacking 25m Entries (A25E)', t1: kpis.team1.A25E, t2: kpis.team2.A25E },
        { label: 'Ball Wins (Turnovers Won)', t1: kpis.team1.BW, t2: kpis.team2.BW },
        { label: 'Deep Build-Up Zone 4 (BS4)', t1: kpis.team1.BS4, t2: kpis.team2.BS4 },
        { label: 'Defensive Build-Up Zone 1 (BS1)', t1: kpis.team1.BS1, t2: kpis.team2.BS1 },
        { label: 'Cards (Green / Yellow)', t1: kpis.team1.CARD, t2: kpis.team2.CARD }
    ];

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Match Analytics Dossier</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    :root {
      --background: #090d16;
      --foreground: #f1f5f9;
      --card: #111827;
      --card-border: #1f2937;
      --muted: #64748b;
      --muted-foreground: #94a3b8;
      --team1: #10b981;
      --team2: #f97316;
    }
    body {
      background-color: var(--background);
      color: var(--foreground);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    @media print {
      body { background-color: #ffffff; color: #0f172a; }
      .no-print { display: none !important; }
    }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #0d131f; }
    ::-webkit-scrollbar-thumb { background: #273549; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #3b4d66; }
  </style>
</head>
<body class="min-h-screen text-slate-100 antialiased selection:bg-emerald-500/30">

  <!-- Header -->
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-4 sm:px-8 py-3.5 flex items-center justify-between no-print">
    <div class="flex items-center gap-3">
      <div class="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm">
        FT
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold tracking-wider uppercase text-emerald-400">Match Analytics Dossier</span>
          <span class="text-xs text-slate-500">•</span>
          <span class="text-xs text-slate-400">${title}</span>
        </div>
        <h1 class="text-sm font-semibold text-slate-200">${team1} vs ${team2}</h1>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button onclick="window.print()" class="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 transition">
        <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
        Print / PDF
      </button>
      <button id="download-report-btn" class="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white shadow-sm flex items-center gap-1.5 transition">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
        Save HTML
      </button>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

    <!-- Scoreboard Card -->
    <section class="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 sm:p-8 shadow-xl relative overflow-hidden">
      <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-5 w-full md:w-auto justify-start">
          <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-950/80 border-2 border-emerald-500/60 flex items-center justify-center shadow-lg shadow-emerald-950/50 flex-shrink-0">
            <span class="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">${team1.slice(0, 3)}</span>
          </div>
          <div>
            <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">${team1}</h2>
            <p class="text-xs text-slate-400">Home Team</p>
          </div>
        </div>

        <div class="flex flex-col items-center justify-center px-6 py-2">
          <div class="flex items-baseline gap-4 sm:gap-6">
            <span class="text-5xl sm:text-6xl font-black tracking-tight text-emerald-400">${score.team1}</span>
            <span class="text-2xl sm:text-3xl font-light text-slate-600">-</span>
            <span class="text-5xl sm:text-6xl font-black tracking-tight text-orange-400">${score.team2}</span>
          </div>
          <span class="mt-2 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
            Full Time
          </span>
        </div>

        <div class="flex items-center gap-5 w-full md:w-auto justify-end text-right">
          <div>
            <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">${team2}</h2>
            <p class="text-xs text-slate-400">Away Team</p>
          </div>
          <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-orange-950/80 border-2 border-orange-500/60 flex items-center justify-center shadow-lg shadow-orange-950/50 flex-shrink-0">
            <span class="text-2xl sm:text-3xl font-black text-orange-400 tracking-tight">${team2.slice(0, 3)}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- KPIs & Period Breakdown -->
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 class="text-base font-bold text-white">Head-to-Head Match KPIs</h3>
            <p class="text-xs text-slate-400">Core event counts and share</p>
          </div>
          <div class="flex items-center gap-3 text-xs font-semibold">
            <span class="flex items-center gap-1.5 text-emerald-400">
              <span class="w-2.5 h-2.5 rounded bg-emerald-500"></span> ${team1}
            </span>
            <span class="flex items-center gap-1.5 text-orange-400">
              <span class="w-2.5 h-2.5 rounded bg-orange-500"></span> ${team2}
            </span>
          </div>
        </div>

        <div class="space-y-3.5 text-xs">
          ${kpiMetrics.map(m => {
            const sum = m.t1 + m.t2;
            const p1 = sum > 0 ? ((m.t1 / sum) * 100).toFixed(1) : 50;
            const p2 = sum > 0 ? ((m.t2 / sum) * 100).toFixed(1) : 50;
            return `
            <div>
              <div class="flex items-center justify-between mb-1 text-slate-300 font-medium">
                <span class="font-bold text-sm text-emerald-400 font-mono">${m.t1}</span>
                <span class="text-xs uppercase tracking-wider text-slate-400">${m.label}</span>
                <span class="font-bold text-sm text-orange-400 font-mono">${m.t2}</span>
              </div>
              <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div style="width: ${p1}%" class="h-full bg-emerald-500"></div>
                <div style="width: ${p2}%" class="h-full bg-orange-500"></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between">
        <div>
          <div class="pb-3 border-b border-slate-800">
            <h3 class="text-base font-bold text-white">Period Breakdown</h3>
            <p class="text-xs text-slate-400">Event distribution across quarters</p>
          </div>

          <div class="mt-4 space-y-3">
            ${['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
              const qData = quarters[q] || { score: { team1: 0, team2: 0 }, kpis: { team1: {}, team2: {} } };
              return `
              <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-800 text-slate-200">${q}</span>
                  <span class="text-xs font-semibold text-slate-300">Score: ${qData.score.team1} - ${qData.score.team2}</span>
                </div>
                <div class="grid grid-cols-4 gap-1 text-center text-xs">
                  <div class="bg-slate-900 rounded p-1 border border-slate-800">
                    <span class="text-slate-500 block text-[11px]">Shots</span>
                    <span class="font-bold font-mono text-emerald-400">${qData.kpis.team1.SHOT || 0}</span>:<span class="font-bold font-mono text-orange-400">${qData.kpis.team2.SHOT || 0}</span>
                  </div>
                  <div class="bg-slate-900 rounded p-1 border border-slate-800">
                    <span class="text-slate-500 block text-[11px]">PCs</span>
                    <span class="font-bold font-mono text-emerald-400">${qData.kpis.team1.PC || 0}</span>:<span class="font-bold font-mono text-orange-400">${qData.kpis.team2.PC || 0}</span>
                  </div>
                  <div class="bg-slate-900 rounded p-1 border border-slate-800">
                    <span class="text-slate-500 block text-[11px]">Circle</span>
                    <span class="font-bold font-mono text-emerald-400">${qData.kpis.team1.CE || 0}</span>:<span class="font-bold font-mono text-orange-400">${qData.kpis.team2.CE || 0}</span>
                  </div>
                  <div class="bg-slate-900 rounded p-1 border border-slate-800">
                    <span class="text-slate-500 block text-[11px]">Cards</span>
                    <span class="font-bold font-mono text-emerald-400">${qData.kpis.team1.CARD || 0}</span>:<span class="font-bold font-mono text-orange-400">${qData.kpis.team2.CARD || 0}</span>
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- Momentum Timeline -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 class="text-base font-bold text-white">Attacking Momentum Timeline</h3>
          <p class="text-xs text-slate-400">Minute-by-minute offensive pressure (+${team1} vs -${team2})</p>
        </div>
      </div>
      <div class="w-full overflow-x-auto py-2">
        <svg id="momentum-svg" viewBox="0 0 1000 220" class="w-full min-w-[700px] h-52 select-none">
          <line x1="20" y1="110" x2="980" y2="110" stroke="#334155" stroke-width="1.5" stroke-dasharray="3 3" />
          <g id="bars-group"></g>
        </svg>
      </div>
    </section>

    <!-- Event Explorer -->
    <section id="event-explorer" class="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span>Match Event Stream</span>
            <span id="event-count-badge" class="px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ${events.length} Events
            </span>
          </h3>
          <p class="text-xs text-slate-400">Full Sportscode XML fidelity</p>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <input type="text" id="event-search" placeholder="Search events..." class="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500">
          <select id="quarter-filter" class="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200">
            <option value="ALL">All Quarters</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
            <option value="Q3">Q3</option>
            <option value="Q4">Q4</option>
          </select>
        </div>
      </div>

      <div class="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
        <div class="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider sticky top-0 z-20 border-b border-slate-800">
              <tr>
                <th class="py-2.5 px-4">#</th>
                <th class="py-2.5 px-4">Time</th>
                <th class="py-2.5 px-4">Quarter</th>
                <th class="py-2.5 px-4">Team</th>
                <th class="py-2.5 px-4">Event Code</th>
                <th class="py-2.5 px-4">Labels</th>
              </tr>
            </thead>
            <tbody id="table-body" class="divide-y divide-slate-800/60 font-mono text-slate-300">
            </tbody>
          </table>
        </div>
      </div>
    </section>

  </main>

  <script>
    const COMPACT_EVENTS = ${JSON.stringify(compactEvents)};
    const MOMENTUM = ${JSON.stringify(momentum)};

    // Render momentum bars
    const barsGroup = document.getElementById('bars-group');
    if (barsGroup && MOMENTUM.length > 0) {
      const len = MOMENTUM.length;
      let html = '';
      for (let i = 0; i < len; i++) {
        const x = 30 + (i / (len - 1)) * 940;
        const barW = Math.max(2, Math.min(8, 800 / len));
        const t1 = Math.min(MOMENTUM[i].team1 * 4, 90);
        const t2 = Math.min(MOMENTUM[i].team2 * 4, 90);
        if (t1 > 0) html += '<rect x="' + (x - barW/2) + '" y="' + (110 - t1) + '" width="' + barW + '" height="' + t1 + '" fill="#10b981" opacity="0.85" rx="1"/>';
        if (t2 > 0) html += '<rect x="' + (x - barW/2) + '" y="110" width="' + barW + '" height="' + t2 + '" fill="#f97316" opacity="0.85" rx="1"/>';
      }
      barsGroup.innerHTML = html;
    }

    // Render table
    const tableBody = document.getElementById('table-body');
    const searchInput = document.getElementById('event-search');
    const quarterFilter = document.getElementById('quarter-filter');
    const badge = document.getElementById('event-count-badge');

    function render(list) {
      if (!list.length) {
        tableBody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500 font-sans">No events found.</td></tr>';
        badge.textContent = '0 Events';
        return;
      }
      badge.textContent = list.length + ' Events';
      tableBody.innerHTML = list.map(item => {
        const [id, start, timeStr, quarter, team, type, label] = item;
        let badgeColor = team === '${team1}' ? 'text-emerald-400 bg-emerald-950/80 border-emerald-500/40' : team === '${team2}' ? 'text-orange-400 bg-orange-950/80 border-orange-500/40' : 'text-slate-400 bg-slate-800 border-slate-700';
        return '<tr class="hover:bg-slate-800/40 transition">' +
          '<td class="py-2 px-4 text-slate-500">' + id + '</td>' +
          '<td class="py-2 px-4 text-white font-bold">' + timeStr + '</td>' +
          '<td class="py-2 px-4"><span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">' + quarter + '</span></td>' +
          '<td class="py-2 px-4"><span class="px-2 py-0.5 rounded font-sans font-semibold border ' + badgeColor + '">' + team + '</span></td>' +
          '<td class="py-2 px-4 font-bold text-slate-200">' + type + '</td>' +
          '<td class="py-2 px-4 text-slate-400">' + (label || '—') + '</td>' +
        '</tr>';
      }).join('');
    }

    function filterEvents() {
      const q = quarterFilter.value;
      const term = searchInput.value.trim().toLowerCase();
      const filtered = COMPACT_EVENTS.filter(item => {
        if (q !== 'ALL' && item[3] !== q) return false;
        if (term) {
          const match = item[4].toLowerCase().includes(term) || item[5].toLowerCase().includes(term) || item[2].includes(term) || item[6].toLowerCase().includes(term);
          if (!match) return false;
        }
        return true;
      });
      render(filtered);
    }

    searchInput.addEventListener('input', filterEvents);
    quarterFilter.addEventListener('change', filterEvents);
    render(COMPACT_EVENTS);

    // Download button handler
    const dlBtn = document.getElementById('download-report-btn');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-report.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Builds match report from raw Sportscode XML string.
 */
export function buildMatchReportFromXml(xmlContent, options = {}) {
    const data = parseMatchReportData({ xmlContent, title: options.title });
    const html = generateMatchReportHtml(data);
    return { data, html };
}

/**
 * Client-side browser action: generates report and opens in a new tab.
 */
export function openMatchReport(gameOrXml, options = {}) {
    let data;
    if (typeof gameOrXml === 'string') {
        data = parseMatchReportData({ xmlContent: gameOrXml, title: options.title });
    } else if (gameOrXml && Array.isArray(gameOrXml.events)) {
        data = parseMatchReportData({ events: gameOrXml.events, title: gameOrXml.teams || options.title });
    } else {
        data = parseMatchReportData(options);
    }

    const html = generateMatchReportHtml(data);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
        // Fallback if popup was blocked: trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(data.title || 'match').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-report.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}
