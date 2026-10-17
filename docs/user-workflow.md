# Current User Experience and Workflow for the Game Tracker

## Current User Experience

The current user experience for creating and retrieving games follows this lifecycle:

1. **Choosing a board**:
   - The **Board** selector above the buttons on the Event Capture page lists the saved configurations, including the built-in `hockey-one` and `hockey-one-zoned`. Picking one makes it the active configuration (the same as saving it on the Configure page).
   - The selector is locked while a game is in progress; complete or discard the game to change board.
   - `hockey-one-zoned` is the [sticky zone board](feat/sticky-zones/spec.md): a zone bar (Zones 1-4, from Team 1's perspective) replaces the per-zone BS buttons. BS and BW log the active zone, mirrored for Team 2, e.g. `FIRE BS2` and `TIGERS BS3`. Tap a zone or press 1-4 to change it. Zone changes are not logged.
   - On `hockey-one-zoned` the scoring and card buttons (APS, PS, GOAL, SO, GREEN, YELLOW, RED) are a single set with a team toggle. Tap a team (or press T) and the buttons log for that team, e.g. `PERTH GOAL`, until you switch again.

2. **Starting a Game**:
   - The user navigates to the Event Capture page.
   - The game session begins when the user clicks the "Start Game" button. This action enables event buttons and starts the timer.
   - On a board with team rows (such as `hockey-one-zoned`), Start first asks for a code and colour for Team 1 and Team 2. Every team event is logged as `{CODE} {EVENT}`, and the codes are remembered for the next game.

3. **Recording Events**:
   - During the session, the user can log events by clicking the event buttons. These events are recorded with timestamps relative to the session's elapsed time.

4. **Completing a Game**:
   - Once the session is complete, the user clicks the "Complete" button (replacing the Reset button on the Event Capture page). This action:
     - Saves the current game state (events and elapsed time) to `localStorage`.
     - Resets the game to its default, empty state, clearing the timer and event log.

5. **Loading a Game**:
   - If no session is currently active (i.e., the timer is stopped and no elapsed time is recorded), the "Load Game" button on the Log page becomes available.
   - Clicking "Load Game" retrieves the saved game state from `localStorage` and restores the events and elapsed time to the application.

6. **Direct Navigation (Deep Linking)**:
   - The application supports direct navigation to specific views using URL hash fragments.
   - Users can bookmark specific views or share links that go directly to a particular view.
   - Available deep links:
     - `index.html#event-capture` - Navigate to the Event Capture view
     - `index.html#log` - Navigate to the Log view (requires an active game)
     - `index.html#log/<id>` - Navigate to the read-only Log view for a saved game
     - `index.html#configure` - Navigate to the Configure view
     - `index.html#saved-games` - Navigate to the Saved Games view
   - The navigation system will automatically redirect to the Event Capture view if trying to access the Log view without an active game.

7. **Reviewing a Game**:
   - The user opens the Saved Games view and selects a game, which opens it in Match Review (`timeline-video.html?game=<id>`). Match Review is not a separate navigation item.
   - Clicking **View Log** on a saved game opens the Log view (Timeline, XML, and Statistics tabs) for that game at `index.html#log/<id>`. A banner names the saved game and links back to Saved Games. This is read-only and does not replace a game in progress.
   - Export, Rename, and Delete actions remain on the Saved Games list.
   - **Export XML** downloads the game as a Sportscode XML file (`<file>` with `<ALL_INSTANCES>` and `<ROWS>`). Teams, date and favourites are not included.
   - **Import XML** accepts Sportscode XML files, as well as files in the older `<game><events>` format. Because Sportscode files carry no teams, the teams prompt defaults to the file name.
   - The timeline panel displays all recorded events, and the video player allows synchronized playback of the match footage.
   - From the Match Review page, deep links allow returning directly to specific views in the main application.

This flow ensures that users can efficiently manage game sessions while preventing conflicts between active and saved states. For more details on the navigation system, see [Navigation](navigation.md).
