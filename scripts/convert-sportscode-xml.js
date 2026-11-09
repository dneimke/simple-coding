import fs from 'node:fs';
import path from 'node:path';
import { generateSportscodeXml } from '../src/utils/xmlUtils.js';
import { buildSequences } from '../src/spike/sequences/engine.js';
import { formatReport } from '../src/spike/sequences/report.js';

/**
 * Converts a raw Sportscode XML file (such as from Hudl Sportscode matrix coding
 * or standalone button board exports) into a canonical match event stream aligned
 * with our tagging scheme, ready for use with the sequences spike and match review.
 */

const DEFAULT_TEAM_MAPPINGS = {
    'PTX': 'THUNDER',
    'Bne': 'BLAZE'
};

const KNOWN_CODES = new Set([
    'BS', 'BS1', 'BS2', 'BS3', 'BS4', 'BW', 'BW1', 'BW2', 'BW3', 'BW4',
    'A25E', 'CE', 'SHOT', 'SHOTS', 'GSO', 'PC', 'PCA', 'PCD', 'PS', 'ASC',
    'GOAL', 'SO', 'OH', 'GREEN', 'YELLOW', 'RED', 'CARD', 'START', 'END', 'UMP', 'QTR', 'WHISTLE'
]);

export function convertSportscodeXml(xmlText, options = {}) {
    const rawInstances = extractInstances(xmlText);
    if (!rawInstances.length) {
        throw new Error('No <instance> entries found in the XML file.');
    }

    rawInstances.sort((a, b) => a.start - b.start);

    const teamMapping = { ...DEFAULT_TEAM_MAPPINGS, ...(options.mapTeam || {}) };
    const detectedTeams = resolveDetectedTeams(options.teams || detectTeams(rawInstances, teamMapping));
    const [team1, team2] = detectedTeams;

    const events = [];
    extractQuarters(rawInstances, events);

    const context = { rawInstances, team1, team2, teamMapping };
    rawInstances.forEach(inst => mapInstance(inst, context, events));

    events.sort((a, b) => a.timeMs - b.timeMs);

    const game = {
        name: `${team1} vs ${team2}`,
        id: `${team1.toLowerCase()}-v-${team2.toLowerCase()}`,
        teams: [team1, team2],
        events
    };

    const xml = generateSportscodeXml(events);
    const sequences = buildSequences(events, { teams: [team1, team2] });
    const markdownReport = formatReport(game, sequences);

    return { game, xml, sequences, markdownReport };
}

function pushEvent(events, event, timeMs, lead = 10, lag = 10, labels = []) {
    events.push({ event, timeMs, lead, lag, labels });
}

// fallow-ignore-next-line complexity
function resolveDetectedTeams(teams) {
    if (teams.includes('THUNDER') && teams.includes('BLAZE')) return ['THUNDER', 'BLAZE'];
    if (teams.includes('HCM') && teams.includes('CHILL')) return ['CHILL', 'HCM'];
    if (teams.includes('HCM') && teams.includes('TIGERS')) return ['HCM', 'TIGERS'];
    if (teams.includes('COBRAS') && teams.includes('FIRE')) return ['COBRAS', 'FIRE'];
    return [teams[0] || 'THUNDER', teams[1] || 'BLAZE'];
}

function extractQuarters(rawInstances, events) {
    const quarterMatches = [
        { code: 'Q1', pattern: /^Q1$|^QUARTER\s*1\b/i },
        { code: 'Q2', pattern: /^Q2$|^QUARTER\s*2\b/i },
        { code: 'Q3', pattern: /^Q3$|^QUARTER\s*3\b/i },
        { code: 'Q4', pattern: /^Q4$|^QUARTER\s*4\b/i }
    ];
    let found = false;
    quarterMatches.forEach(q => {
        const inst = rawInstances.find(i => q.pattern.test(i.code));
        if (inst) {
            found = true;
            pushEvent(events, q.code, Math.round(inst.start * 1000), 1, 1);
        }
    });
    if (found) return;

    const qtrWhistles = rawInstances.filter(i => /^QTR\s*WHISTLE$/i.test(i.code));
    if (qtrWhistles.length === 6 || qtrWhistles.length === 4) {
        const qStarts = qtrWhistles.length === 6
            ? [qtrWhistles[0], qtrWhistles[1], qtrWhistles[3], qtrWhistles[4]]
            : qtrWhistles.slice(0, 4);
        qStarts.forEach((inst, idx) => {
            pushEvent(events, `Q${idx + 1}`, Math.round(inst.start * 1000), 1, 1);
        });
        return;
    }

    const startInsts = rawInstances.filter(i => /^(Quarter Start|START)$/i.test(i.code));
    startInsts.slice(0, 4).forEach((inst, idx) => {
        pushEvent(events, `Q${idx + 1}`, Math.round(inst.start * 1000), 1, 1);
    });
}

function parseChannelText(text) {
    if (/^(?:LF|LFE|Left)$/i.test(text) || /Circle Entry Left/i.test(text)) return 'Left';
    if (/^(?:RT|RTE|Right)$/i.test(text) || /Circle Entry Right/i.test(text)) return 'Right';
    if (/^(?:CT|CTE|Center|Middle)$/i.test(text) || /Circle Entry (Middle|Center)/i.test(text)) return 'Center';
    return null;
}

// fallow-ignore-next-line complexity
function findChannel(inst, team, rawInstances) {
    for (const l of inst.labels) {
        const dir = parseChannelText(l.text);
        if (dir) return dir;
    }
    const match = rawInstances.find(other =>
        (Math.abs(other.start - inst.start) < 2 || (inst.start >= other.start - 1 && inst.start <= other.end + 1)) &&
        other.labels.some(l => new RegExp(`Circle Entry (Left|Middle|Right) ${team}`, 'i').test(l.text))
    );
    if (match) {
        const l = match.labels.find(lbl => new RegExp(`Circle Entry (Left|Middle|Right) ${team}`, 'i').test(lbl.text));
        return parseChannelText(l?.text || '');
    }
    const dirInst = rawInstances.find(other =>
        new RegExp(`^Circle Entry (Left|Middle|Right) ${team}$`, 'i').test(other.code) &&
        Math.abs(other.start - inst.start) < 0.25
    );
    if (dirInst) return parseChannelText(dirInst.code);

    const nearbyMatch = rawInstances.find(other =>
        other !== inst &&
        Math.abs(other.start - inst.start) < 6 &&
        other.code.includes(team) &&
        other.labels.some(l => parseChannelText(l.text))
    );
    if (nearbyMatch) {
        const l = nearbyMatch.labels.find(lbl => parseChannelText(lbl.text));
        return parseChannelText(l?.text || '');
    }
    return null;
}

function shouldSkipCode(code) {
    if (/^(FULL MATCH|Full Match|QSW MATCH|START|END|Possession|Press|Quarter Start|Quarter End|Quarter \d|Match Highlights|Umpire Calls|QTR WHISTLE)/i.test(code)) return true;
    if (/Against|Defence|PCD|Turnover|Def 50|Press\b/i.test(code)) return true;
    if (/Circle Entry (Left|Middle|Right)/i.test(code)) return true;
    if (/^(?:[A-Za-z0-9_-]+)\s+(?:AC|A25|A50|D25|D30|D50)$/i.test(code)) return true;
    if (/^(?:AC|A25|A50|D25|D30|D50)\s+(?:[A-Za-z0-9_-]+)$/i.test(code)) return true;
    return false;
}

function mapTurnover(action, inst, team, timeMs, events) {
    let zone = '';
    for (const lbl of inst.labels) {
        const txt = lbl.text.toUpperCase();
        if (txt.includes('D30') || txt.includes('D25')) { zone = '1'; break; }
        if (txt.includes('D50')) { zone = '2'; break; }
        if (txt.includes('A50')) { zone = '3'; break; }
        if (txt.includes('A25')) { zone = '4'; break; }
    }
    const turnoverTimeMs = /GAINED\s*POS/i.test(action)
        ? Math.round((inst.start + 6.0) * 1000)
        : timeMs;
    pushEvent(events, `${team} BW${zone}`, turnoverTimeMs, 5, 5);
}

function mapAttackingTransition(inst, team, timeMs, rawInstances, events) {
    const isRestart = inst.labels.some(l => /Outlet|Free Hit|Long Corner/i.test(l.text)) ||
        rawInstances.some(r => /^(BS\d|.*Free Hit|.*Outlet|.*Long Corner|.*16yd Restart)/i.test(r.code) &&
            r.code.includes(team) && Math.abs(r.start - inst.start) < 4);
    if (!isRestart) {
        const pgLabel = inst.labels.find(l => l.text.startsWith('PG'))?.text || '';
        let zone = '';
        if (pgLabel.includes('D25')) zone = '1';
        else if (pgLabel.includes('D50')) zone = '2';
        else if (pgLabel.includes('A50')) zone = '3';
        else if (pgLabel.includes('A25')) zone = '4';
        pushEvent(events, `${team} BW${zone}`, timeMs, 5, 5);
    }
}

function mapGoal(inst, team, timeMs, rawInstances, events) {
    const sub = rawInstances.find(s =>
        /^(?:Field Goal|PCA Goal|PC Goal|1v1 Goal|Shootout Goal)\b/i.test(s.code) &&
        Math.abs(s.end - inst.end) < 2
    );
    const labelSub = inst.labels.find(l => /Field Goal|PC Goal|PCA Goal|Shootout/i.test(l.text))?.text;
    let goalType = labelSub || 'Field Goal';
    if (/SHOOTOUT/i.test(goalType)) goalType = 'Shootout';
    else if (/PC/i.test(goalType)) goalType = 'Penalty Corner';
    else if (/FIELD/i.test(goalType)) goalType = 'Field Goal';

    if (sub) {
        if (/PC/i.test(sub.code)) goalType = 'Penalty Corner';
        else if (/1v1|Shootout/i.test(sub.code)) goalType = 'Shootout';
    }
    pushEvent(events, `${team} GOAL`, timeMs, 10, 10, [{ group: 'Type', text: goalType }]);
}

function mapShot(team, timeMs, events) {
    const hasRecentShot = events.some(e =>
        e.event === `${team} SHOT` && Math.abs(e.timeMs - timeMs) < 2500
    );
    if (!hasRecentShot) {
        pushEvent(events, `${team} SHOT`, timeMs, 10, 10);
    }
}

function mapPc(team, timeMs, events) {
    const hasRecentPc = events.some(e =>
        e.event === `${team} PC` && Math.abs(e.timeMs - timeMs) < 3000
    );
    if (!hasRecentPc) {
        pushEvent(events, `${team} PC`, timeMs, 10, 10);
    }
}

function mapPs(team, timeMs, events) {
    const hasRecentPs = events.some(e =>
        e.event === `${team} PS` && Math.abs(e.timeMs - timeMs) < 45000
    );
    if (!hasRecentPs) {
        pushEvent(events, `${team} PS`, timeMs, 10, 10);
    }
}

function mapRestart(action, team, timeMs, events) {
    if (/Outlet/i.test(action)) {
        const hasRecentRestart = events.some(e =>
            e.event === `${team} BS1` && Math.abs(e.timeMs - timeMs) < 4000
        );
        if (hasRecentRestart) return;
    }
    pushEvent(events, `${team} BS`, timeMs, 10, 10);
}

function matchSimpleAction(action) {
    if (/^16yd\s*Restart$/i.test(action)) return 'BS1';
    if (/^A25\s*FH$/i.test(action)) return 'BS4';
    if (/^(?:A25E|25yd\s*Entry|A25\s*Entry)$/i.test(action)) return 'A25E';
    if (/^(?:OH|Overhead|Overhead\s*BP)$/i.test(action)) return 'OH';
    if (/^(?:SO|1v1|Shootout)$/i.test(action) && !/Goal|Shot|Save/i.test(action)) return 'SO';
    if (/^(?:CARD|Card|GREEN|YELLOW|RED)$/i.test(action)) return 'CARD';
    return null;
}

// fallow-ignore-next-line complexity
function mapInstance(inst, context, events) {
    let code = inst.code.trim().replace(/\s+/g, ' ');
    if (shouldSkipCode(code)) return;

    for (const [fromTeam, toTeam] of Object.entries(context.teamMapping)) {
        code = code.replace(new RegExp(`\\b${fromTeam}\\b`, 'gi'), toTeam);
    }

    const timeMs = Math.round(((inst.start + inst.end) / 2) * 1000);
    if (/^(?:UMP|Whistle)$/i.test(code)) {
        pushEvent(events, 'UMP', timeMs, 7, 7);
        return;
    }

    const team = resolveTeam(code, context.team1, context.team2);
    if (!team) return;

    const action = stripTeam(code, team);
    const simpleCode = matchSimpleAction(action);
    if (simpleCode) {
        pushEvent(events, `${team} ${simpleCode}`, timeMs, 10, 10);
        return;
    }

    if (/^BS[1-4]$/i.test(action)) {
        pushEvent(events, `${team} ${action.toUpperCase()}`, timeMs, 10, 10);
        return;
    }
    if (/^BW[1-4]$/i.test(action)) {
        pushEvent(events, `${team} ${action.toUpperCase()}`, timeMs, 5, 5);
        return;
    }
    if (/^(?:CE|Circle\s*Entry|AC\s*Entry)$/i.test(action)) {
        const channel = findChannel(inst, team, context.rawInstances);
        const labels = channel ? [{ group: 'Channel', text: channel }] : [];
        pushEvent(events, `${team} CE`, timeMs, 10, 10, labels);
        return;
    }
    if (/^(?:BW|REGAIN|Regain|Steal|Transition|GAINED\s*POS)$/i.test(action)) {
        mapTurnover(action, inst, team, timeMs, events);
        return;
    }
    if (action.includes('Attacking Transition')) {
        mapAttackingTransition(inst, team, timeMs, context.rawInstances, events);
        return;
    }
    if (/^(?:BS|Outlet|Pushback|Long Corner|Free Hit(?: A25)?)$/i.test(action)) {
        mapRestart(action, team, timeMs, events);
        return;
    }
    if (/^(?:PC|PC\s*Won|PCA\s*Won|PCA|ASC)$/i.test(action)) {
        mapPc(team, timeMs, events);
        return;
    }
    if (/^(?:PS|PS\s*Won)$/i.test(action)) {
        mapPs(team, timeMs, events);
        return;
    }
    if (/^(?:GOAL|Goal)$/i.test(action) && !/Shot/i.test(action)) {
        mapGoal(inst, team, timeMs, context.rawInstances, events);
        return;
    }
    if (/^(?:SHOT|SHOTS|(?:Field|PCA|1v1|Goal)?\s*(?:Shot|GS)|GSO)$/i.test(action) && !/Against|Save/i.test(action)) {
        mapShot(team, timeMs, events);
    }
}

function resolveTeam(code, team1, team2) {
    if (new RegExp(`\\b${team1}\\b`, 'i').test(code)) return team1;
    if (new RegExp(`\\b${team2}\\b`, 'i').test(code)) return team2;
    return null;
}

function stripTeam(raw, team) {
    if (!team) return raw;
    let cleaned = raw.replace(new RegExp(`^${team}\\s+|\\s+${team}$`, 'i'), '');
    cleaned = cleaned.replace(new RegExp(`\\s*-\\s*${team}\\b`, 'i'), '');
    return cleaned.trim();
}

function detectTeams(instances, teamMapping = {}) {
    const teamCounts = new Map();
    instances.forEach(inst => {
        let code = inst.code.trim();
        for (const [fromTeam, toTeam] of Object.entries(teamMapping)) {
            code = code.replace(new RegExp(`\\b${fromTeam}\\b`, 'gi'), toTeam);
        }
        const words = code.split(/[\s-]+/);
        const first = words[0];
        const last = words[words.length - 1];

        [first, last].forEach(cand => {
            if (cand && cand === cand.toUpperCase() && cand.length >= 2 && !KNOWN_CODES.has(cand) && !/MATCH|QUARTER|QTR|WHISTLE|START|END|UMP|\d+/i.test(cand)) {
                teamCounts.set(cand, (teamCounts.get(cand) || 0) + 1);
            }
        });
    });
    const sorted = [...teamCounts.entries()].sort((a, b) => b[1] - a[1]);
    const teams = sorted.slice(0, 2).map(([team]) => team);
    return teams.length === 2 ? teams : ['THUNDER', 'BLAZE'];
}

function extractInstances(xml) {
    const matches = [...xml.matchAll(/<instance\b[^>]*>([\s\S]*?)<\/instance>/gi)];
    return matches.map((m, i) => {
        const text = m[1];
        const get = t => {
            const match = text.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'i'));
            return match ? match[1].trim() : '';
        };
        const labels = [...text.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)].map(l => {
            const g = l[1].match(/<group[^>]*>(.*?)<\/group>/i);
            const t = l[1].match(/<text[^>]*>(.*?)<\/text>/i);
            return { group: g ? g[1].trim() : '', text: t ? t[1].trim() : '' };
        });
        return {
            id: get('ID') || String(i),
            code: get('code'),
            start: parseFloat(get('start')),
            end: parseFloat(get('end')),
            labels
        };
    });
}

function executeCli() {
    const args = process.argv.slice(2);
    const inputPath = args[0] || 'C:/Users/darre/.gemini/antigravity/brain/44353ad7-c40f-4ecf-8880-0658d6c845d3/.user_uploaded/media_1794209879855_46215ee0.xml';
    const outDirArgIdx = args.indexOf('--out-dir');
    const outDir = outDirArgIdx !== -1 ? args[outDirArgIdx + 1] : 'spikes/sequences/out';

    const mapTeamArgIdx = args.indexOf('--map-team');
    const mapTeam = {};
    if (mapTeamArgIdx !== -1) {
        const pairs = args[mapTeamArgIdx + 1].split(',');
        pairs.forEach(p => {
            const [from, to] = p.split(':');
            if (from && to) mapTeam[from.trim()] = to.trim();
        });
    }

    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }

    const xmlSource = fs.readFileSync(inputPath, 'utf8');
    const result = convertSportscodeXml(xmlSource, { mapTeam });

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const baseNameArgIdx = args.indexOf('--name');
    const baseName = baseNameArgIdx !== -1
        ? args[baseNameArgIdx + 1]
        : 'h1w-thunder-v-blaze';

    const outXmlPath = path.join(outDir, `${baseName}-converted.xml`);
    const outJsonPath = path.join(outDir, `${baseName}-converted.json`);
    const outReportPath = path.join(outDir, `${baseName}-sequences.md`);

    fs.writeFileSync(outXmlPath, result.xml, 'utf8');
    fs.writeFileSync(outJsonPath, JSON.stringify(result.game, null, 2), 'utf8');
    fs.writeFileSync(outReportPath, result.markdownReport, 'utf8');

    console.log(`Successfully converted ${result.game.events.length} events for ${result.game.name}:`);
    console.log(`- Sportscode XML: ${outXmlPath}`);
    console.log(`- Match JSON:     ${outJsonPath}`);
    console.log(`- Sequence Report:${outReportPath}`);
    console.log(`\nClassification Summary:`);
    console.log(`- Total Attacks:  ${result.sequences.stats.entryCount}`);
    console.log(`- Circle Entries: ${result.sequences.stats.circleEntries.total} (${result.sequences.stats.circleEntries.counter} Counter, ${result.sequences.stats.circleEntries.buildUp} Build-Up)`);
    console.log(`- 25m Entries:    ${result.sequences.stats.a25Entries.total} (${result.sequences.stats.a25Entries.counter} Counter, ${result.sequences.stats.a25Entries.buildUp} Build-Up)`);
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('convert-sportscode-xml.js')) {
    executeCli();
}
