# Member Center and Subscription UI Refresh

## Goal
Create a simpler, mobile-first experience for members to understand their access, manage PayPal membership, and reach account tools. Rework the admin Members area so important member and billing actions are clear on phones, tablets, and desktops.

## Member Center
- Replace the visually heavy profile screen with a cleaner membership-first overview.
- Show the member's current plan, access status, renewal or access-through date, and PayPal connection clearly at the top.
- Group profile, notifications, passkeys, and account support into easy-to-scan sections.
- Keep quick links to live viewing, community, articles, and podcasts with clear locked states.
- Remove stale free-tier and Spring Training promotion language.

## Subscription Management
- Make plan status and billing dates accurate for active, cancelled, trial, expired, and limited-access members.
- Keep PayPal as the only payment method and clearly show whether billing is linked.
- Make changing plans, cancelling, and post-cancellation status easy to understand on every screen size.
- Preserve the account after cancellation and clearly explain access-through dates and repeat-cancellation limits.
- Fix unsafe query assumptions and error paths so failed actions do not show misleading success states.

## Admin Members
- Replace the desktop-only member table on small screens with compact member cards; retain an efficient table on larger screens.
- Consolidate duplicate summary blocks and simplify Members, Signups, Transactions, and Roles navigation.
- Surface plan, status, PayPal linkage, cancellation count, limited access, renewal date, and roles without horizontal scrolling.
- Keep sensitive information masked by default and retain all current admin controls.
- Add proper success/error handling to plan, status, trial, extension, payment, role, restoration, and deletion actions.
- Keep the existing Cloudflare-linked AI member assistant available without making it dominate the page.

## Verification
- Run the project checks after implementation.
- Verify signed-in Member Center and admin Members views at mobile, tablet, and desktop sizes.
- Exercise the safe non-destructive states and confirm cancellation/payment actions present correct warnings and errors without exposing payment identifiers.

## Technical Details
- Reuse the current design tokens and shared controls; no payment provider, authentication, or storage migration.
- Continue using the existing PayPal functions and backend records.
- Use resilient single-row reads and generic member-facing payment errors.
