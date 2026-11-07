/**
 * Reads a coded game without going through the app.
 * JSON keeps each event's timeMs. Sportscode XML recovers time as the clip midpoint.
 */

const CLIP_LEAD_SECONDS = 5;
const CLIP_LAG_SECONDS = 5;

/**
 * @param {string} text
 * @param {{ gameId?: string }} [options]
 */
export function loadGameText(text, options = {}) {
    const source = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!source) throw new Error('Game file is empty.');
    if (source.startsWith('<') || source.includes('<ALL_INSTANCES') || source.includes('<instance>')) {
        return loadSportscodeXml(source);
    }
    return loadGameJson(JSON.parse(source), options.gameId);
}

function loadGameJson(data, gameId) {
    const game = selectGame(data, gameId);
    if (!game || !Array.isArray(game.events)) {
        throw new Error('Expected a game object with an events array, or a list of games.');
    }
    return {
        name: game.name || game.id || 'Coded game',
        id: game.id || null,
        teams: normalizeTeams(game),
        timeSource: 'timeMs',
        events: game.events.map(event => ({ ...event, labels: copyLabels(event.labels) }))
    };
}

function selectGame(data, gameId) {
    if (Array.isArray(data)) {
        if (gameId) return data.find(game => game && game.id === gameId) || null;
        return data[0];
    }
    if (data && Array.isArray(data.games)) {
        return selectGame(data.games, gameId);
    }
    return data;
}

function normalizeTeams(game) {
    if (Array.isArray(game.teams)) return game.teams;
    if (typeof game.teams === 'string') {
        return game.teams.split(/\s+vs\s+/i).map(team => team.trim()).filter(Boolean);
    }
    return [];
}

function loadSportscodeXml(xml) {
    const instances = [...xml.matchAll(/<instance\b[^>]*>([\s\S]*?)<\/instance>/gi)];
    if (instances.length === 0) throw new Error('No Sportscode instances found in XML.');
    const events = instances.map((match, index) => instanceToEvent(match[1], index));
    return {
        name: 'Sportscode export',
        id: null,
        teams: [],
        timeSource: 'xml-clip-midpoint',
        events
    };
}

function instanceToEvent(block, index) {
    const start = Number(tagText(block, 'start'));
    const end = Number(tagText(block, 'end'));
    const labels = [...block.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)].map(match => ({
        group: decodeXml(tagText(match[1], 'group')),
        text: decodeXml(tagText(match[1], 'text'))
    })).filter(label => label.text);
    const timeMs = instanceTimeMs(start, end);
    const lead = Math.max(0, Math.round((timeMs / 1000) - start));
    return {
        id: tagText(block, 'ID') || `i${index}`,
        event: decodeXml(tagText(block, 'code')),
        timeMs,
        lead: lead > 0 ? lead : undefined,
        labels: labels.length ? labels : undefined
    };
}

function instanceTimeMs(start, end) {
    if (start === 0 && end <= CLIP_LEAD_SECONDS + CLIP_LAG_SECONDS) {
        return Math.round(Math.max(0, end - CLIP_LAG_SECONDS) * 1000);
    }
    return Math.round(((start + end) / 2) * 1000);
}

function tagText(block, name) {
    const match = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
    return match ? decodeXml(match[1].trim()) : '';
}

function decodeXml(value) {
    return String(value)
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

function copyLabels(labels) {
    if (!Array.isArray(labels)) return labels;
    return labels.map(label => ({ ...label }));
}
