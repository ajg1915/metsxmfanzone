# Live streaming experience upgrade

## Goal
Rebuild every public live-viewing page around one fast, borderless, device-friendly broadcast experience, with persistent casting controls, reliable rotation/fullscreen behavior, clearer game presentation, and viewer issue tickets that are AI-triaged and surfaced to the admin portal.

## What will change

### 1. One shared modern player across every stream page
- Upgrade the shared HLS player used by live game, MetsXMFanZone, MLB, ESPN, MSG, MSG+, PIX11, and TV views.
- Remove the doubled frame that creates a visible border on phones; the video will run edge-to-edge on small screens while retaining a restrained desktop frame.
- Keep play, mute, LIVE, quality, retry, report, cast, picture-in-picture, and fullscreen controls readable at every screen size.
- Keep the Cast control permanently visible above the auto-hiding playback controls, with clear available, connecting, and casting states.
- Support Chromecast, browser Remote Playback, and AirPlay-compatible video output without allowing a cast overlay to cover the picture.

### 2. Better mobile rotation and fullscreen
- Add a dedicated theater/fullscreen controller with iPhone/iPad fallback behavior.
- Request landscape orientation when supported after entering fullscreen, then unlock it when leaving.
- Handle portrait, landscape, safe areas, browser bars, foldable/tablet sizes, desktop, and TV without cropping controls or leaving page borders.
- Preserve inline playback when fullscreen is unavailable or denied.

### 3. Faster and more resilient playback
- Start the stream before loading secondary game/news content.
- Tune HLS startup, adaptive quality selection, live-edge latency, buffering, retries, and stall recovery by device/network conditions.
- Prefer the direct secure source first and only use a proxy fallback when it is actually required, avoiding unnecessary connection attempts.
- Add preload and connection hints where they can reduce startup time without caching stale live video.
- Keep the existing stream source, access rules, memberships, and guest-preview behavior unchanged.

### 4. Broadcast-style game presentation
- Create one reusable live-page shell instead of maintaining separate oversized channel pages.
- Put the stream first, followed by a compact live status strip, title, matchup/game details, share action, and a clear route to live Gamecast.
- Use current thumbnails and MLB data for recognizable matchup visuals; do not invent teams, scores, or schedules.
- Keep secondary channel information compact so the next useful content remains visible on phones.

### 5. Viewer stream issue tickets
- Add a compact “Report an issue” sheet directly beside the player controls.
- Let viewers choose buffering, audio, video, casting, login/access, or other; add a short description and optional reply email for guests.
- Automatically include only useful diagnostics: stream, page, device/browser family, connection type when available, player state, quality, buffer, and timestamp.
- Add spam throttling, field limits, server validation, and generic success/error messages.

### 6. AI triage and admin alerts
- Add a secure `stream_issue_tickets` queue with open, in-progress, resolved, and closed states.
- Use the existing AI gateway to classify category and severity and create a short admin summary; fall back safely to rule-based triage if AI is unavailable.
- Correlate written tickets with automatic player health reports so repeated failures raise priority instead of creating noise.
- Send an admin-only alert for high/critical or repeated issues, without exposing viewer contact details publicly.
- Keep viewers restricted to submitting tickets; only admins can read, assign, update, or resolve them.

### 7. Admin stream issues section
- Add “Stream Issues” under Streaming in the admin menu, matching the compact Blog Management interface.
- Show open counts, priority filters, search, stream/device context, AI summary, newest reports first, assignment/status controls, and resolution notes.
- Add realtime updates with a polling fallback and show the open issue count on the admin dashboard.
- Keep the current feed-health and automatic stream-health tools intact and link related signals together.

## Technical details
- Reuse the existing React player, HLS library, semantic design tokens, admin UI primitives, stream-health tables, realtime channel pattern, and admin-role checks.
- Create the new table with explicit grants, RLS enabled, safe insert-only viewer access, admin-only reads/updates, indexes, constraints, and realtime publication.
- Add a public ticket-submission function and an admin-only ticket-action function; no privileged key or raw AI output reaches the browser.
- Refactor repeated network pages into a shared presentation shell only where behavior remains identical.
- Preserve the React site and both existing HTML backup files.

## Verification
- Test live pages at phone portrait, phone landscape, tablet, desktop, and TV viewport sizes.
- Verify no mobile frame/border, controls do not overlap, casting remains visible, fullscreen exits cleanly, and rotation fallback works.
- Verify HLS startup/retry behavior with valid, delayed, and failing sources.
- Submit a real issue ticket, confirm AI/rule triage, confirm realtime admin arrival, update its status, and confirm it remains after refresh.
- Run focused tests plus the project’s normal validation and inspect the final screens visually.
