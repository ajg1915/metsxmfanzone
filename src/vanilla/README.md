# Plain HTML migration

This directory is the framework-free replacement for the React application.

- `core/` contains routing, metadata, sanitization, auth, and backend utilities.
- `ui/` contains reusable semantic HTML templates and DOM bindings.
- `pages/` contains route modules.
- `styles.css` contains the shared responsive design system.

The current React entry point remains active until the public, member, payment, media, and admin flows have feature parity. This prevents a partial migration from breaking the live website.