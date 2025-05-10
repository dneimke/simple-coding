# Import XML to Saved Games

## Requirements

### Functional Requirements

1. **File Upload Interface**:
   - Provide a button or input field to allow users to upload an XML file.
   - Validate the uploaded file to ensure it is in XML format.

2. **XML Parsing**:
   - Parse the uploaded XML file to extract relevant event data.
   - Ensure the XML structure matches the expected format (e.g., events with timestamps).

3. **Event Conversion**:
   - Convert the parsed XML data into the format used for storing events in the application.
   - Each event should include attributes like `event`, `timeMs`, and any other required fields.

4. **Save to Local Storage**:
   - Add the converted events as a new saved game in local storage.
   - Use the existing `LOCAL_STORAGE_KEY_GAMES` key to store the new game.

5. **Error Handling**:
   - Display user-friendly error messages for invalid XML files or parsing issues.
   - Handle edge cases like empty files, malformed XML, or missing required fields.

6. **UI Feedback**:
   - Notify the user of successful imports or errors.
   - Update the Saved Games list dynamically after a successful import.

---

## Implementation Plan

### 1. **UI Changes**

- Add a new button labeled "Import XML" in the **Saved Games View**.
- Include a hidden file input element for uploading files.

   ```html
   <!-- filepath: c:\repos\github\coding-tool\index.html -->
   <div id="saved-games-view" class="hidden">
       <h1 class="text-2xl sm:text-3xl font-bold mb-6 text-gray-800">Saved Games</h1>
       <div id="savedGamesList" class="mb-4"></div>
       <button id="importXmlButton" class="event-button btn-blue px-6 py-2">Import XML</button>
       <input id="xmlFileInput" type="file" accept=".xml" class="hidden">
   </div>
   ```

### 2. **XML Parsing Logic**

- Implement a function to parse the XML file and extract instance data.

   ```javascript
   // filepath: c:\repos\github\coding-tool\utils.js
   function parseXmlToEvents(xmlContent) {
       const parser = new DOMParser();
       const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
       const instanceNodes = Array.from(xmlDoc.getElementsByTagName('instance'));

       const events = instanceNodes.map(node => {
           const id = node.getElementsByTagName('ID')[0]?.textContent;
           const start = node.getElementsByTagName('start')[0]?.textContent;
           const end = node.getElementsByTagName('end')[0]?.textContent;
           const code = node.getElementsByTagName('code')[0]?.textContent;

           if (id && start && end && code) {
               return {
                   ID: parseInt(id, 10),
                   start: parseInt(start, 10),
                   end: parseInt(end, 10),
                   code
               };
           }
           return null;
       }).filter(Boolean);

       return events;
   }
   ```

### 3. **Enhanced Validation and Feedback**

- Implement a function to validate the XML structure before parsing.

   ```javascript
   function validateXmlStructure(xmlContent) {
       const parser = new DOMParser();
       const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
       const parseError = xmlDoc.querySelector('parsererror');

       if (parseError) {
           throw new Error('Invalid XML format.');
       }

       const instanceNodes = xmlDoc.getElementsByTagName('instance');
       if (instanceNodes.length === 0) {
           throw new Error('No instances found in the XML file.');
       }

       for (const node of instanceNodes) {
           const id = node.getElementsByTagName('ID')[0]?.textContent;
           const start = node.getElementsByTagName('start')[0]?.textContent;
           const end = node.getElementsByTagName('end')[0]?.textContent;
           const code = node.getElementsByTagName('code')[0]?.textContent;

           if (!id || !start || !end || !code) {
               throw new Error('Invalid instance data in XML.');
           }
       }

       return xmlDoc;
   }
   ```

### 4. **Event Listener for File Upload**

- Attach an event listener to the "Import XML" button to trigger the file input.
- Read the uploaded file, validate its content, and pass it to the XML parser.
- Display a preview of the parsed events before saving them to local storage.

   ```javascript
   // filepath: c:\repos\github\coding-tool\utils.js
   const importXmlButton = document.getElementById('importXmlButton');
   const xmlFileInput = document.getElementById('xmlFileInput');

   importXmlButton.addEventListener('click', () => {
       xmlFileInput.click();
   });

   xmlFileInput.addEventListener('change', async (event) => {
       const file = event.target.files[0];
       if (file) {
           try {
               const xmlContent = await file.text();
               const xmlDoc = validateXmlStructure(xmlContent); // Validate XML structure
               const events = parseXmlToEvents(xmlDoc); // Parse validated XML
               showPreview(events); // Pass parsed events to the preview function
           } catch (error) {
               console.error('Error importing XML:', error);
               alert(`Failed to import XML: ${error.message}`);
           }
       }
   });
   ```

### 5. **Preview and Confirmation**

- Display a preview of the parsed events in a modal or dedicated section.
- Pass the parsed events as a parameter to the "Confirm" button's event listener.

   ```javascript
   function showPreview(events) {
       const previewContainer = document.getElementById('previewContainer');
       previewContainer.innerHTML = events.map(event => `
           <div class="event-preview">
               <p>Event: ${event.event}</p>
               <p>Time (ms): ${event.timeMs}</p>
           </div>
       `).join('');
       document.getElementById('previewModal').classList.remove('hidden');

       // Pass parsed events to the confirm button's event listener
       setupConfirmButton(events);
   }   function setupConfirmButton(parsedEvents) {
       const confirmButton = document.getElementById('confirmImportButton');
       confirmButton.onclick = () => {
           // Using gameStorageManager for saving games
           gameStorageManager.saveGame({
               events: parsedEvents,
               elapsedTime: calculateElapsedTime(parsedEvents),
               timestamp: new Date().toISOString()
           });
           renderSavedGamesList();
           alert('XML imported successfully!');
           document.getElementById('previewModal').classList.add('hidden');
       };
   }
   ```

   ```html
   <!-- filepath: c:\repos\github\coding-tool\index.html -->
   <div id="previewModal" class="hidden">
       <div class="modal-content">
           <h2 class="text-xl font-bold">Preview Imported Events</h2>
           <div id="previewContainer"></div>
           <button id="confirmImportButton" class="btn-green">Confirm</button>
           <button id="cancelImportButton" class="btn-red">Cancel</button>
       </div>
   </div>
   ```

   ```javascript
   document.getElementById('cancelImportButton').addEventListener('click', () => {
       document.getElementById('previewModal').classList.add('hidden');
       alert('Import canceled.');
   });
   ```

---

## Testing Plan

1. **Valid XML File**:
   - Upload an XML file with valid event data and verify that the events are added to the Saved Games list.

2. **Invalid XML File**:
   - Test with malformed XML or missing attributes and ensure appropriate error messages are displayed.

3. **Edge Cases**:
   - Test with an empty file, duplicate events, or extremely large files.
   - Ensure that the application handles these cases gracefully without crashing.
   - Handling duplicate events or malformed XML

4. **UI Feedback**:
   - Verify that success and error messages are displayed correctly.

---

## Example XML File Format

```xml
<instances>
   <instance>
       <ID>1</ID>
       <start>0</start>
       <end>10</end>
       <code>PRESS</code>
   </instance>
   <instance>
       <ID>2</ID>
       <start>1</start>
       <end>11</end>
       <code>PRESS</code>
   </instance>
   <instance>
       <ID>3</ID>
       <start>2</start>
       <end>12</end>
       <code>OUTLET</code>
   </instance>
</instances>
```

## Backlog of Ideas to Enhance the Import Data Feature

1. **Drag-and-Drop Support**:
   - Allow users to drag and drop XML files directly into the Saved Games view for a more intuitive interaction.
   - Provide visual feedback (e.g., a highlighted drop zone) when a file is dragged over the area.

2. **File Validation Before Upload**:
   - Validate the file type and size before parsing to prevent unnecessary errors.
   - Display a clear error message if the file is not an XML or exceeds a certain size limit.

3. **Preview Imported Data**:
   - Show a preview of the parsed events before saving them to local storage.
   - Allow users to confirm or cancel the import after reviewing the data.

4. **Error Highlighting**:
   - If the XML file contains errors, highlight the problematic sections in the file or provide detailed error messages.
   - Suggest corrections or provide a sample XML format for reference.

5. **Batch Import**:
   - Support importing multiple XML files at once, combining their events into separate saved games or a single game.

6. **Undo Option**:
   - Provide an option to undo the last import in case the user makes a mistake.

7. **Success Feedback**:
   - Use a modal or toast notification to confirm a successful import.
   - Include details like the number of events imported and the timestamp of the saved game.

8. **Customizable Mapping**:
   - Allow users to map XML attributes to event properties dynamically, in case the XML structure varies.

9. **Progress Indicator**:
   - For large files, display a progress bar or spinner to indicate that the import is in progress.

10. **Localization and Accessibility**:

- Ensure the feature supports multiple languages and is accessible to users with disabilities (e.g., keyboard navigation, screen reader support).

11. **Save as Template**:

- Allow users to save the imported XML structure as a template for future imports, reducing repetitive tasks.

12. **Integration with Cloud Storage**:

- Enable users to import XML files directly from cloud storage services like Google Drive or Dropbox.
