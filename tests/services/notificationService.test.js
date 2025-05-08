/**
 * Unit tests for the notification service
 */
import { notificationService } from '../../src/services/notificationService.js';

// Set up Jest fake timers
jest.useFakeTimers();

// Create document body for testing DOM manipulations
beforeEach(() => {
    // Set up a fresh body element for each test
    document.body.innerHTML = '';
});

// Mock window methods
const originalAlert = window.alert;
const originalConfirm = window.confirm;
const originalPrompt = window.prompt;

beforeAll(() => {
    window.alert = jest.fn();
    window.confirm = jest.fn();
    window.prompt = jest.fn();
});

afterAll(() => {
    window.alert = originalAlert;
    window.confirm = originalConfirm;
    window.prompt = originalPrompt;
});

// Clear mocks after each test
afterEach(() => {
    jest.clearAllMocks();
});

describe('Notification Service', () => {
    test('notify should create notification element with success styling', () => {
        const notification = notificationService.notify('Test notification', 'success');

        expect(notification).toBeTruthy();
        expect(notification.textContent).toBe('Test notification');
        expect(notification.classList.contains('bg-green-600')).toBe(true);
        expect(notification.classList.contains('text-white')).toBe(true);
        expect(document.body.children.length).toBe(1);
    });

    test('notify should create notification element with error styling', () => {
        const notification = notificationService.notify('Error notification', 'error');

        expect(notification).toBeTruthy();
        expect(notification.textContent).toBe('Error notification');
        expect(notification.classList.contains('bg-red-600')).toBe(true);
        expect(notification.classList.contains('text-white')).toBe(true);
    });

    test('notify should create notification element with warning styling', () => {
        const notification = notificationService.notify('Warning notification', 'warning');

        expect(notification).toBeTruthy();
        expect(notification.textContent).toBe('Warning notification');
        expect(notification.classList.contains('bg-yellow-500')).toBe(true);
        expect(notification.classList.contains('text-white')).toBe(true);
    });

    test('notify should remove duplicate notifications', () => {
        // Create two notifications with the same message
        const notification1 = notificationService.notify('Duplicate notification');
        const notification2 = notificationService.notify('Duplicate notification');

        // Should be only one notification in the DOM
        expect(document.body.children.length).toBe(1);
        expect(document.body.firstChild).toBe(notification2);
    });

    test('confirm should call window.confirm and return result', () => {
        window.confirm.mockReturnValueOnce(true);

        const result = notificationService.confirm('Confirm test');

        expect(window.confirm).toHaveBeenCalledWith('Confirm test');
        expect(result).toBe(true);
    });

    test('prompt should call window.prompt and return result', () => {
        window.prompt.mockReturnValueOnce('User input');

        const result = notificationService.prompt('Prompt test', 'Default');

        expect(window.prompt).toHaveBeenCalledWith('Prompt test', 'Default');
        expect(result).toBe('User input');
    });

    test('alert should call window.alert', () => {
        notificationService.alert('Alert test');

        expect(window.alert).toHaveBeenCalledWith('Alert test');
    });

    test('showMessage should update element content and classes', () => {
        // Create a target element
        const element = document.createElement('div');
        document.body.appendChild(element);

        notificationService.showMessage(element, 'Test message');

        expect(element.textContent).toBe('Test message');
        expect(element.classList.contains('config-success')).toBe(true);
        expect(element.classList.contains('hidden')).toBe(false);

        // Fast-forward time to check hiding
        jest.advanceTimersByTime(5000);

        expect(element.classList.contains('hidden')).toBe(true);
    });

    test('showMessage should handle error styling', () => {
        // Create a target element
        const element = document.createElement('div');
        document.body.appendChild(element);

        notificationService.showMessage(element, 'Error message', true);

        expect(element.textContent).toBe('Error message');
        expect(element.classList.contains('config-error')).toBe(true);
    });

    test('showMessage should fall back to notify if element is null', () => {
        // Mock notify method
        const originalNotify = notificationService.notify;
        notificationService.notify = jest.fn();

        notificationService.showMessage(null, 'Fallback message');

        expect(notificationService.notify).toHaveBeenCalledWith('Fallback message', 'success');

        // Restore original
        notificationService.notify = originalNotify;
    });
});
