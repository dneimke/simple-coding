// Configuration file for the Field Hockey Event Tracker
// This file contains the default configuration for event buttons.


const LOCAL_STORAGE_KEY_CONFIG = 'fieldHockeyConfig_v1';
const LOCAL_STORAGE_KEY_NAMED_CONFIGS = 'fieldHockeyNamedConfigs_v1';

// Earlier built-in. Kept so a previously seeded copy can be recognised and removed.
const LEGACY_DEFAULT_CONFIG = {
    rowDefs: [
        { gridCols: "grid-cols-2", buttons: [{ event: "OUTLET", text: "OUTLET", color: "btn-blue" }, { event: "PRESS", text: "PRESS", color: "btn-blue" }] },
        { gridCols: "grid-cols-4", buttons: [{ event: "DEF 25 ENTRY", text: "DEF 25 ENTRY", color: "btn-red" }, { event: "DEF CIRC ENTRY", text: "DEF CIRC ENTRY", color: "btn-red" }, { event: "SHOT AG", text: "SHOT AG", color: "btn-red" }, { event: "GOAL AG", text: "GOAL AG", color: "btn-red" }] },
        { gridCols: "grid-cols-4", buttons: [{ event: "ATT 25 ENTRY", text: "ATT 25 ENTRY", color: "btn-green" }, { event: "ATT CIRC ENTRY", text: "ATT CIRC ENTRY", color: "btn-green" }, { event: "SHOT FOR", text: "SHOT FOR", color: "btn-green" }, { event: "GOAL FOR", text: "GOAL FOR", color: "btn-green" }] },
        { gridCols: "grid-cols-4", buttons: [{ event: "APC", text: "APC", color: "btn-blue" }, { event: "DPC", text: "DPC", color: "btn-blue" }, { event: "STROKE", text: "STROKE", color: "btn-blue" }, { event: "1V1", text: "1V1", color: "btn-blue" }] },
        { gridCols: "grid-cols-5", buttons: [{ event: "3 PASS", text: "3 PASS", color: "btn-yellow" }, { event: "TACKLE", text: "TACKLE", color: "btn-yellow" }, { event: "DEF", text: "DEF", color: "btn-yellow" }, { event: "MF", text: "MF", color: "btn-yellow" }, { event: "ATT", text: "ATT", color: "btn-yellow" }] },
        { gridCols: "grid-cols-4", buttons: [{ event: "OVERHEAD FOR", text: "OVERHEAD FOR", color: "btn-blue" }, { event: "OVERHEAD AG", text: "OVERHEAD AG", color: "btn-blue" }, { event: "CIRC-DEF", text: "CIRC-DEF", color: "btn-blue" }, { event: "CLOSE-BASE", text: "CLOSE-BASE", color: "btn-blue" }] },
        { gridCols: "grid-cols-4", buttons: [{ event: "P1", text: "P1", color: "btn-blue" }, { event: "P2", text: "P2", color: "btn-blue" }, { event: "P3", text: "P3", color: "btn-blue" }, { event: "P4", text: "P4", color: "btn-blue" }] },
        { gridCols: "grid-cols-3", buttons: [{ event: "CARD", text: "CARD", color: "btn-green" }, { event: "INJURY", text: "INJURY", color: "btn-green" }, { event: "WHISTLE", text: "WHISTLE", color: "btn-green" }] }
    ]
};

const teamButtons = (team, codes, color) =>
    codes.map(code => ({ event: `${team} ${code}`, text: `${team} ${code}`, color }));

const teamRows = (gridCols, codes) => [
    { gridCols, buttons: teamButtons("FIRE", codes, "btn-red") },
    { gridCols, buttons: teamButtons("TIGERS", codes, "btn-yellow") }
];

// Earlier built-in. Kept so a previously seeded copy can be recognised and removed.
const HOCKEY_ONE_CONFIG = {
    rowDefs: [
        { gridCols: "grid-cols-3", buttons: ["START", "END", "UMP"].map(code => ({ event: code, text: code, color: "btn-gray" })) },
        ...teamRows("grid-cols-4", ["BS1", "BS2", "BS3", "BS4"]),
        ...teamRows("grid-cols-4", ["CE", "SHOT", "ASC", "PC"]),
        ...teamRows("grid-cols-3", ["APS", "PS", "GOAL"]),
        ...teamRows("grid-cols-3", ["GREEN", "YELLOW", "RED"]),
        { gridCols: "grid-cols-2", buttons: [{ event: "SO FIRE", text: "SO FIRE", color: "btn-red" }, { event: "SO TASSIE", text: "SO TASSIE", color: "btn-yellow" }] }
    ]
};

// Clip lead / lag seconds from Mitty's MyVA coding window; codes not listed (BW, RED) use the default
const ZONED_CLIP_TIMINGS = {
    START: [1, 1], END: [1, 1], UMP: [7, 7],
    BS: [10, 10], OH: [5, 10], A25E: [5, 10], CE: [10, 10], SHOT: [15, 5], ASC: [10, 1], PC: [2, 10],
    APS: [10, 1], PS: [3, 2], GOAL: [15, 5], SO: [2, 10],
    GREEN: [20, 130], YELLOW: [20, 360]
};

const clipTiming = (code) => {
    const timing = ZONED_CLIP_TIMINGS[code];
    return timing ? { lead: timing[0], lag: timing[1] } : {};
};

// Team buttons hold only the event code; the team code chosen at game start is prefixed at runtime
const slotButtons = (codes, zoned = false) =>
    codes.map(code => ({ event: code, text: code, ...(zoned && { zoned: true }), ...clipTiming(code) }));

const zonedTeamRows = () => [1, 2].map(team => ({
    team,
    grids: [{
        gridCols: "grid-cols-8",
        buttons: [...slotButtons(["BS", "BW"], true), ...slotButtons(["OH", "A25E", "CE", "SHOT", "ASC", "PC"])]
    }]
}));

// One shared set of scoring and card buttons; a team toggle on the row picks which team they log for
const scoringRow = () => ({
    team: "selected",
    grids: [
        { gridCols: "grid-cols-4", buttons: slotButtons(["APS", "PS", "GOAL", "SO"]) },
        { gridCols: "grid-cols-3", buttons: slotButtons(["GREEN", "YELLOW", "RED"]) }
    ]
});

const HOCKEY_ONE_ZONED_CONFIG = {
    zones: { values: ["1", "2", "3", "4"], default: "1", perspective: "mirrored" },
    rowDefs: [
        { gridCols: "grid-cols-3", buttons: ["START", "END", "UMP"].map(code => ({ event: code, text: code, color: "btn-gray", ...clipTiming(code) })) },
        ...zonedTeamRows(),
        scoringRow()
    ]
};

const DEFAULT_CONFIG = HOCKEY_ONE_ZONED_CONFIG;

const BUILT_IN_NAMED_CONFIGS = {
    'hockey-one-zoned': HOCKEY_ONE_ZONED_CONFIG
};

// Names that used to be seeded. An unchanged copy is removed; a saved edit under that name is kept.
export const RETIRED_BUILT_IN_CONFIGS = {
    default: LEGACY_DEFAULT_CONFIG,
    'hockey-one': HOCKEY_ONE_CONFIG
};

const isValidConfig = (config) => Boolean(config && Array.isArray(config.rowDefs));

const isValidClipSeconds = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

const ZONE_PERSPECTIVES = ['mirrored', 'pitch'];

// "selected" rows log for whichever team is picked on the row's team toggle
const ROW_TEAMS = [1, 2, 'selected'];

// A row holds either a single grid ({ gridCols, buttons }) or several ({ grids: [...] })
export function rowGrids(row) {
    if (Array.isArray(row?.grids)) return row.grids.filter(Boolean);
    return row ? [row] : [];
}

// True when the config has team-slot rows, so team codes must be chosen before a game starts
export function usesTeams(config) {
    return Boolean(isValidConfig(config) && config.rowDefs.some(row => row?.team !== undefined));
}

function validateZones(zones) {
    if (zones === undefined) return;
    if (!zones || !Array.isArray(zones.values) || zones.values.length === 0) {
        throw new Error('zones.values must be a non-empty list.');
    }
    if (zones.default !== undefined && !zones.values.includes(zones.default)) {
        throw new Error('zones.default must be one of zones.values.');
    }
    if (zones.perspective !== undefined && !ZONE_PERSPECTIVES.includes(zones.perspective)) {
        throw new Error(`zones.perspective must be one of: ${ZONE_PERSPECTIVES.join(', ')}.`);
    }
}

// Throws if the configuration structure, zones, team slots or any button's lead/lag (seconds) is invalid
export function validateConfig(config) {
    if (!isValidConfig(config)) {
        throw new Error('Invalid configuration structure.');
    }
    validateZones(config.zones);

    for (const row of config.rowDefs) {
        if (row?.team !== undefined && !ROW_TEAMS.includes(row.team)) {
            throw new Error('Row team must be 1, 2 or "selected".');
        }
        for (const grid of rowGrids(row)) {
            for (const button of grid?.buttons ?? []) {
                const name = button?.event || button?.text || 'Button';
                for (const field of ['lead', 'lag']) {
                    if (button?.[field] !== undefined && !isValidClipSeconds(button[field])) {
                        throw new Error(`${name}: ${field} must be a number of 0 or more.`);
                    }
                }
                if (button?.zoned && !config.zones) {
                    throw new Error(`${name}: zoned buttons need a zones block in the configuration.`);
                }
            }
        }
    }
}

const cloneConfig = (config) => JSON.parse(JSON.stringify(config));

const isRetiredBuiltIn = (config) =>
    Object.values(RETIRED_BUILT_IN_CONFIGS).some(retired => JSON.stringify(retired) === JSON.stringify(config));

// Utility function to load configuration from localStorage or return the default.
// An active board that is still an unchanged retired built-in is replaced with the current default.
export function loadConfiguration() {
    try {
        const storedConfig = localStorage.getItem(LOCAL_STORAGE_KEY_CONFIG);
        if (!storedConfig) return DEFAULT_CONFIG;
        const parsed = JSON.parse(storedConfig);
        if (!isRetiredBuiltIn(parsed)) return parsed;
        saveConfiguration(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
    } catch (error) {
        console.error('Error loading configuration:', error);
        return DEFAULT_CONFIG;
    }
}

// Utility function to save configuration to localStorage
export function saveConfiguration(config) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_CONFIG, JSON.stringify(config));
        return true;
    } catch (error) {
        console.error('Error saving configuration:', error);
        return false;
    }
}

// Utility function to reset configuration to default
export function resetConfiguration() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_CONFIG, JSON.stringify(DEFAULT_CONFIG));
        return DEFAULT_CONFIG;
    } catch (error) {
        console.error('Error resetting configuration:', error);
        return DEFAULT_CONFIG;
    }
}

function readNamedConfigs() {
    let stored = {};
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY_NAMED_CONFIGS);
        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            stored = parsed;
        }
    } catch (error) {
        console.error('Error loading named configurations:', error);
    }

    let changed = false;
    for (const [name, retired] of Object.entries(RETIRED_BUILT_IN_CONFIGS)) {
        if (stored[name] && JSON.stringify(stored[name]) === JSON.stringify(retired)) {
            delete stored[name];
            changed = true;
        }
    }

    let seeded = false;
    for (const [name, config] of Object.entries(BUILT_IN_NAMED_CONFIGS)) {
        if (!isValidConfig(stored[name])) {
            stored[name] = cloneConfig(config);
            seeded = true;
        }
    }

    if (seeded || changed) {
        writeNamedConfigs(stored);
    }
    return stored;
}

function writeNamedConfigs(configs) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_NAMED_CONFIGS, JSON.stringify(configs));
        return true;
    } catch (error) {
        console.error('Error saving named configurations:', error);
        return false;
    }
}

// Returns saved configuration names, sorted, including built-ins
export function listNamedConfigs() {
    return Object.keys(readNamedConfigs()).sort((a, b) => a.localeCompare(b));
}

export function getNamedConfig(name) {
    const config = readNamedConfigs()[String(name ?? '').trim()];
    return config ? cloneConfig(config) : null;
}

// Returns the saved name whose layout matches the given configuration, or null
export function findNamedConfigName(config) {
    if (!isValidConfig(config)) {
        return null;
    }
    const target = JSON.stringify(config.rowDefs);
    const configs = readNamedConfigs();
    return Object.keys(configs)
        .sort((a, b) => a.localeCompare(b))
        .find(name => JSON.stringify(configs[name].rowDefs) === target) ?? null;
}

// Stores a configuration under a name and makes it the active configuration
export function saveNamedConfig(name, config) {
    const trimmedName = String(name ?? '').trim();
    if (!trimmedName) {
        throw new Error('Configuration name is required.');
    }
    validateConfig(config);

    const configs = readNamedConfigs();
    configs[trimmedName] = cloneConfig(config);
    return writeNamedConfigs(configs) && saveConfiguration(config);
}

// Copies a named configuration into the active slot and returns it
export function activateNamedConfig(name) {
    const config = getNamedConfig(name);
    if (!config) {
        throw new Error(`No saved configuration named "${String(name ?? '').trim()}".`);
    }
    if (!saveConfiguration(config)) {
        throw new Error('Failed to save the active configuration.');
    }
    return config;
}
