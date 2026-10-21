/**
 * Unit tests for named configuration storage
 */
import {
    loadConfiguration,
    listNamedConfigs,
    getNamedConfig,
    saveNamedConfig,
    activateNamedConfig,
    findNamedConfigName,
    validateConfig,
    rowGrids,
    usesTeams,
    isBuiltInConfig,
    resetNamedConfigToDefault,
    deleteNamedConfig,
    RETIRED_BUILT_IN_CONFIGS
} from '../../src/components/config.js';

const ACTIVE_KEY = 'fieldHockeyConfig_v1';
const NAMED_KEY = 'fieldHockeyNamedConfigs_v1';

const eventsOf = (config) =>
    config.rowDefs.flatMap(row => rowGrids(row).flatMap(grid => grid.buttons.map(button => button.event)));

describe('named configurations', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        console.error.mockRestore();
    });

    test('seeds built-in configurations and uses hockey-one-zoned as the default', () => {
        expect(listNamedConfigs()).toEqual(['hockey-one-zoned', 'simple-starter']);
        expect(loadConfiguration()).toEqual(getNamedConfig('hockey-one-zoned'));
        expect(usesTeams(loadConfiguration())).toBe(true);
        expect(findNamedConfigName(loadConfiguration())).toBe('hockey-one-zoned');
    });

    test('replaces an active board that is still a retired built-in', () => {
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(RETIRED_BUILT_IN_CONFIGS['hockey-one']));

        expect(loadConfiguration()).toEqual(getNamedConfig('hockey-one-zoned'));
        expect(JSON.parse(localStorage.getItem(ACTIVE_KEY))).toEqual(getNamedConfig('hockey-one-zoned'));
    });

    test('removes previously seeded default and hockey-one boards that are still the original', () => {
        localStorage.setItem(NAMED_KEY, JSON.stringify({
            default: RETIRED_BUILT_IN_CONFIGS.default,
            'hockey-one': RETIRED_BUILT_IN_CONFIGS['hockey-one']
        }));

        expect(listNamedConfigs()).toEqual(['hockey-one-zoned', 'simple-starter']);
        expect(JSON.parse(localStorage.getItem(NAMED_KEY))).not.toHaveProperty('default');
        expect(JSON.parse(localStorage.getItem(NAMED_KEY))).not.toHaveProperty('hockey-one');
    });

    test('hockey-one-zoned has four mirrored zones, per-team action rows and one shared scoring row', () => {
        const config = getNamedConfig('hockey-one-zoned');

        expect(config.zones).toEqual({ values: ['1', '2', '3', '4'], default: '1', perspective: 'mirrored' });
        expect(config.rowDefs.filter(row => row.team === 1)).toHaveLength(1);
        expect(config.rowDefs.filter(row => row.team === 2)).toHaveLength(1);
        expect(config.rowDefs.filter(row => row.team === 'selected')).toHaveLength(1);
        expect(usesTeams(config)).toBe(true);
        expect(() => validateConfig(config)).not.toThrow();

        const zoned = config.rowDefs.flatMap(row => rowGrids(row).flatMap(grid => grid.buttons))
            .filter(button => button.zoned)
            .map(button => button.event);
        expect([...new Set(zoned)]).toEqual(['BS', 'BW']);
        expect(eventsOf(config)).toEqual(expect.arrayContaining(['START', 'END', 'UMP', 'SO', 'GREEN', 'PC']));
    });

    test('simple-starter has dedicated team rows with 6 essentials and no sticky zones', () => {
        const config = getNamedConfig('simple-starter');

        expect(config.zones).toBeUndefined();
        expect(config.rowDefs.filter(row => row.team === 1)).toHaveLength(1);
        expect(config.rowDefs.filter(row => row.team === 2)).toHaveLength(1);
        expect(config.rowDefs.some(row => row.team === 'selected')).toBe(false);
        expect(usesTeams(config)).toBe(true);
        expect(() => validateConfig(config)).not.toThrow();

        const team1Buttons = config.rowDefs.find(r => r.team === 1).grids[0].buttons.map(b => b.event);
        const team2Buttons = config.rowDefs.find(r => r.team === 2).grids[0].buttons.map(b => b.event);
        expect(team1Buttons).toEqual(['A25E', 'CE', 'SHOT', 'PC', 'GOAL', 'CARD']);
        expect(team2Buttons).toEqual(['A25E', 'CE', 'SHOT', 'PC', 'GOAL', 'CARD']);

        const headerButtons = config.rowDefs[0].buttons.map(b => b.event);
        expect(headerButtons).toEqual(['START', 'END']);
    });

    test('hockey-one-zoned buttons carry the MyVA lead and lag times', () => {
        const buttons = getNamedConfig('hockey-one-zoned').rowDefs
            .flatMap(row => rowGrids(row).flatMap(grid => grid.buttons));
        const timing = (event) => {
            const matches = buttons.filter(button => button.event === event);
            const timings = [...new Set(matches.map(({ lead, lag }) => JSON.stringify({ lead, lag })))];
            expect(timings).toHaveLength(1);
            return JSON.parse(timings[0]);
        };

        expect(timing('START')).toEqual({ lead: 1, lag: 1 });
        expect(timing('UMP')).toEqual({ lead: 7, lag: 7 });
        expect(timing('BS')).toEqual({ lead: 10, lag: 10 });
        expect(timing('SHOT')).toEqual({ lead: 15, lag: 5 });
        expect(timing('ASC')).toEqual({ lead: 10, lag: 1 });
        expect(timing('PC')).toEqual({ lead: 2, lag: 10 });
        expect(timing('YELLOW')).toEqual({ lead: 20, lag: 360 });
        expect(timing('BW')).toEqual({});
        expect(timing('RED')).toEqual({});
    });

    test('usesTeams is false for boards without team rows', () => {
        const flat = { rowDefs: [{ gridCols: 'grid-cols-1', buttons: [{ event: 'GOAL', text: 'GOAL' }] }] };
        expect(usesTeams(flat)).toBe(false);
        expect(usesTeams(null)).toBe(false);
    });

    test('does not overwrite a user-saved built-in name', () => {
        const custom = { rowDefs: [{ gridCols: 'grid-cols-1', buttons: [{ event: 'X', text: 'X', color: 'btn-blue' }] }] };
        localStorage.setItem(NAMED_KEY, JSON.stringify({ 'hockey-one-zoned': custom, 'hockey-one': custom }));

        expect(getNamedConfig('hockey-one-zoned')).toEqual(custom);
        expect(getNamedConfig('hockey-one')).toEqual(custom);
        expect(listNamedConfigs()).toEqual(['hockey-one', 'hockey-one-zoned', 'simple-starter']);
    });

    test('isBuiltInConfig returns true for built-in configurations and false for others', () => {
        expect(isBuiltInConfig('hockey-one-zoned')).toBe(true);
        expect(isBuiltInConfig('simple-starter')).toBe(true);
        expect(isBuiltInConfig('custom-board')).toBe(false);
        expect(isBuiltInConfig('')).toBe(false);
        expect(isBuiltInConfig(null)).toBe(false);
    });

    test('saveNamedConfig rejects overwriting built-in configurations', () => {
        const config = { rowDefs: [{ gridCols: 'grid-cols-1', buttons: [{ event: 'A', text: 'A', color: 'btn-red' }] }] };

        expect(() => saveNamedConfig('hockey-one-zoned', config)).toThrow(
            'Cannot overwrite built-in configuration "hockey-one-zoned". Use "Save as" to save under a new name.'
        );
        expect(() => saveNamedConfig('simple-starter', config)).toThrow(
            'Cannot overwrite built-in configuration "simple-starter". Use "Save as" to save under a new name.'
        );
    });

    test('resetNamedConfigToDefault restores a built-in configuration to factory default', () => {
        const custom = { rowDefs: [{ gridCols: 'grid-cols-1', buttons: [{ event: 'OVERRIDDEN', text: 'OVERRIDDEN' }] }] };
        localStorage.setItem(NAMED_KEY, JSON.stringify({ 'hockey-one-zoned': custom }));

        expect(getNamedConfig('hockey-one-zoned')).toEqual(custom);
        resetNamedConfigToDefault('hockey-one-zoned');
        expect(getNamedConfig('hockey-one-zoned')).not.toEqual(custom);
        expect(getNamedConfig('hockey-one-zoned').zones).toBeDefined();

        expect(() => resetNamedConfigToDefault('unknown-name')).toThrow('"unknown-name" is not a built-in configuration.');
    });

    test('saveNamedConfig stores the config under a trimmed name and makes it active', () => {
        const config = { rowDefs: [{ gridCols: 'grid-cols-1', buttons: [{ event: 'A', text: 'A', color: 'btn-red' }] }] };

        expect(saveNamedConfig('  my-layout ', config)).toBe(true);
        expect(listNamedConfigs()).toContain('my-layout');
        expect(getNamedConfig('my-layout')).toEqual(config);
        expect(JSON.parse(localStorage.getItem(ACTIVE_KEY))).toEqual(config);
    });

    test('saveNamedConfig rejects empty names and invalid configs', () => {
        expect(() => saveNamedConfig('   ', { rowDefs: [] })).toThrow('Configuration name is required.');
        expect(() => saveNamedConfig('bad', { buttons: [] })).toThrow('Invalid configuration structure.');
    });


    test('deleteNamedConfig deletes custom configurations', () => {
        const config = { rowDefs: [{ gridCols: 'grid-cols-1', buttons: [{ event: 'A', text: 'A' }] }] };
        saveNamedConfig('to-be-deleted', config);
        expect(listNamedConfigs()).toContain('to-be-deleted');

        expect(deleteNamedConfig('to-be-deleted')).toBe(true);
        expect(listNamedConfigs()).not.toContain('to-be-deleted');
        expect(deleteNamedConfig('to-be-deleted')).toBe(false);
    });

    test('deleteNamedConfig rejects deleting built-in configurations', () => {
        expect(() => deleteNamedConfig('hockey-one-zoned')).toThrow('Cannot delete built-in configuration "hockey-one-zoned".');
        expect(() => deleteNamedConfig('simple-starter')).toThrow('Cannot delete built-in configuration "simple-starter".');
    });

    test('activateNamedConfig writes the named config to the active slot', () => {
        const config = activateNamedConfig('hockey-one-zoned');

        expect(JSON.parse(localStorage.getItem(ACTIVE_KEY))).toEqual(config);
        expect(loadConfiguration()).toEqual(config);
    });

    test('activateNamedConfig throws for an unknown name', () => {
        expect(() => activateNamedConfig('missing')).toThrow('No saved configuration named "missing".');
    });

    test('findNamedConfigName returns the saved name matching a layout', () => {
        expect(findNamedConfigName(getNamedConfig('hockey-one-zoned'))).toBe('hockey-one-zoned');
        expect(findNamedConfigName(loadConfiguration())).toBe('hockey-one-zoned');
    });

    test('findNamedConfigName returns null for unnamed or invalid layouts', () => {
        const unnamed = { rowDefs: [{ gridCols: 'grid-cols-1', buttons: [{ event: 'Z', text: 'Z', color: 'btn-gray' }] }] };

        expect(findNamedConfigName(unnamed)).toBeNull();
        expect(findNamedConfigName({ buttons: [] })).toBeNull();
        expect(findNamedConfigName(null)).toBeNull();
    });
});

describe('validateConfig', () => {
    const withButton = (button) => ({
        rowDefs: [{ gridCols: 'grid-cols-1', buttons: [{ event: 'BLAZE PC', text: 'BLAZE PC', color: 'btn-orange', ...button }] }]
    });

    test('accepts buttons with and without lead and lag', () => {
        expect(() => validateConfig(withButton({}))).not.toThrow();
        expect(() => validateConfig(withButton({ lead: 2, lag: 10 }))).not.toThrow();
        expect(() => validateConfig(withButton({ lead: 0, lag: 1.5 }))).not.toThrow();
    });

    test('rejects negative or non-numeric lead and lag, naming the event', () => {
        expect(() => validateConfig(withButton({ lead: -1 }))).toThrow('BLAZE PC: lead must be a number of 0 or more.');
        expect(() => validateConfig(withButton({ lag: '10' }))).toThrow('BLAZE PC: lag must be a number of 0 or more.');
        expect(() => validateConfig(withButton({ lag: null }))).toThrow('BLAZE PC: lag must be a number of 0 or more.');
    });

    test('rejects configs without rowDefs', () => {
        expect(() => validateConfig({ buttons: [] })).toThrow('Invalid configuration structure.');
    });

    test('validates lead and lag inside multi-grid rows', () => {
        const config = {
            rowDefs: [{ team: 1, grids: [{ gridCols: 'grid-cols-1', buttons: [{ event: 'GOAL', text: 'GOAL', lag: -1 }] }] }]
        };
        expect(() => validateConfig(config)).toThrow('GOAL: lag must be a number of 0 or more.');
    });

    test('accepts team rows whose buttons omit color', () => {
        const config = { rowDefs: [{ team: 2, gridCols: 'grid-cols-1', buttons: [{ event: 'GOAL', text: 'GOAL' }] }] };
        expect(() => validateConfig(config)).not.toThrow();
    });

    test('rejects team slots other than 1, 2 or "selected"', () => {
        const row = (team) => ({ rowDefs: [{ team, gridCols: 'grid-cols-1', buttons: [] }] });
        expect(() => validateConfig(row(3))).toThrow('Row team must be 1, 2 or "selected".');
        expect(() => validateConfig(row('selected'))).not.toThrow();
    });

    test('rejects zoned buttons without a zones block', () => {
        expect(() => validateConfig(withButton({ zoned: true })))
            .toThrow('BLAZE PC: zoned buttons need a zones block in the configuration.');
    });

    test('rejects malformed zones blocks', () => {
        const withZones = (zones) => ({ ...withButton({ zoned: true }), zones });

        expect(() => validateConfig(withZones({ values: [] }))).toThrow('zones.values must be a non-empty list.');
        expect(() => validateConfig(withZones({ values: ['1', '2'], default: '3' })))
            .toThrow('zones.default must be one of zones.values.');
        expect(() => validateConfig(withZones({ values: ['1', '2'], perspective: 'sideways' })))
            .toThrow('zones.perspective must be one of: mirrored, pitch.');
        expect(() => validateConfig(withZones({ values: ['1', '2'], perspective: 'pitch' }))).not.toThrow();
    });

    test('saveNamedConfig rejects invalid lead and lag', () => {
        expect(() => saveNamedConfig('bad-timing', withButton({ lag: -5 }))).toThrow('lag must be a number of 0 or more');
        expect(listNamedConfigs()).not.toContain('bad-timing');
    });
});
