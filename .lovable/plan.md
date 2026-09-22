# Member Access and Admin Simplification

## Goal
Make sign-in, registration, membership management, and admin navigation easier across phones, tablets, laptops, and desktops while preserving the existing email/password, profile, PayPal, and admin security systems.

## Member experience
- Redesign sign-in into a focused, responsive screen with clearer email/password controls, password visibility, password recovery, remembered-device access, and biometric/passkey access where supported.
- Replace the long registration form with three short guided steps: account details, membership choice, and review/confirmation.
- Keep Premium ($9.99/month) and Annual ($129.99/year), PayPal-only checkout, email confirmation, phone/SMS preference, and terms acceptance.
- Preserve entered registration details while moving between steps and during accidental refreshes on the same device; clear them after successful account creation.
- Redesign the member dashboard so membership status, PayPal connection, renewal date, access state, and cancellation are immediately understandable on every screen size.

## Cancellation and repeat-cancellation policy
- Replace the current destructive cancellation experience with a clear multi-step warning and confirmation flow.
- Explain that cancellation stops renewal but keeps paid access through the current billing period when PayPal confirms that behavior.
- Record every confirmed cancellation in the existing subscription activity history.
- After more than two confirmed cancellations, keep the account usable but place it in limited-access status; paid content remains unavailable until an admin restores eligibility.
- Show the cancellation count and limited-access state to the member and in admin member management.
- Keep PayPal as the payment authority and reconcile status through the existing PayPal functions/webhook; never expose or log full PayPal identifiers.

## Admin member center
- Turn the current member area into a compact member center with searchable rows and clear badges for account, PayPal, membership, cancellation count, and limited access.
- Add a focused member detail view for membership history, masked payment linkage, access controls, cancellation events, and approved admin actions.
- Add signup and successful-login activity views with timestamps and useful non-sensitive device context. Keep IP/device details protected and admin-only.
- Add portal, push, and email alerts for new signups and successful logins, using deduplication and the existing notification/email delivery systems.
- Continue using the existing Cloudflare-linked AI assistant for member-management assistance; do not replace it.

## Condensed admin navigation
- Reduce the primary navigation to: Dashboard, Streaming, Articles, Content, Members, and Notifications.
- Move infrequent tools into one collapsed **More** group, including reports, activity, podcast utilities, community campaigns, email tools, commerce, appearance, and settings.
- Remove duplicate menu entries such as Writer Applications appearing in multiple groups.
- Preserve all existing pages and direct links; no admin tool will be deleted under the selected “Group under More” option.
- Keep search and the mobile bottom bar, with Members as a primary destination.

## Backend and security
- Add a private auth-event store for signup/login activity and a member access-policy record for cancellation counts and limited-access state.
- Grant only the required authenticated/service access, enable row-level security, and restrict member activity to admins or the owning member where appropriate.
- Log successful sign-ins through a validated server function rather than trusting client-submitted user IDs.
- Update cancellation handling so account/profile history is retained for policy enforcement instead of permanently deleting the account.
- Apply limited-access checks alongside existing subscription checks so direct navigation cannot bypass restrictions.
- Reuse existing profile records, role checks, activity history, PayPal linkage, push subscriptions, and email queue.

## Validation
- Test sign-in, password recovery, remembered-device/biometric paths, guided signup, confirmation, PayPal handoff, cancellation warnings, repeat-cancellation limiting, and admin restoration.
- Verify portal, push, and email alerts without exposing payment IDs or private member data.
- Verify the member center and condensed admin menu with authenticated sessions on phone, tablet, laptop, and desktop sizes.
