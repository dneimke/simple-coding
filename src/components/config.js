// Configuration file for the Field Hockey Event Tracker
// This file contains the default configuration for event buttons.


const LOCAL_STORAGE_KEY_CONFIG = 'fieldHockeyConfig_v1';

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
