# MetsXMFanZone roadmap

## Full plain-HTML rebuild (in progress)
Goal: every page in the app exists as a plain HTML/JS page under `src/vanilla/`,
with the same real content and features as the React version. Only then swap the
live site over from React to the HTML build.

- [x] Shell, router, metadata, auth, backend helpers (`src/vanilla/core`, `ui/shell.js`)
- [x] Admin area (18 sections) — signed-out verified
- [ ] Batch A — help centre, legal and informational pages with real content
- [ ] Batch B — account, membership and payment pages (auth, dashboard, pricing, PayPal returns, writer)
- [ ] Batch C — games, media and network/watch pages (matchups, roster, scores, schedule, recaps, gallery, TV)
- [ ] Batch D — homepage, blog, community parity pass
- [ ] Full mobile + desktop test sweep, link check, per-page titles/descriptions/canonicals/social images
- [ ] Cutover: make the HTML build the live site (replaces React entry)

## Blocked
- DB indexes on realtime_presence.session_id / last_seen_at and visitor_clicks.created_at (migrations need owner approval)
- Signed-in admin testing (needs owner account login on the owner backend)
