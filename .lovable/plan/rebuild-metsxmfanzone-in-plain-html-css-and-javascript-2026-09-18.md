# Rebuild MetsXMFanZone in plain HTML, CSS, and JavaScript

## Goal
Replace the React/TSX application with a standards-based HTML, CSS, and JavaScript website while preserving the current design, URLs, backend data, member access, PayPal payments, streams, blogs, notifications, and administration tools.

## Migration approach
1. Inventory and classify every existing page and workflow: public content, accounts, subscriptions, media, community, and administration.
2. Build a shared HTML shell, design tokens, navigation, footer, dialogs, forms, and reusable browser JavaScript modules.
3. Rebuild public pages first, including live data, blog listings, article pages, direct links, social previews, canonical URLs, sitemap, and robots.txt.
4. Rebuild login, registration, member access, account management, PayPal handoffs, notifications, community tools, and live players.
5. Rebuild the complete admin area, including all upload, create, edit, delete, publishing, user, stream, and subscription workflows.
6. Replace React routing and state with browser routing, native forms, DOM events, and direct backend calls.
7. Remove React, TSX, React Router, React-only interface libraries, and obsolete React snapshot tooling only after feature parity is verified.

## Compatibility and rollout
- Keep the current backend, database, storage, functions, accounts, subscriptions, and URLs unchanged.
- Preserve the mobile/tablet layout and MetsXMFanZone appearance.
- Convert in controlled sections while the current app remains usable; switch the live entry point only when critical flows pass.
- Generate static HTML for high-value public pages with a strict page cap below hosting limits; newly published articles will still load immediately by URL.

## Technical details
- Keep Vite as the build tool, but remove its React integration at the final cutover.
- Use plain ES modules, semantic HTML, CSS, History API navigation, native form validation, and accessible browser controls.
- Keep framework-independent services such as the backend client, HLS/video playback, Capacitor, and server functions.
- Replace React-only dialogs, menus, charts, icons, forms, and query state with framework-independent equivalents.
- Keep private credentials in server-side function secrets; no secret keys will enter browser code.

## Verification
- Test every public URL through direct visits and internal navigation.
- Test signed-out, signed-in, paid-member, and admin states on mobile and tablet sizes.
- Verify login, registration, PayPal, account cancellation, uploads, blogs, live streams, casting, notifications, community, and admin operations end to end.
- Confirm social previews, canonical links, sitemap entries, and newly published article links.
- Confirm the final application has no React runtime and no application `.tsx` files.
