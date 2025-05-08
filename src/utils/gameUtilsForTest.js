// A simplified version of updateSavedGame for testing purposes
// This removes dependencies on other modules to simplify testing

import { storageService } from '../services/storageService.js';

export function updateSavedGame(index, updatedData, storageKey) {
    try {
        const savedGames = storageService.getItem(storageKey) || [];

        if (index >= 0 && index < savedGames.length) {
            // Update only the specified properties while preserving the rest
            savedGames[index] = { ...savedGames[index], ...updatedData };
            storageService.setItem(storageKey, savedGames);
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}
