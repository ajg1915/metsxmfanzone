# Easier Login, Registration, and Membership Plans

## What will change
- Replace the current crowded login and registration screen with a simpler, mobile-first account experience that also fits tablets and computers.
- Keep email/password access, password recovery, remembered-device access, profile creation, email confirmation, and admin login activity alerts.
- Remove biometric/passkey sign-in from login, the Member Center, Help Center, and public routes.
- Make registration account-first: members enter account and contact details, confirm their email, then choose a membership.
- Restore four clear membership choices:
  - Free — public news and community access; live streams and premium content remain locked.
  - Weekly — $3.99 per week through PayPal.
  - Monthly — $9.99 per month through PayPal.
  - Yearly — $129.99 per year through PayPal.
- Make Free selection complete setup without opening PayPal. Paid choices continue through the existing secure PayPal checkout.
- Update Member Center plan names, access labels, help copy, and membership redirects to match the four choices.

## Technical details
- Preserve existing plan identifiers (`free`, `weekly`, `premium`, `annual`) so current memberships, admin tools, and PayPal records remain compatible.
- Add a protected free-plan activation path that only writes the signed-in member’s own basic membership state.
- Keep paid access checks limited to Weekly, Monthly, and Yearly; Free receives only basic-content permissions.
- Keep email confirmation enabled and preserve the existing profile record and signup/login notifications.
- Retain generic payment errors and redacted PayPal logging.

## Verification
- Check sign-in, password recovery, registration steps, confirmation handoff, Free selection, and each paid-plan checkout handoff.
- Check phone, tablet, and desktop layouts for clipping, overflow, and usable controls.
- Run the project checks and verify there are no remaining visible biometric/passkey entry points.
