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

export function convertSportscodeXml(xmlText, options = {}) {
    const rawInstances = extractInstances(xmlText);
    if (!rawInstances.length) {
        throw new Error('No <instance> entries found in the XML file.');
    }

    rawInstances.sort((a, b) => a.start - b.start);

    const teamMapping = { ...DEFAULT_TEAM_MAPPINGS, ...(options.mapTeam || {}) };
    let detectedTeams = options.teams || detectTeams(rawInstances, teamMapping);

    if (detectedTeams.includes('THUNDER') && detectedTeams.includes('BLAZE')) {
        detectedTeams = ['THUNDER', 'BLAZE'];
    } else if (detectedTeams.includes('HCM') && detectedTeams.includes('CHILL')) {
        detectedTeams = ['CHILL', 'HCM'];
    } else if (detectedTeams.includes('HCM') && detectedTeams.includes('TIGERS')) {
        detectedTeams = ['HCM', 'TIGERS'];
    } else if (detectedTeams.includes('COBRAS') && detectedTeams.includes('FIRE')) {
        detectedTeams = ['COBRAS', 'FIRE'];
    }
    const [team1 = detectedTeams[0] || 'THUNDER', team2 = detectedTeams[1] || 'BLAZE'] = detectedTeams;

    const events = [];

    // 1. Quarters
    const quarterMatches = [
        { code: 'Q1', pattern: /^Q1$|^QUARTER\s*1\b/i },
        { code: 'Q2', pattern: /^Q2$|^QUARTER\s*2\b/i },
        { code: 'Q3', pattern: /^Q3$|^QUARTER\s*3\b/i },
        { code: 'Q4', pattern: /^Q4$|^QUARTER\s*4\b/i }
    ];
    let quarterFound = false;
    quarterMatches.forEach(q => {
        const inst = rawInstances.find(i => q.pattern.test(i.code));
        if (inst) {
            quarterFound = true;
            events.push({
                event: q.code,
                timeMs: Math.round(inst.start * 1000),
                lead: 1,
                lag: 1,
                labels: []
            });
        }
    });

    // Fallback A: Check for QTR WHISTLE instances
    if (!quarterFound) {
        const qtrWhistles = rawInstances.filter(i => /^QTR\s*WHISTLE$/i.test(i.code));
        if (qtrWhistles.length === 6) {
            // Pushbacks: Q1 start, Q2 start, Q3 start, Q4 start (skipping Q2 end at [2] and Q4 end at [5])
            const qStarts = [qtrWhistles[0], qtrWhistles[1], qtrWhistles[3], qtrWhistles[4]];
            qStarts.forEach((inst, idx) => {
                events.push({
                    event: `Q${idx + 1}`,
                    timeMs: Math.round(inst.start * 1000),
                    lead: 1,
                    lag: 1,
                    labels: []
                });
            });
            quarterFound = true;
        } else if (qtrWhistles.length === 4) {
            qtrWhistles.forEach((inst, idx) => {
                events.push({
                    event: `Q${idx + 1}`,
                    timeMs: Math.round(inst.start * 1000),
                    lead: 1,
                    lag: 1,
                    labels: []
                });
            });
            quarterFound = true;
        }
    }

    // Fallback B: If no QUARTER / Q tags, check for Quarter Start or START markers
    if (!quarterFound) {
        const startInsts = rawInstances.filter(i => /^(Quarter Start|START)$/i.test(i.code));
        startInsts.forEach((inst, idx) => {
            if (idx < 4) {
                events.push({
                    event: `Q${idx + 1}`,
                    timeMs: Math.round(inst.start * 1000),
                    lead: 1,
                    lag: 1,
                    labels: []
                });
            }
        });
    }

    // 2. Channel directions for Circle Entries
    function findChannel(inst, team) {
        // A. Look in inst's own labels
        const own = inst.labels.find(l => /Circle Entry (Left|Middle|Right)/i.test(l.text));
        if (own) {
            if (/Left/i.test(own.text)) return 'Left';
            if (/Right/i.test(own.text)) return 'Right';
            if (/Middle|Center/i.test(own.text)) return 'Center';
        }
        const shortOwn = inst.labels.find(l => /^(?:LF|LFE|Left|CT|CTE|Center|Middle|RT|RTE|Right)$/i.test(l.text));
        if (shortOwn) {
            if (/^(?:LF|LFE|Left)$/i.test(shortOwn.text)) return 'Left';
            if (/^(?:RT|RTE|Right)$/i.test(shortOwn.text)) return 'Right';
            if (/^(?:CT|CTE|Center|Middle)$/i.test(shortOwn.text)) return 'Center';
        }
        // B. Look for overlapping instances with that label
        const match = rawInstances.find(other =>
            (Math.abs(other.start - inst.start) < 2 || (inst.start >= other.start - 1 && inst.start <= other.end + 1)) &&
            other.labels.some(l => new RegExp(`Circle Entry (Left|Middle|Right) ${team}`, 'i').test(l.text))
        );
        if (match) {
            const l = match.labels.find(lbl => new RegExp(`Circle Entry (Left|Middle|Right) ${team}`, 'i').test(lbl.text));
            if (/Left/i.test(l.text)) return 'Left';
            if (/Right/i.test(l.text)) return 'Right';
            if (/Middle|Center/i.test(l.text)) return 'Center';
        }
        // C. Look for separate Circle Entry Left/Middle/Right instances
        const dirInst = rawInstances.find(other =>
            new RegExp(`^Circle Entry (Left|Middle|Right) ${team}$`, 'i').test(other.code) &&
            Math.abs(other.start - inst.start) < 0.25
        );
        if (dirInst) {
            if (/Left/i.test(dirInst.code)) return 'Left';
            if (/Right/i.test(dirInst.code)) return 'Right';
            if (/Middle|Center/i.test(dirInst.code)) return 'Center';
        }
        // D. Look for nearby instances of the same team within 6 seconds having short direction codes
        const nearbyMatch = rawInstances.find(other =>
            other !== inst &&
            Math.abs(other.start - inst.start) < 6 &&
            other.code.includes(team) &&
            other.labels.some(l => /^(?:LF|LFE|Left|CT|CTE|Center|Middle|RT|RTE|Right)$/i.test(l.text))
        );
        if (nearbyMatch) {
            const l = nearbyMatch.labels.find(lbl => /^(?:LF|LFE|Left|CT|CTE|Center|Middle|RT|RTE|Right)$/i.test(lbl.text));
            if (/^(?:LF|LFE|Left)$/i.test(l.text)) return 'Left';
            if (/^(?:RT|RTE|Right)$/i.test(l.text)) return 'Right';
            if (/^(?:CT|CTE|Center|Middle)$/i.test(l.text)) return 'Center';
        }
        return null;
    }

    const restarts = rawInstances.filter(i => /^(BS\d|.*Free Hit|.*Outlet|.*Long Corner|.*16yd Restart)/i.test(i.code));

    // 3. Primary event mappings
    rawInstances.forEach(inst => {
        let code = inst.code.trim();

        // Normalize spaces
        code = code.replace(/\s+/g, ' ');

        // Skip administrative video blocks and defensive mirrors
        if (/^(FULL MATCH|Full Match|QSW MATCH|START|END|Possession|Press|Quarter Start|Quarter End|Quarter \d|Match Highlights|Umpire Calls|QTR WHISTLE)/i.test(code)) return;
        if (/Against|Defence|PCD|Turnover|Def 50|Press\b/i.test(code)) return;
        if (/Circle Entry (Left|Middle|Right)/i.test(code)) return; // merged into CE

        // Skip standalone spatial boxes without "Entry" (e.g. "CHILL AC", "CHILL A25", "CHILL A50", "CHILL D25", "CHILL D50", "COBRAS D30", "FIRE D30")
        if (/^(?:[A-Za-z0-9_-]+)\s+(?:AC|A25|A50|D25|D30|D50)$/i.test(code)) return;
        if (/^(?:AC|A25|A50|D25|D30|D50)\s+(?:[A-Za-z0-9_-]+)$/i.test(code)) return;

        // Apply team mappings (e.g. PTX -> THUNDER, Bne -> BLAZE)
        for (const [fromTeam, toTeam] of Object.entries(teamMapping)) {
            if (new RegExp(`\\b${fromTeam}\\b`, 'i').test(code)) {
                code = code.replace(new RegExp(`\\b${fromTeam}\\b`, 'gi'), toTeam);
            }
        }

        const timeMs = Math.round(((inst.start + inst.end) / 2) * 1000);

        // Check for standalone UMP / Whistle tag
        if (/^(?:UMP|Whistle)$/i.test(code)) {
            events.push({
                event: 'UMP',
                timeMs,
                lead: 7,
                lag: 7,
                labels: []
            });
            return;
        }

        const team = resolveTeam(code, team1, team2);
        if (!team) return;

        const action = stripTeam(code, team);

        // Dedicated BS1..BS4
        if (/^BS[1-4]$/i.test(action)) {
            events.push({
                event: `${team} ${action.toUpperCase()}`,
                timeMs,
                lead: 10,
                lag: 10,
                labels: []
            });
            return;
        }

        // Dedicated BW1..BW4
        if (/^BW[1-4]$/i.test(action)) {
            events.push({
                event: `${team} ${action.toUpperCase()}`,
                timeMs,
                lead: 5,
                lag: 5,
                labels: []
            });
            return;
        }

        // 16yd Restart -> BS1
        if (/^16yd\s*Restart$/i.test(action)) {
            events.push({
                event: `${team} BS1`,
                timeMs,
                lead: 10,
                lag: 10,
                labels: []
            });
            return;
        }

        // A25 FH -> BS4
        if (/^A25\s*FH$/i.test(action)) {
            events.push({
                event: `${team} BS4`,
                timeMs,
                lead: 10,
                lag: 10,
                labels: []
            });
            return;
        }

        // Circle Entries (CE or AC Entry or Circle Entry)
        if (/^(?:CE|Circle\s*Entry|AC\s*Entry)$/i.test(action)) {
            const channel = findChannel(inst, team);
            const labels = channel ? [{ group: 'Channel', text: channel }] : [];
            events.push({
                event: `${team} CE`,
                timeMs,
                lead: 10,
                lag: 10,
                labels
            });
            return;
        }

        // Attacking 25m Entries (A25E or 25yd Entry or A25 Entry)
        if (/^(?:A25E|25yd\s*Entry|A25\s*Entry)$/i.test(action)) {
            events.push({
                event: `${team} A25E`,
                timeMs,
                lead: 10,
                lag: 10,
                labels: []
            });
            return;
        }

        // Ball Won / Regains / Steals / Transition / Gained Pos (BW)
        if (/^(?:BW|REGAIN|Regain|Steal|Transition|GAINED\s*POS)$/i.test(action)) {
            let zone = '';
            for (const lbl of inst.labels) {
                const txt = lbl.text.toUpperCase();
                if (txt.includes('D30') || txt.includes('D25')) { zone = '1'; break; }
                if (txt.includes('D50')) { zone = '2'; break; }
                if (txt.includes('A50')) { zone = '3'; break; }
                if (txt.includes('A25')) { zone = '4'; break; }
            }
            // For GAINED POS, the Hudl tagger had a 6.0s lead time, so start + 6s is the actual turnover moment
            const turnoverTimeMs = /GAINED\s*POS/i.test(action)
                ? Math.round((inst.start + 6.0) * 1000)
                : timeMs;

            events.push({
                event: `${team} BW${zone}`,
                timeMs: turnoverTimeMs,
                lead: 5,
                lag: 5,
                labels: []
            });
            return;
        }

        // Attacking Transition with spatial PG labels (Turnover won if not from restart)
        if (action.includes('Attacking Transition')) {
            const isRestart = inst.labels.some(l => /Outlet|Free Hit|Long Corner/i.test(l.text)) ||
                restarts.some(r => r.code.includes(team) && Math.abs(r.start - inst.start) < 4);
            if (!isRestart) {
                const pgLabel = inst.labels.find(l => l.text.startsWith('PG'))?.text || '';
                let zone = '';
                if (pgLabel.includes('D25')) zone = '1';
                else if (pgLabel.includes('D50')) zone = '2';
                else if (pgLabel.includes('A50')) zone = '3';
                else if (pgLabel.includes('A25')) zone = '4';

                events.push({
                    event: `${team} BW${zone}`,
                    timeMs,
                    lead: 5,
                    lag: 5,
                    labels: []
                });
                return;
            }
        }

        // Restarts & Build-up (BS)
        if (/^(?:BS|Outlet|Pushback|Long Corner|Free Hit(?: A25)?)$/i.test(action)) {
            // Deduplicate outlet if already logged 16yd restart within 4 seconds
            if (/Outlet/i.test(action)) {
                const hasRecentRestart = events.some(e =>
                    e.event === `${team} BS1` && Math.abs(e.timeMs - timeMs) < 4000
                );
                if (hasRecentRestart) return;
            }

            events.push({
                event: `${team} BS`,
                timeMs,
                lead: 10,
                lag: 10,
                labels: []
            });
            return;
        }

        // Overhead aerials (OH)
        if (/^(?:OH|Overhead|Overhead\s*BP)$/i.test(action)) {
            events.push({
                event: `${team} OH`,
                timeMs,
                lead: 10,
                lag: 10,
                labels: []
            });
            return;
        }

        // Penalty Corners (PC or PC Won or PCA Won or PCA or ASC)
        if (/^(?:PC|PC\s*Won|PCA\s*Won|PCA|ASC)$/i.test(action)) {
            // Deduplicate if we already logged PC won within 3 seconds
            const hasRecentPc = events.some(e =>
                e.event === `${team} PC` && Math.abs(e.timeMs - timeMs) < 3000
            );
            if (!hasRecentPc) {
                events.push({
                    event: `${team} PC`,
                    timeMs,
                    lead: 10,
                    lag: 10,
                    labels: []
                });
            }
            return;
        }

        // Penalty Strokes (PS or PS Won)
        if (/^(?:PS|PS\s*Won)$/i.test(action)) {
            const hasRecentPs = events.some(e =>
                e.event === `${team} PS` && Math.abs(e.timeMs - timeMs) < 45000
            );
            if (!hasRecentPs) {
                events.push({
                    event: `${team} PS`,
                    timeMs,
                    lead: 10,
                    lag: 10,
                    labels: []
                });
            }
            return;
        }

        // Goals (GOAL)
        if (/^(?:GOAL|Goal)$/i.test(action) && !/Shot/i.test(action)) {
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
            events.push({
                event: `${team} GOAL`,
                timeMs,
                lead: 10,
                lag: 10,
                labels: [{ group: 'Type', text: goalType }]
            });
            return;
        }

        // Shots (SHOT)
        if (/^(?:SHOT|SHOTS|(?:Field|PCA|1v1|Goal)?\s*(?:Shot|GS)|GSO)$/i.test(action) && !/Against|Save/i.test(action)) {
            const hasRecentShot = events.some(e =>
                e.event === `${team} SHOT` && Math.abs(e.timeMs - timeMs) < 2500
            );
            if (!hasRecentShot) {
                events.push({
                    event: `${team} SHOT`,
                    timeMs,
                    lead: 10,
                    lag: 10,
                    labels: []
                });
            }
            return;
        }

        // 1v1 / Shootout contest (SO)
        if (/^(?:SO|1v1|Shootout)$/i.test(action) && !/Goal|Shot|Save/i.test(action)) {
            events.push({
                event: `${team} SO`,
                timeMs,
                lead: 10,
                lag: 10,
                labels: []
            });
            return;
        }

        // Cards (CARD)
        if (/^(?:CARD|Card|GREEN|YELLOW|RED)$/i.test(action)) {
            events.push({
                event: `${team} CARD`,
                timeMs,
                lead: 10,
                lag: 10,
                labels: []
            });
        }
    });

    // Chronological order
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

    return {
        game,
        xml,
        sequences,
        markdownReport
    };
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

const KNOWN_CODES = new Set(['BS', 'BS1', 'BS2', 'BS3', 'BS4', 'BW', 'BW1', 'BW2', 'BW3', 'BW4', 'A25E', 'CE', 'SHOT', 'SHOTS', 'GSO', 'PC', 'PCA', 'PCD', 'PS', 'ASC', 'GOAL', 'SO', 'OH', 'GREEN', 'YELLOW', 'RED', 'CARD', 'START', 'END', 'UMP', 'QTR', 'WHISTLE']);

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

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('convert-sportscode-xml.js')) {
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
