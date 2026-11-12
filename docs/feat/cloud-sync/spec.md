# Personal Cloud Drive Sync (`SimpleCoding/`)

**Status:** Implemented in app (`index.html#saved-games`, `timeline-video.html`).  
**Target:** Preserve **Invariant 1 (Client-side first with Sportscode XML fidelity)** and **Friction 3 (Zero-render review)** across devices (e.g., sideline capture phone $\leftrightarrow$ coaching review laptop) without requiring backend infrastructure or cloud rendering.

---

## 1. Core Architectural Principles

1. **Client-Side First & Eyes-on-Pitch Rule:**
   * All match logging and edits commit synchronously to `localStorage['fieldHockeyGames_v1']` via `gameStorageManager`.
   * Live match capture (`index.html#event-capture`) **never** triggers network requests, OAuth prompts, or UI shifts while the match clock is running.
2. **Minimal Privacy Scope (`drive.file`):**
   * Uses Google Identity Services (GIS) with `https://www.googleapis.com/auth/drive.file`.
   * The app can only see and manage files it creates inside the user's dedicated `SimpleCoding/` folder in Google Drive.
3. **Lossless Sportscode XML Envelope:**
   * Matches are stored in Google Drive as standard Sportscode XML files (`<slug>_<gameId>.xml`) that open directly in Hudl Sportscode / MyVA while carrying lossless `simple-coding` game metadata as attributes on the root `<file>` element.

---

## 2. Lossless Sportscode `<file>` Root Metadata Contract

Every synced XML file must round-trip both `<ALL_INSTANCES>` / `<ROWS>` and the following root `<file>` attributes via `generateGameXml` and `parseXmlToEvents`:

| XML Attribute | Game Property | Purpose |
| :--- | :--- | :--- |
| `app="simple-coding"` | `metadata.app` | Identifies lossless `simple-coding` XML envelope |
| `game_id` | `game.id` | Deterministic cross-device match identity |
| `teams` | `game.teams` | Match display title (e.g., `FIRE vs TIGERS`) |
| `team_codes` | `game.teamCodes` | Short team codes for board/timeline pills |
| `team_meta` | `game.teamMeta` | JSON-serialized team colours and names |
| `elapsed_time` | `game.elapsedTime` | Match clock duration in milliseconds |
| `timestamp` | `game.timestamp` | Match creation ISO timestamp (used for newest-first sorting) |
| `video_offset` | `game.videoOffsetMs` | Kick-off alignment offset in milliseconds |
| `video_url` | `game.videoUrl` | Direct MP4/WebM URL attached for Match Review |
| `last_updated` | `game.metadata.lastUpdated` | ISO timestamp of most recent local edit/save |

---

## 3. Reconciliation Authority Matrix (No Zombie Resurrection)

Cloud sync reconciles at the **authoritative match snapshot level**, NOT blind union-merging of event streams on every sync.

> **Why:** Blindly running `mergeXmlEventStreams` (union merge) on every sync makes it impossible to delete a mis-tapped event, adjust an event timestamp by $>500\text{ms}$, or un-star (`★`) a teaching clip because the remote file immediately resurrects the deleted/un-starred state on pull.
> `mergeXmlEventStreams` is reserved strictly for explicit **"Append XML"** operations (`importUtils.js`) where an analyst intentionally combines separate coding passes.

| Local State | Remote State | Winner & Reconciliation Action |
| :--- | :--- | :--- |
| `gameId` in `deletedGameIds` (Tombstone) | Exists on Drive | **Tombstone wins:** Never pull into `localStorage`. Send `PATCH files/<fileId>` with `{ trashed: true }`, then clear `gameId` from `deletedGameIds` and `remoteFileMeta`. |
| `gameId` in `dirtyGameIds` (Locally Edited) | Unchanged on Drive (`modifiedTime === remoteFileMeta[gameId].modifiedTime`) | **Local wins:** Keep local events, stars, notes, `videoUrl`, and team names as authoritative. Upload (`PATCH`) local XML to Drive (updating remote filename if `teams` changed). |
| `gameId` in `dirtyGameIds` (Locally Edited) | Also changed on Drive (`modifiedTime > remoteFileMeta[gameId].modifiedTime`) | **Last-Updated Snapshot Wins:** Compare `local.metadata.lastUpdated` vs. remote `last_updated` (or `modifiedTime`). If local is newer or equal, keep local and upload; if remote is strictly newer, adopt remote snapshot. |
| Clean (`!dirty`) | Changed on Drive (`modifiedTime > remoteFileMeta[gameId].modifiedTime`) or missing locally | **Remote wins:** Download remote XML and replace local match snapshot so edits, labels, un-stars, and event deletions made on Device A propagate cleanly to Device B. |
| Clean (`!dirty`) & Previously Synced (`gameId` in `remoteFileMeta`) | Missing from Drive (`!activeRemoteIds.has(gameId)`) | **Remote Trash Propagates:** Match was deleted/trashed on another device; remove from local `fieldHockeyGames_v1` and `remoteFileMeta` on this device. |
| Clean (`!dirty`) | Unchanged on Drive (`modifiedTime === remoteFileMeta[gameId].modifiedTime`) | **Incremental Skip (No-op):** Skip downloading XML content completely. |

---

## 4. Incremental Sync, Ordering & Storage Cap (`MAX_GAMES = 20`)

1. **Incremental Metadata Tracking (`remoteFileMeta`):**
   * `fieldHockeyCloudSync_v1` stores `remoteFileMeta: { [gameId]: { fileId, name, modifiedTime } }`.
   * During `syncNow()`, `listRemoteXmlFiles` fetches `(id, name, modifiedTime)` for all non-trashed `.xml` files in `SimpleCoding/`.
   * `fetchRemoteEntries` only downloads XML bodies (`alt=media`) for files whose `gameId` is not in `deletedGameIds` AND either:
     * Does not exist locally (within the active window), or
     * Has a `modifiedTime` different from `remoteFileMeta[gameId]?.modifiedTime`.
2. **Deterministic Newest-First Ordering:**
   * Reconciled local matches are always sorted newest-first by `timestamp` descending before saving to `fieldHockeyGames_v1`.
3. **Harmony with `MAX_GAMES = 20`:**
   * If the combined set of matches exceeds `gameStorageManager.MAX_GAMES` (20), only the 20 most recent matches (plus any currently dirty local matches awaiting upload) are retained in `localStorage`, preventing infinite prune-then-redownload thrashing while keeping older matches safely archived in Google Drive.

---

## 5. Cross-Page Lifecycle & Zero-Popup Session Auth

1. **Session Token Survival (`sessionStorage`):**
   * Because `index.html` and `timeline-video.html` are separate HTML entry points, `CloudSyncService` caches the active OAuth access token and expiry in `sessionStorage['fieldHockeyCloudSyncToken_v1']`.
   * Reloading a page or navigating from `Saved Games` to `Match Review` / `Continue Coding` reuses the active token seamlessly until its 1-hour expiry.
2. **Never Trigger GIS Popup on Background Sync:**
   * `syncIfConnected()` (triggered automatically on view navigation or background save) must **never** call `tokenClient.requestAccessToken()` when the token is missing or expired, as browsers block unprompted OAuth popups.
   * Instead, if `isConnected()` is true but no valid token exists in memory/`sessionStorage`, `syncIfConnected()` transitions status to `'auth_required'` (`Reconnect Sync` badge) and waits for an explicit user click (`Connect` / `Sync Now` / `Reconnect`).
3. **Match Review & Video Coding (`timeline-video.html`) Auto-Sync:**
   * `timeline-video.js` marks the edited `gameId` dirty in `cloudSyncService` on user-initiated saves (event tag, label sweep/pill, star toggle, note edit, video offset, video URL attach), triggers a debounced (`3000ms`) background `syncIfConnected()`, and flushes immediately on `Exit to Matches`.
   * **Read-Only Load Invariant:** Merely opening or viewing a match in `timeline-video.html` (`loadGame`) must **never** mark the match dirty or bump `metadata.lastUpdated` (e.g. when normalizing internal `evt.id` keys), preventing a viewing device from shadowing newer edits/labels synced from another device.
