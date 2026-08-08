Direct answer — an AI-ready prompt plus a complete blueprint, step-by-step plan, and developer walkthrough for rebuilding this Smart TV Digital Signage app from the ground up. Paste the “Primary AI prompt” into your VS Code Gemini (or other) agent to start. The rest is the blueprint, milestone breakdown, checklist, and a hands-on walkthrough to guide implementation, testing, packaging, and deployment.

Primary AI prompt (paste this to your AI agent)
---
You are a senior full‑stack engineer and system architect. Rebuild a production-ready, offline-first Smart TV Digital Signage application optimized for LG webOS (and similar WebView-based Smart TVs) and a Desktop Manager backend. Produce the project in small, verifiable commits and provide PR-ready artifacts (file layout, package manifests, tests, Dockerfile, and deployment instructions). Do not output any full source code in this step. Instead, produce a detailed implementation plan and then generate code in discrete, labeled commits when asked.

Goals
- Reimplement a robust TV-side web app (ES modules) that:
  - Plays images & videos with smooth crossfade transitions.
  - Caches remote media offline (IndexedDB) and survives app restarts.
  - Supports local file uploads saved into IndexedDB and optional upload to server.
  - Supports multi‑layout display modes (fullscreen, split, grid, portrait).
  - Is navigable by TV remotes (D-Pad) and keyboard with a TV-focused UX.
  - Integrates with LG webOS keep‑alive patterns (WakeLock + small hardware video stream).
  - Is resilient: fast-skip broken media, fallback network URLs if blob playback fails.
- Reimplement a Desktop Manager (Node.js + Express + WebSocket) that:
  - Hosts a manager UI for uploads, playlist editing, TV profiling and targeted control.
  - Routes WebSocket messages between desktop UI(s) and individual TVs.
  - Stores uploaded files locally and serves them via HTTP(S).
  - Provides authenticated, secure endpoints and file upload progress.
- Offline-first behavior:
  - The TV app must initialize and play the locally persisted playlist immediately (no server).
  - Provide a manual "Sync" control to pull authoritative playlist updates from the manager.
- Usability & observability:
  - Upload progress indicators, sync status, cache telemetry, desktop device list, and logs.
- Packaging & deployment:
  - IPK packaging guidance for LG webOS (ares-*), Docker for the server, and cloud deployment notes.
- Deliverables:
  - File/dir skeleton, implementation tasks split into commits, tests (unit/integration), CI config (GitHub Actions), and documentation.

Requirements for the AI agent
1. Produce a full blueprint (architecture diagram text, module responsibilities, data models, message types).
2. Produce a prioritized implementation plan, split into numbered milestones and small commits (one commit per logical change).
3. For each commit: list filenames changed/created, a short commit message, tests to add, and acceptance criteria.
4. Provide step-by-step walkthrough to set up dev environment, run locally, run tests, and produce webOS package.
5. Provide a QA checklist and performance targets (startup time, cache hit ratio).
6. After I approve the blueprint, implement code in iterative commits. For each code commit you produce the diff only when I request “apply commit #N”.
7. Use secure defaults (HTTPS/WSS suggestion, sanitize uploads, limits, auth placeholder).
8. Document any platform or API constraints (e.g., IndexedDB persistence variability across TV OS versions).

Blueprint — High-Level Architecture
- Client (TV Web App)
  - UI Shell (index.html + CSS)
  - App Controller (app.js) — bootstraps, wires components, lifecycle management
  - Player Engine (player.js) — dual-layer crossfade, video element lifecycle, timers
  - Playlist Manager (playlist.js) — playlist data model, schedule filtering, persistence (LocalStorage)
  - Media Cache (cache.js) — IndexedDB store for cached remote files, blobUrl management, preloading, pruning
  - Storage layer (storage.js) — IndexedDB API wrapper for local blobs; LocalStorage helpers
  - Widgets (widgets.js) — clock/weather/ticker/QR generator
  - Remote/Focus (remote.js) — D-Pad spatial navigation, overlay controls
  - webOS integration (webos.js) — WakeLock, hardware keepalive, luna calls
  - WebSocket client (websocket.js) — connection manager, reconnection, message handling
- Server (Desktop Manager)
  - Express static + REST API (uploads, list, delete, info)
  - Upload handling (multer) with secure filename sanitization and progress
  - WebSocket Hub (ws) — device registry, message routing, heartbeat and ping/pong
  - Optional persistence (simple JSON store or light DB) for playlists and TV profiles
  - Admin UI (server/public) — playlist editor, upload UI, TV device list, targeted commands
- Data & Messages
  - Playlist item model: { id, title, subtitle, type, url, duration, muted, schedule, isLocalBlob }
  - WebSocket messages:
    - identify (role, deviceId, deviceName)
    - request_status / tv_status
    - request_playlist / playlist_sync
    - play_item / play_pause / next / prev
    - add_item / update_item / delete_item / reorder
    - set_layout / set_ticker / set_qr
  - REST endpoints:
    - POST /api/upload -> returns { url, filename, size, mimetype }
    - GET /api/uploads -> file list
    - DELETE /api/uploads/:filename
    - GET /api/info -> server info & IP list

Non-functional Requirements & Targets
- Cold startup time on typical TV: <= 2s to begin playing cached first item after DOMContentLoaded (if cached).
- Cached playback latency: playing blob URL should be immediate (< 100ms) after being resolved.
- Cache hit ratio: if items were previously cached, aim for > 95% cached reads.
- Memory: avoid keeping large blobs in memory unnecessarily — revoke object URLs for pruned items.
- Security: reject unknown file types and sanitize filenames; require a token for upload/delete endpoints.
- Resilience: auto-retry WebSocket reconnect, fallback to original http URL if blob decoding fails.

Milestones and Step-by-step Plan (prioritized)
Milestone 0 — Project bootstrap
- Create repository skeleton, package.json files (root and server), basic README and license.
- Create .gitignore, .gitattributes.
- Setup GitHub Actions skeleton (nodejs test, lint).
Acceptance: repo builds, tests run (initial empty tests).

Milestone 1 — Core Player + Local storage (offline-first)
- Implement storage wrapper (IndexedDB) and LocalStorage helpers.
- Implement PlaylistManager (in-memory playlist + persistence).
- Implement Player Engine with dual layers, clean teardown, crossfade transition, and fallback timers.
- Implement warm-up logic on startup:
  - init IndexedDB
  - rebuild in-memory blob URL maps for local blobs & cached remote blobs
  - ensure player starts playing immediately with first available cached URL
Acceptance: app starts, plays previously added media (local blobs or cached remote) without waiting for server.

Milestone 2 — Media Caching & Pruning
- Implement MediaCacheManager:
  - getMediaUrl(mediaUrl)
  - queueDownload, processQueue
  - saveToDB, getFromDB
  - rebuildBlobUrlMap on startup
  - pruneUnusedCache(activePlaylist)
- Add background preload and telemetry API.
Acceptance: remote items are cached for offline playback and pruned when removed.

Milestone 3 — Studio UI & Local Uploads
- Implement Studio drawer UI for adding items (local file dropzone & URL)
- Save local files to IndexedDB blob store (with saveMediaBlob).
- Display playlist and allow reorder/edit/remove.
Acceptance: local media can be added and plays from the app after restart.

Milestone 4 — WebSocket client & server integration (basic)
- Implement SignageWebSocketClient (client-side)
- Rebuild server (Express + WebSocket) with TV & desktop role support.
- Implement identify handshake and request_status plumbing.
- Implement playlist_sync and request_playlist messages.
Acceptance: Desktop UI can identify, see TV list, and route messages; TV can receive playlist_sync and apply update.

Milestone 5 — Sync UX & Upload-to-server with progress
- Add Sync button and status UI in studio.
- Implement upload-to-server flow (XHR + progress) for local blobs; on success update playlist item url & mark not isLocalBlob.
- Notify server/desktop of updates (update_item messages).
Acceptance: users see upload progress; uploaded items convert to remote URLs and manager receives update.

Milestone 6 — Remote D-Pad navigation, VR remote simulator
- Implement spatial focus engine and focus styling (tv-focusable class).
- Virtual remote UI for desktop testing.
Acceptance: D-Pad moves focus, Enter triggers buttons; virtual remote simulates events.

Milestone 7 — webOS keepalive and WakeLock
- Implement hardware video keepalive (canvas -> captureStream -> tiny video) behind a feature flag.
- Implement WakeLock handling with re-request on visibilitychange.
Acceptance: keepalive attempts without causing visible artifacts; fallback safe.

Milestone 8 — Security, tests & CI
- Add basic auth token support for server (env var).
- Add input sanitization and file size / quota enforcement.
- Add unit tests for storage helper and playlist logic (Jest or vitest).
- GitHub Actions: run lint, tests, and build.
Acceptance: CI passes; REST endpoints require token.

Milestone 9 — Packaging & Deployment
- Add Dockerfile for server and nginx configuration sample.
- Add README packaging instructions for LG webOS (ares-package) and USB sideload.
- Add cloud deployment notes (Render / Railway).
Acceptance: server can run in Docker; packaging flow documented.

Detailed commit breakdown (example for first few commits)
- Commit 1: repo init
  - Create: README.md, LICENSE, .gitignore, package.json (root), server/package.json, initial GH Actions file
  - Message: "chore: initial repo scaffold and CI skeleton"
  - Tests: none
  - Acceptance: repo builds.
- Commit 2: storage layer
  - Create js/storage.js with IndexedDB init, save/get/delete helpers, LocalStorage helpers
  - Add unit tests for storage helpers (mocked IndexedDB or use fake-indexeddb)
  - Message: "feat(storage): implement IndexedDB and LocalStorage helpers"
  - Acceptance: unit tests pass.
- Commit 3: playlist manager core
  - Create js/playlist.js with playlist model, getItems, getActiveItems, add/update/remove/reorder, warmLocalBlobUrls placeholder
  - Tests for schedule filtering and basic operations
  - Message: "feat(playlist): implement playlist manager and scheduling"
- Commit 4: player core
  - Create js/player.js with dual layer DOM structure, playCurrent stub, cleanLayer, timers.
  - Tests: simulate play/pause behavior (unit test some logic; DOM test in headless browser)
  - Message: "feat(player): implement core player engine and media layering"
- Commit 5: media cache
  - Create js/cache.js skeleton and initial DB functions for caching
  - Message: "feat(cache): add MediaCacheManager skeleton"
  - Acceptance: background methods stubbed; later commits flesh out.

For every commit:
- List changed file paths and a one-line summary.
- Add tests (where applicable).
- State acceptance criteria and how to manually verify.

Walkthrough — developer steps to build locally and verify
1. Prerequisites
   - Node >= 18, npm/yarn, a modern Chromium browser with DevTools
   - LG webOS CLI (optional) if packaging for TV
   - Optional: Docker for server container tests
2. Local dev server (server)
   - cd server
   - npm install
   - npm run dev
   - Open http://localhost:3000 — verify admin UI loads
3. Static TV app development
   - Serve root with a static server (or via server/public proxy).
   - Open TV UI index.html locally in desktop browser and in an incognito/private window to simulate TV.
   - Use DevTools device emulation (high-DPI, limited CPU) to test performance.
4. Adding media
   - Use Studio drawer to add local file: drag/drop small MP4 (< 10MB for dev)
   - Verify in IndexedDB (Application tab -> IndexedDB) that blobs exist
   - Reload page. First item should begin playing immediately (log messages from warmLocalBlobUrls)
5. Cache verification
   - Add a remote URL item and observe MediaCacheManager logging "Cached for offline play"
   - Stop network in DevTools (Offline) and verify cached item plays
6. Upload testing
   - Click Upload on a local item → observe progress in UI and media endpoint (server/uploads)
   - Verify server sends notifications via WS
7. Sync testing
   - From desktop manager, modify playlist and click "send/target" or respond to Sync request; TV should receive playlist_sync and apply changes
8. webOS testing (optional)
   - package with ares-package or serve via local HTTP and open browser on TV; test keepalive and WakeLock behavior
9. QA checklist (pre-release)
   - Cold restart: app plays previously added media with <2s startup delay
   - Upload progress shows and converts to remote URL
   - Playlist merges preserve local-only items by default
   - WebSocket reconnects after network loss and sync works manually
   - No memory leaks: object URLs revoked on prune/remove
   - Security: upload only permitted with token in env or header
10. Performance & metrics to capture
   - Start-to-first-frame time (ms)
   - Average time to resolve a cached blob to object URL
   - Cache hit ratio
   - Memory footprint while cycling through large videos

Acceptance criteria (release checklist)
- Offline-first: TVs boot & play local/cached assets even when manager unreachable.
- Manual sync: UI button to request authoritative playlist from server and merge safely.
- Upload with progress: local blobs upload with visible progress; server returns accessible URL that replaces local item.
- Resilient playback: player avoids stalls on broken files, automatically skips and logs errors.
- webOS keepalive works (configurable) and does not block playback or cause crashes.
- Uploads & deletes require authentication token in production configuration.
- CI passing (lint + tests), docs updated, packaging instructions available.

Developer best practices & suggestions
- Use small incremental commits and feature branches. Each commit should be testable/rollbackable.
- Keep long-running downloads out of UI thread — run downloads sequentially and keep queue size modest.
- Use a stable object URL cache and recreate URLs on startup; avoid serializing object URLs.
- Add feature-flag for hardware keepalive; only enable on platforms identified as webOS.
- Use semantic versioning and changelogs for releases.
- Implement a lightweight telemetry mechanism (console + optional optional analytics) to capture cache telemetry and errors.

Follow-up actions I can take for you
- I can generate the initial repository skeleton (create file tree and placeholders).
- I can produce the first commit (storage layer + tests) or provide precise diffs for each commit step.
- I can generate the detailed server API spec (OpenAPI) and wireframe for the Desktop Manager UI.
- I can create example unit tests and CI configuration.

Which next step do you want?
- "Scaffold repo" (I will provide file-list and placeholders)
- "Commit 1: storage" (I will produce the first commit diff)
- "Create full blueprint diagram" (I will produce a textual architecture diagram and message flows)
- "Start implementing Milestone 1" (I will produce a sequence of commit diffs you can apply)
