# MetsXMFanZone roadmap

## Full plain-HTML rebuild (in progress)
Goal: every page in the app exists as a plain HTML/JS page under `src/vanilla/`,
with the same real content and features as the React version. Only then swap the
live site over from React to the HTML build.

- [x] Shell, router, metadata, auth, backend helpers (`src/vanilla/core`, `ui/shell.js`)
- [x] Admin area (18 sections) — signed-out verified
- [x] Batch A — help centre, legal and informational pages with real content
- [x] Batch B — account, membership and payment pages (auth, dashboard, pricing, PayPal returns, writer)
- [x] Batch C — games, media and network/watch pages (matchups, roster, scores, schedule, recaps, gallery, TV)
- [ ] Batch D — homepage, blog, community parity pass
- [x] Full mobile + desktop test sweep, link check, per-page titles/descriptions/canonicals/social images
- [ ] Cutover: make the HTML build the live site (replaces React entry)

## Blocked
- DB indexes on realtime_presence.session_id / last_seen_at and visitor_clicks.created_at (migrations need owner approval)
- Signed-in admin testing (needs owner account login on the owner backend)

## Batch D — remaining pages (in progress)
- [x] D1: public network/player/misc pages (espn/mlb/msg/pix11-network, private-player, admin-portal, admin-pin-reset, legal/admin-setup, tutorial, sitemap.xml)
- [x] D2: admin content sections (stories, posts, podcasts, polls, game-recaps, hero, media-library, video-gallery-management, sweepstakes, predictions, player-of-the-month, loyalty-rewards, newsletter)
- [x] D3: admin ops sections (settings, seo, realtime-analytics, notifications, email editor/templates, stream-health/tester, studio, user-management, trials, applications, feedbacks, business-ads, daily-reports, feed-health, toast-prompts, welcome-screen, tutorials, activity, ai-assistant, backgrounds, social-media)
- [x] Full mobile + desktop sweep, then cutover

- [x] Cutover complete: index.html now loads the plain-HTML app (backup: index.react.html.bak)
