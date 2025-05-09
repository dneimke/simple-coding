/**
 * Unit tests for the state service
 */
import { stateService } from '../../src/services/stateService.js';

describe('State Service', () => {
    beforeEach(() => {
        // Reset state before each test
        stateService._state = {
            testSection: {
                value: 'initial',
                nested: {
                    value: 123
                }
            }
        };
        stateService._subscribers = {};
    });

    test('getState returns entire state when no path is provided', () => {
        const state = stateService.getState();
        expect(state).toEqual({
            testSection: {
                value: 'initial',
                nested: {
                    value: 123
                }
            }
        });
    });

    test('getState returns specific state slice when path is provided', () => {
        expect(stateService.getState('testSection.value')).toBe('initial');
        expect(stateService.getState('testSection.nested.value')).toBe(123);
    });

    test('setState updates state at the specified path', () => {
        stateService.setState('testSection.value', 'updated');
        expect(stateService.getState('testSection.value')).toBe('updated');

        stateService.setState('testSection.nested.value', 456);
        expect(stateService.getState('testSection.nested.value')).toBe(456);
    });

    test('setState with merge=true merges objects', () => {
        stateService.setState('testSection', { newProp: 'added' }, true);
        expect(stateService.getState('testSection')).toEqual({
            value: 'initial',
            nested: {
                value: 123
            },
            newProp: 'added'
        });
    });

    test('setState creates intermediate objects for deep paths', () => {
        stateService.setState('testSection.newNested.deepValue', 'deep');
        expect(stateService.getState('testSection.newNested.deepValue')).toBe('deep');
    });

    test('subscribe calls handler when state changes', () => {
        const mockHandler = jest.fn();
        stateService.subscribe('testSection.value', mockHandler);

        stateService.setState('testSection.value', 'new value');

        expect(mockHandler).toHaveBeenCalledWith('new value');
    });

    test('subscribe returns unsubscribe function', () => {
        const mockHandler = jest.fn();
        const unsubscribe = stateService.subscribe('testSection', mockHandler);

        // First update - handler should be called
        stateService.setState('testSection.value', 'first update');
        expect(mockHandler).toHaveBeenCalledTimes(1);

        // Unsubscribe
        unsubscribe();

        // Second update - handler should not be called
        stateService.setState('testSection.value', 'second update');
        expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    test('parent path subscribers are notified when nested values change', () => {
        const mockParentHandler = jest.fn();
        const mockChildHandler = jest.fn();

        stateService.subscribe('testSection', mockParentHandler);
        stateService.subscribe('testSection.nested.value', mockChildHandler);

        stateService.setState('testSection.nested.value', 999);

        expect(mockChildHandler).toHaveBeenCalledWith(999);
        expect(mockParentHandler).toHaveBeenCalled();
    });

    test('getState handles non-existent paths', () => {
        expect(stateService.getState('nonExistentPath')).toBeNull();
        expect(stateService.getState('testSection.nonExistentPath')).toBeNull();
    });
});
