# Roadmap — plain HTML/CSS/JavaScript rebuild

- [x] Inventory all routes, pages, shared components, and interactive features
- [x] Design the plain HTML/CSS/JavaScript architecture and migration sequence
- [x] Foundation: router, backend client, sanitizer, metadata, shared header/footer
- [x] Separate preview build for the rebuild (vite.config.vanilla.ts, port 8081) so the live site is untouched
- [x] Sign-in state store (session, profile, member, admin) wired into the header
- [x] Home page with live featured slides, live/upcoming streams, and latest news
- [x] News list and article pages with real data
- [ ] Remaining public pages with real content (schedule, scores, podcast, player stats, recaps, help/legal)
- [ ] Sign in, registration, account dashboard, membership/PayPal flows
- [ ] Live players, casting, community, notifications
- [ ] Admin portal and content management
- [ ] Static page generation, sitemap, robots for the new build
- [ ] Cutover: switch the live entry point, then remove React dependencies

## Update — vanilla rebuild progress
Done since last update:
- Contact and feedback forms (plain JS, saved to the database, feedback requires sign-in)
- Admin portal core: dashboard counters, article create/publish/unpublish/delete,
  stream go-live/hide toggles, community feature/delete, member directory
- Styles for account, plans, watch, podcast, video, recaps, community, games, forms, admin

Verified in the private preview (port 8081): home, blog list, auth, plans/pricing,
community, podcast, video gallery, recaps, schedule, scores, nl-scores, watch gate,
dashboard redirect, help-center, faqs, privacy, contact, feedback — no console errors.
Admin pages redirect correctly when signed out; signed-in admin screens still need a
real owner-account login to verify.

Still open: matchup pages, roster, history, social, tv, install, whats-new, rewards,
podcaster/business applications, per-help-article content, stories, gamecast,
sweepstakes, shop, notifications/FCM, AI assistant, uploads, casting,
static generation + sitemap/robots for the new build, cutover, React dependency removal.
