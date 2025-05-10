# Current User Experience and Workflow for the Game Tracker

## Current User Experience

The current user experience for creating and retrieving games follows this lifecycle:

1. **Starting a Game**:
   - The user navigates to the Event Capture page.
   - The game session begins when the user clicks the "Start Game" button. This action enables event buttons and starts the timer.

2. **Recording Events**:
   - During the session, the user can log events by clicking the event buttons. These events are recorded with timestamps relative to the session's elapsed time.

3. **Completing a Game**:
   - Once the session is complete, the user clicks the "Complete" button (replacing the Reset button on the Event Capture page). This action:
     - Saves the current game state (events and elapsed time) to `localStorage`.
     - Resets the game to its default, empty state, clearing the timer and event log.

4. **Loading a Game**:
   - If no session is currently active (i.e., the timer is stopped and no elapsed time is recorded), the "Load Game" button on the Log page becomes available.
   - Clicking "Load Game" retrieves the saved game state from `localStorage` and restores the events and elapsed time to the application.

5. **Reviewing a Game**:
   - The user can review the game by navigating to the Match Review page.
   - The timeline panel displays all recorded events, and the video player allows synchronized playback of the match footage.

This flow ensures that users can efficiently manage game sessions while preventing conflicts between active and saved states.
