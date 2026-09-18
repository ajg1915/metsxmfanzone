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
