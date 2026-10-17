/**
 * Unit tests for named configuration storage
 */
import {
    loadConfiguration,
    listNamedConfigs,
    getNamedConfig,
    saveNamedConfig,
    activateNamedConfig,
    findNamedConfigName
} from '../../src/components/config.js';

const ACTIVE_KEY = 'fieldHockeyConfig_v1';
const NAMED_KEY = 'fieldHockeyNamedConfigs_v1';

const eventsOf = (config) => config.rowDefs.flatMap(row => row.buttons.map(button => button.event));

describe('named configurations', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        console.error.mockRestore();
    });

    test('seeds the built-in default and hockey-one configurations', () => {
        expect(listNamedConfigs()).toEqual(['default', 'hockey-one']);
        expect(JSON.parse(localStorage.getItem(NAMED_KEY))).toHaveProperty('hockey-one');
    });

    test('hockey-one uses team codes and excludes ball wins', () => {
        const events = eventsOf(getNamedConfig('hockey-one'));

        expect(events).toEqual(expect.arrayContaining([
            'START', 'END', 'UMP', 'FIRE GOAL', 'TIGERS YELLOW', 'FIRE BS1', 'TIGERS ASC', 'SO FIRE', 'SO TASSIE'
        ]));
        expect(events).toHaveLength(33);
        expect(events.some(event => /BW\d/.test(event))).toBe(false);
    });

    test('does not overwrite a user-saved built-in name', () => {
        const custom = { rowDefs: [{ gridCols: 'grid-cols-1', buttons: [{ event: 'X', text: 'X', color: 'btn-blue' }] }] };
        localStorage.setItem(NAMED_KEY, JSON.stringify({ 'hockey-one': custom }));

        expect(getNamedConfig('hockey-one')).toEqual(custom);
        expect(listNamedConfigs()).toContain('default');
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

    test('activateNamedConfig writes the named config to the active slot', () => {
        const config = activateNamedConfig('hockey-one');

        expect(JSON.parse(localStorage.getItem(ACTIVE_KEY))).toEqual(config);
        expect(loadConfiguration()).toEqual(config);
    });

    test('activateNamedConfig throws for an unknown name', () => {
        expect(() => activateNamedConfig('missing')).toThrow('No saved configuration named "missing".');
    });

    test('findNamedConfigName returns the saved name matching a layout', () => {
        expect(findNamedConfigName(getNamedConfig('hockey-one'))).toBe('hockey-one');
        expect(findNamedConfigName(loadConfiguration())).toBe('default');
    });

    test('findNamedConfigName returns null for unnamed or invalid layouts', () => {
        const unnamed = { rowDefs: [{ gridCols: 'grid-cols-1', buttons: [{ event: 'Z', text: 'Z', color: 'btn-gray' }] }] };

        expect(findNamedConfigName(unnamed)).toBeNull();
        expect(findNamedConfigName({ buttons: [] })).toBeNull();
        expect(findNamedConfigName(null)).toBeNull();
    });
});
