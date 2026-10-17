// Configuration file for the Field Hockey Event Tracker
// This file contains the default configuration for event buttons.


const LOCAL_STORAGE_KEY_CONFIG = 'fieldHockeyConfig_v1';
const LOCAL_STORAGE_KEY_NAMED_CONFIGS = 'fieldHockeyNamedConfigs_v1';

const DEFAULT_CONFIG = {
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

const BUILT_IN_NAMED_CONFIGS = {
    default: DEFAULT_CONFIG,
    'hockey-one': HOCKEY_ONE_CONFIG
};

const isValidConfig = (config) => Boolean(config && Array.isArray(config.rowDefs));

const cloneConfig = (config) => JSON.parse(JSON.stringify(config));

// Utility function to load configuration from localStorage or return the default
export function loadConfiguration() {
    try {
        const storedConfig = localStorage.getItem(LOCAL_STORAGE_KEY_CONFIG);
        return storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;
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

    let seeded = false;
    for (const [name, config] of Object.entries(BUILT_IN_NAMED_CONFIGS)) {
        if (!isValidConfig(stored[name])) {
            stored[name] = cloneConfig(config);
            seeded = true;
        }
    }

    if (seeded) {
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

// Stores a configuration under a name and makes it the active configuration
export function saveNamedConfig(name, config) {
    const trimmedName = String(name ?? '').trim();
    if (!trimmedName) {
        throw new Error('Configuration name is required.');
    }
    if (!isValidConfig(config)) {
        throw new Error('Invalid configuration structure.');
    }

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
