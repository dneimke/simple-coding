# Field Hockey Event Tracker

The **Field Hockey Event Tracker** is a web application designed to help users track, log, and analyze events during a field hockey game. The application provides an intuitive interface for recording events, configuring custom buttons, viewing a timeline of events, and exporting logs in XML format.

## Application Pages

### 1. Tracker Page

The Tracker page is the main interface for recording events during a game. It includes:

- A **timer** to track the elapsed game time.
- Buttons for recording predefined events, which can be customized in the Configure page.
- Options to start, pause, and reset the timer.

![Tracker Page](images/field-hockey-tracker.png)

### 2. Configure Page

The Configure page allows users to customize the event buttons displayed on the Tracker page. Features include:

- A JSON editor to define button groups, labels, and colors.
- Options to save the configuration to local storage or load the default configuration.

### 3. Timeline Page

The Timeline page provides a visual representation of recorded events along with video playback. Features include:

- Drag-and-drop functionality to load a video file.
- A timeline view that maps events to specific timestamps in the video.
- Interactive markers to jump to specific moments in the video.

![Timeline Page](images/field-hockey-timeline.png)

### 4. Log Page

The Log page displays a detailed list of recorded events and provides options to export the log in XML format. Features include:

- A **List View** for a chronological display of events.
- An **XML View** for exporting events in XML format.
- Options to copy the XML to the clipboard or clear the log.

## How to Use

1. Navigate to the **Tracker** page to start recording events.
2. Use the **Configure** page to customize the event buttons.
3. Load a video on the **Timeline** page to analyze events alongside video playback.
4. View and export recorded events on the **Log** page.

## Technologies Used

- **HTML** and **CSS** for the user interface.
- **JavaScript** for functionality and interactivity.
- **Tailwind CSS** for styling.

## Images

The images used in this README are located in the `images/` folder of the project.
