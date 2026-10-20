# Match Review Timeline Video Feature Documentation

The Match Review Timeline Video feature allows coaches, players, and analysts to review game events synchronized with video footage, enabling detailed analysis of field hockey matches.

## Overview

The Match Review interface combines a timeline panel that displays recorded game events with a video player that can be navigated based on these events. This integration provides a powerful tool for post-match analysis, player development, and strategy planning.

## Key Components

### Timeline Panel (Left Side)

The Timeline panel provides a chronological view of all recorded match events:

- **Game Title**: The game chosen from the Saved Games list is loaded automatically. Its name is the page heading above the video and the tag list, kept to one line so a long name does not push the tags down. Hover the heading to read the full name. To review a different game, return to Saved Games
- **Event Filtering**: Filter timeline events by type to focus on specific aspects of play. Active filters show as compact tags under the dropdown
- **Saved tags**: A single-line list. Each row is the time, the tag name, a favorite star, and delete. The list scrolls inside the side panel on a laptop, and under the video on a phone
- **Event Interaction**: Click a tag to jump to that moment in the video

### Video Player (Right Side)

The video player section allows you to:

- **Upload Video**: Add match footage via the "Upload Video" button in the toolbar
- **Add tag**: With a video loaded, "Add tag" sits in the toolbar so it does not cover the player controls
- **Standard Controls**: Play, pause, skip, and adjust volume using the player controls under the picture
- **Synchronized Playback**: The video automatically jumps to the timestamp of selected events
- **Support for Common Formats**: Compatible with standard video formats (MP4, WebM, etc.)

## How to Use

1. **Select a Game**:
   - Open **Saved Games** from the navigation bar and click **Review** (or the game's name)
   - Match Review opens at `timeline-video.html?game=<id>` with that game's events in the timeline
   - To review another match, go back to Saved Games and choose it there
   - View log, Export XML, Rename, and Delete are in each game's **More** menu on the Saved Games list

2. **Filter Events** (if needed):
   - Click the filter dropdown to select specific event types
   - Use the "All events" checkbox to quickly toggle between all events and filtered view
   - Apply filters using the blue button at the bottom of the dropdown
   - View currently active filters via tags displayed below the dropdown

3. **Upload Match Video**:
   - Click the "Upload Video" button to add footage for the selected game
   - Compatible formats will automatically load into the player

4. **Navigate Through Events**:
   - Scroll through the timeline to view all recorded events
   - Click on any event to jump to that specific moment in the video
   - Use the video player controls for fine-tuned navigation

5. **Review and Analyze**:
   - Use the synchronized system to analyze specific plays, techniques, or tactical situations
   - Navigate between key moments without manually searching through footage

## Best Practices

- For optimal performance, use compressed video formats
- Consider filtering events by type when focusing on specific aspects (e.g., only penalties or goals)
- Use the timeline to quickly navigate between important game moments rather than manually scrubbing through video

## Technical Notes

- Video files are processed client-side without being uploaded to any server
- Game data is stored locally in your browser's storage
- Supported video formats depend on your browser (MP4 is universally supported)
